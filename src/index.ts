import { ExecutionContext } from '@cloudflare/workers-types/experimental';
import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { userAgent } from './utils';
import { Schedule } from './schedule';
import { Standing } from './standing';
import { triggerDiscordWebhook } from './webhook';

export interface Env {
	DISCORD_WEBHOOK_URL: string;
}

async function getSchedule(): Promise<Schedule[]> {
	const response = await fetch('https://soccer.yahoo.co.jp/ws/category/eng/schedule/', {
		headers: {
			'user-agent': userAgent,
			'accept': 'text/html',
		},
	});
	const htmlString = await response.text();
	const $ = cheerio.load(htmlString);
	const currentMatchesTable = $('table.sc-tableGame tbody tr');
	const currentMatchesArray = currentMatchesTable.toArray();

	// filter away tr with style display: table-column;
	const filteredMatchesArray = currentMatchesArray.filter(match => {
		const style = $(match).attr('style');
		return !style || !style.includes('display: table-column;');
	});

	const schedules: Schedule[] = [];
	filteredMatchesArray.forEach(element => {
		try {
			schedules.push(new Schedule(element));
		} catch (e) {
			console.error(e);
		}
	});

	return schedules.toSorted((a, b) => {
		if (!a.dateTime || !b.dateTime) return 0;
		return a.dateTime.millisecond - b.dateTime.millisecond;
	});
}

async function triggerNextMatchMessage(env: Env): Promise<void> {
	const schedules = await getSchedule();
	if (!schedules) return;

	const nextMatch = schedules.find(match => {
		if (!match || !match.dateTime) return false;
		const now = new Date();
		const diff = match.dateTime.toMillis() - now.getTime();
		return diff > 0 && diff < 31 * 60 * 1000;
	});

	if (!nextMatch) {
		console.log('no next match');
		return;
	}
	console.log('next match', nextMatch.toJson());

	await triggerDiscordWebhook(env.DISCORD_WEBHOOK_URL, nextMatch, schedules);
}

async function getScheduleResp(): Promise<Response> {
	const schedules = await getSchedule();
	if (!schedules) return new Response('Failed to parse matches');

	return new Response(
		JSON.stringify({
			schedule: schedules.map(s => s.toJson()),
		})
	);
}

async function getStandingResp(): Promise<Response> {
	const response = await fetch('https://soccer.yahoo.co.jp/ws/category/eng/standings', {
		headers: {
			'user-agent': userAgent,
			'accept': 'text/html',
		},
	});
	const htmlString = await response.text();
	const $ = cheerio.load(htmlString);
	const standingTable = $('div#stand tbody');

	const rows: Standing[] = [];

	standingTable.find('tr').each((_, tr) => {
		const standing = new Standing(tr);
		rows.push(standing);
	});

	const updatedAt = $('time.sc-tableNote__update').text().trim();
	// 2023/9/3 3:35
	const updatedAtDate = DateTime.fromFormat(updatedAt, 'yyyy/M/d H:mm');

	return new Response(
		JSON.stringify({
			standing: rows.map(row => row.toJson()),
			updatedAt: updatedAtDate,
		})
	);
}

async function route(path: string, env: Env, _ctx: ExecutionContext): Promise<Response> {
	switch (path) {
		case '/upnext':
			await triggerNextMatchMessage(env);
			return new Response('ok');
		case '/schedule':
			return await getScheduleResp();
		case '/standing':
			return await getStandingResp();
		default:
			return new Response('Not found', { status: 404 });
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		if (request.method !== 'GET') {
			return new Response('Not found', { status: 404 });
		}

		try {
			const path = new URL(request.url).pathname;
			return await route(path, env, ctx);
		} catch (e) {
			console.error(e);
			return new Response(`error ${e}`, { status: 500 });
		}
	},
	async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
		return ctx.waitUntil(triggerNextMatchMessage(env));
	},
};
