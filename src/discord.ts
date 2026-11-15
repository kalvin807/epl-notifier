import { Schedule } from './schedule';
import { SCHEDULE_URL } from './scrape';
import { log } from './log';

// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
const LIMITS = { content: 2000, fields: 25, fieldName: 256, fieldValue: 1024 } as const;

export interface DiscordEmbedField {
	name: string;
	value: string;
	inline: boolean;
}

export interface DiscordWebhookPayload {
	content: string;
	embeds: {
		title: string;
		url: string;
		color: number;
		fields: DiscordEmbedField[];
		footer: { text: string };
		timestamp: string;
	}[];
}

const truncate = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/**
 * Discord renders `<t:unix:style>` in each reader's own timezone and language,
 * e.g. style R → "in 28 minutes", f → "21 November 2026 20:30".
 * https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
const discordTime = (schedule: Schedule, style: 'R' | 'f'): string =>
	schedule.dateTime ? `<t:${Math.floor(schedule.dateTime.toSeconds())}:${style}>` : '';

/**
 * e.g. `⚽ 28m 後開波：主 曼城 vs 富咸 客 / 主 維拉 vs 新特蘭 客`.
 * Plain text on purpose: push notifications may not render `<t:…>` timestamps.
 */
export function buildNextMatchContent(nextMatches: Schedule[], now = new Date()): string {
	const first = nextMatches[0];
	if (!first?.dateTime) return '';
	const minutes = Math.round((first.dateTime.toMillis() - now.getTime()) / 60_000);
	const matches = nextMatches.map(({ homeTeam, awayTeam }) => `主 ${homeTeam} vs ${awayTeam} 客`).join(' / ');
	return truncate(`⚽ ${minutes}m 後開波：${matches}`, LIMITS.content);
}

export function buildScheduleFields(schedules: Schedule[]): DiscordEmbedField[] {
	const fields = schedules
		.filter(s => s.dateTime)
		.map(s => ({
			name: truncate(`${s.homeTeam} vs ${s.awayTeam}`, LIMITS.fieldName),
			// finished/live matches show the score, upcoming ones show the kick-off time
			value: truncate(s.score ? `**${s.score}**` : `${discordTime(s, 'f')}（${discordTime(s, 'R')}）`, LIMITS.fieldValue),
			inline: false,
		}));
	if (fields.length > LIMITS.fields) {
		log('warn', 'discord_fields_truncated', { total: fields.length, kept: LIMITS.fields });
	}
	return fields.slice(0, LIMITS.fields);
}

export function buildUpNextPayload(nextMatches: Schedule[], schedules: Schedule[], now = new Date()): DiscordWebhookPayload {
	return {
		content: buildNextMatchContent(nextMatches, now),
		embeds: [
			{
				title: '今期賽事',
				url: SCHEDULE_URL,
				color: 0x0099ff,
				fields: buildScheduleFields(schedules),
				footer: { text: 'Yahoo! スポーツナビ' },
				timestamp: now.toISOString(),
			},
		],
	};
}

export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		// Discord explains rejected payloads (e.g. a limit exceeded) in the body
		const body = truncate(await response.text(), 500);
		log('error', 'discord_webhook', { status: response.status, body });
		throw new Error(`Discord webhook responded ${response.status}: ${body}`);
	}
	log('info', 'discord_webhook', {
		status: response.status,
		content: payload.content,
		fields: payload.embeds[0]?.fields.length ?? 0,
	});
}
