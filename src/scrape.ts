import * as cheerio from 'cheerio/slim';
import { DateTime } from 'luxon';
import { Schedule } from './schedule';
import { Standing } from './standing';
import { sortSchedules, userAgent } from './utils';
import { log } from './log';

const BASE_URL = 'https://soccer.yahoo.co.jp/ws/category/eng';
export const SCHEDULE_URL = `${BASE_URL}/schedule/`;
export const STANDINGS_URL = `${BASE_URL}/standings`;

/** Thrown when Yahoo responds badly or the page no longer has the expected structure. */
export class ScrapeError extends Error {
	override name = 'ScrapeError';
}

async function fetchHtml(url: string): Promise<string> {
	const startedAt = Date.now();
	const response = await fetch(url, {
		headers: { 'user-agent': userAgent, 'accept': 'text/html' },
	});
	const body = await response.text();
	log(response.ok ? 'info' : 'error', 'fetch', {
		url,
		status: response.status,
		bytes: body.length,
		ms: Date.now() - startedAt,
	});
	if (!response.ok) {
		throw new ScrapeError(`GET ${url} responded ${response.status}`);
	}
	return body;
}

/** Pure parser for the schedule page; exported for fixture tests. */
export function parseSchedules(html: string): Schedule[] {
	const $ = cheerio.load(html);
	const rows = $('table.sc-tableGame tbody tr')
		.toArray()
		// note rows between matches are hidden with `display: table-column`
		.filter(row => !($(row).attr('style') ?? '').includes('display: table-column'));
	return sortSchedules(rows.map(row => new Schedule(row)));
}

export interface StandingsPage {
	standings: Standing[];
	/** When Yahoo last updated the table, or null if it could not be parsed. */
	updatedAt: DateTime | null;
}

/** Pure parser for the standings page; exported for fixture tests. */
export function parseStandings(html: string): StandingsPage {
	const $ = cheerio.load(html);
	const standings = $('div#stand tbody tr')
		.toArray()
		.map(tr => new Standing(tr));

	// e.g. `2023/9/3 3:35`, shown in JST
	const updatedAtRaw = $('time.sc-tableNote__update').first().text().trim();
	const updatedAt = DateTime.fromFormat(updatedAtRaw, 'yyyy/M/d H:mm', { zone: 'Asia/Tokyo' });

	return { standings, updatedAt: updatedAt.isValid ? updatedAt : null };
}

export async function getSchedules(): Promise<Schedule[]> {
	const schedules = parseSchedules(await fetchHtml(SCHEDULE_URL));
	const undated = schedules.filter(s => !s.dateTime).length;
	log(undated ? 'warn' : 'info', 'parse_schedule', { rows: schedules.length, undated });
	if (!schedules.length) {
		throw new ScrapeError('Schedule page parsed to 0 matches; the page layout may have changed');
	}
	return schedules;
}

export async function getStandings(): Promise<StandingsPage> {
	const page = parseStandings(await fetchHtml(STANDINGS_URL));
	log('info', 'parse_standings', { rows: page.standings.length, updatedAt: page.updatedAt?.toISO() ?? null });
	if (!page.standings.length) {
		throw new ScrapeError('Standings page parsed to 0 rows; the page layout may have changed');
	}
	return page;
}
