import { afterAll, beforeAll, describe, expect, it, vitest } from 'vitest';
import scheduleHtml from './__fixtures__/schedule.html?raw';
import standingsHtml from './__fixtures__/standings.html?raw';
import { parseSchedules, parseStandings, type StandingsPage } from './scrape';
import type { Schedule } from './schedule';
import { isKnownTeam } from './utils';

// Fixtures were captured from the live site on 2026-11-15 (JST).
beforeAll(() => {
	vitest.spyOn(globalThis.Date, 'now').mockImplementation(() => new Date('2026-11-15T18:00:00+09:00').valueOf());
});
afterAll(() => {
	vitest.restoreAllMocks();
});

// Parse inside beforeAll (not the describe body) so it runs after the clock is mocked:
// fixture dates have no year, and the parser picks the year closest to "now".
describe('parseSchedules', () => {
	let schedules: Schedule[];
	beforeAll(() => {
		schedules = parseSchedules(scheduleHtml);
	});

	it('parses every visible match and skips hidden note rows', () => {
		expect(schedules).toHaveLength(10);
		expect(schedules.every(s => s.dateTime)).toBe(true);
	});

	it('parses teams and kick-off time (JST → HKT)', () => {
		expect(schedules[0]?.toJson()).toEqual({
			homeTeam: '曼城',
			awayTeam: '富咸',
			dateTime: '2026-11-21T20:30:00.000+08:00',
			status: null,
		});
	});

	it('keeps matches sorted by kick-off', () => {
		const times = schedules.map(s => s.dateTime!.toMillis());
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});
});

describe('parseStandings', () => {
	let standings: StandingsPage['standings'];
	let updatedAt: StandingsPage['updatedAt'];
	beforeAll(() => {
		({ standings, updatedAt } = parseStandings(standingsHtml));
	});

	it('parses all 20 teams with numeric columns', () => {
		expect(standings).toHaveLength(20);
		expect(standings[0]?.toJson()).toEqual({
			standing: 1,
			teamName: '痾仙奴',
			victoryPoint: 27,
			matchCount: 10,
			wonCount: 9,
			drawnCount: 0,
			lostCount: 1,
			goalPoint: 15,
			lostPoint: 5,
			pointDifference: 10,
		});
		expect(standings.every(s => Number.isFinite(s.victoryPoint))).toBe(true);
	});

	it('reads the update time as JST', () => {
		expect(updatedAt?.toISO()).toBe('2026-11-09T03:36:00.000+09:00');
	});
});

describe('team name map', () => {
	it('covers every team currently in the league', () => {
		const teams = parseStandings(standingsHtml).standings.map(s => s.teamName);
		expect(teams.filter(team => !isKnownTeam(team))).toEqual([]);
	});
});
