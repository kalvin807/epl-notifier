import { describe, expect, it, vitest } from 'vitest';
import { DateTime } from 'luxon';
import { Schedule } from './schedule';
import { buildNextMatchContent, buildScheduleFields, buildUpNextPayload, sendDiscordWebhook } from './discord';

const kickoff = DateTime.fromISO('2026-11-21T20:30:00+08:00');
const unix = Math.floor(kickoff.toSeconds());
const match = (home: string, away: string, score: string | null = null, dt = kickoff) =>
	new Schedule('').setFields(home, away, dt, score);

describe('buildNextMatchContent', () => {
	it('counts down in plain text and lists all matches', () => {
		const now = kickoff.minus({ minutes: 28 }).toJSDate();
		expect(buildNextMatchContent([match('曼城', '富咸'), match('維拉', '新特蘭')], now)).toBe(
			'⚽ 28m 後開波：主 曼城 vs 富咸 客 / 主 維拉 vs 新特蘭 客'
		);
	});

	it('is empty without matches', () => {
		expect(buildNextMatchContent([])).toBe('');
	});
});

describe('buildScheduleFields', () => {
	it('shows the score for played matches and kick-off time otherwise', () => {
		expect(buildScheduleFields([match('痾仙奴', '熱刺', '2-1'), match('曼城', '富咸')])).toEqual([
			{ name: '痾仙奴 vs 熱刺', value: '**2-1**', inline: false },
			{ name: '曼城 vs 富咸', value: `<t:${unix}:f>（<t:${unix}:R>）`, inline: false },
		]);
	});

	it("caps fields at Discord's limit of 25", () => {
		const many = Array.from({ length: 30 }, (_, i) => match(`H${i}`, `A${i}`));
		expect(buildScheduleFields(many)).toHaveLength(25);
	});
});

describe('buildUpNextPayload', () => {
	it('builds one embed linking to the source page', () => {
		const payload = buildUpNextPayload([match('曼城', '富咸')], [match('曼城', '富咸')], new Date(0));
		expect(payload.embeds).toHaveLength(1);
		expect(payload.embeds[0]).toMatchObject({
			title: '今期賽事',
			url: 'https://soccer.yahoo.co.jp/ws/category/eng/schedule/',
			timestamp: '1970-01-01T00:00:00.000Z',
		});
	});
});

describe('sendDiscordWebhook', () => {
	it('throws with Discord’s explanation when the payload is rejected', async () => {
		const fetchMock = vitest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{"embeds": ["Must be 25 or fewer in length."]}', { status: 400 }));
		const payload = buildUpNextPayload([match('曼城', '富咸')], []);
		await expect(sendDiscordWebhook('https://discord.test/hook', payload)).rejects.toThrow(/400.*25 or fewer/);
		fetchMock.mockRestore();
	});
});
