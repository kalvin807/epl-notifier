import { ExecutionContext } from '@cloudflare/workers-types/experimental';
import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { sortSchedules, userAgent } from './utils';
import { Schedule, buildSchedulesAsDiscordEmbed } from './schedule';
import { Standing } from './standing';
import { triggerDiscordWebhook } from './webhook';
import { filterNextMatches } from './next-match';

export interface Env {
	DISCORD_WEBHOOK_URL: string;
	NEXT_MATCH_BUFFER_MINUTES: string;
}

function jsonResponse(jsonString: string): Response {
	return new Response(jsonString, {
		headers: {
			'content-type': 'application/json;charset=UTF-8',
		},
	});
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

	return sortSchedules(schedules);
}

function buildNextMatchMessage(nextMatches: Schedule[]): string {
	if (!nextMatches.length) return '';
	const nextMatchMsg = nextMatches
		.map(match => {
			const { homeTeam, awayTeam } = match;
			return `主 ${homeTeam} vs ${awayTeam} 客`;
		})
		.join(' / ');
	const dateTime = nextMatches[0]?.dateTime;
	if (!dateTime) return nextMatchMsg; // should not happen

	const timeDiffFromNowInMinute = dateTime.diffNow('minutes').minutes;
	const message = `${timeDiffFromNowInMinute}m 後: ${nextMatchMsg}`;

	return message;
}

async function triggerNextMatchMessage(env: Env): Promise<void> {
	const bufferInMinutes = parseInt(env.NEXT_MATCH_BUFFER_MINUTES, 10);
	if (isNaN(bufferInMinutes)) {
		throw new Error(`Failed to parse NEXT_MATCH_BUFFER_MINUTES ${env.NEXT_MATCH_BUFFER_MINUTES}`);
	}

	const schedules = await getSchedule();
	if (!schedules) {
		throw new Error('Failed to parse matches');
	}

	const nextMatches = filterNextMatches(schedules, bufferInMinutes);
	if (nextMatches.length === 0) {
		return;
	}

	const payload = {
		message: buildNextMatchMessage(nextMatches),
		embeds: [
			{
				title: '今期賽事',
				color: 0x0099ff,
				fields: buildSchedulesAsDiscordEmbed(schedules),
			},
		],
	};

	await triggerDiscordWebhook(env.DISCORD_WEBHOOK_URL, payload);
}

async function getScheduleResp(env: Env): Promise<Response> {
	const bufferInMinutes = parseInt(env.NEXT_MATCH_BUFFER_MINUTES, 10);
	if (isNaN(bufferInMinutes)) {
		throw new Error(`Failed to parse NEXT_MATCH_BUFFER_MINUTES ${env.NEXT_MATCH_BUFFER_MINUTES}`);
	}
	const schedules = await getSchedule();
	if (!schedules) return new Response('Failed to parse matches');

	return jsonResponse(
		JSON.stringify({
			nextMatch: filterNextMatches(schedules, bufferInMinutes),
			schedule: schedules.map(schedule => schedule.toJson()),
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

	return jsonResponse(
		JSON.stringify({
			standing: rows.map(row => row.toJson()),
			updatedAt: updatedAtDate.setZone('Asia/Hong_Kong').toLocaleString(),
		})
	);
}

async function route(path: string, env: Env, _ctx: ExecutionContext): Promise<Response> {
	switch (path) {
		case '/upnext':
			await triggerNextMatchMessage(env);
			return new Response('ok');
		case '/schedule':
			return await getScheduleResp(env);
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
