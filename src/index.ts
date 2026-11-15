import { filterNextMatches } from './next-match';
import { buildUpNextPayload, sendDiscordWebhook } from './discord';
import { getSchedules, getStandings } from './scrape';
import { isKnownTeam } from './utils';
import { errorFields, log } from './log';

export interface Env {
	DISCORD_WEBHOOK_URL: string;
	NEXT_MATCH_BUFFER_MINUTES: string;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json;charset=UTF-8' },
	});
}

function bufferMinutes(env: Env): number {
	const minutes = parseInt(env.NEXT_MATCH_BUFFER_MINUTES, 10);
	if (isNaN(minutes) || minutes <= 0) {
		throw new Error(`Invalid NEXT_MATCH_BUFFER_MINUTES: ${env.NEXT_MATCH_BUFFER_MINUTES}`);
	}
	return minutes;
}

/** Posts to Discord when a match kicks off within the buffer window. */
async function notifyUpNext(env: Env): Promise<void> {
	const schedules = await getSchedules();
	const nextMatches = filterNextMatches(schedules, bufferMinutes(env));
	if (!nextMatches.length) {
		log('info', 'upnext_skipped', { reason: 'no match within buffer', matches: schedules.length });
		return;
	}
	await sendDiscordWebhook(env.DISCORD_WEBHOOK_URL, buildUpNextPayload(nextMatches, schedules));
}

async function scheduleResponse(env: Env): Promise<Response> {
	const schedules = await getSchedules();
	return json({
		nextMatch: filterNextMatches(schedules, bufferMinutes(env)),
		schedule: schedules.map(schedule => schedule.toJson()),
	});
}

async function standingResponse(): Promise<Response> {
	const { standings, updatedAt } = await getStandings();
	return json({
		standing: standings.map(row => row.toJson()),
		updatedAt: updatedAt?.setZone('Asia/Hong_Kong').toLocaleString() ?? null,
	});
}

/** Scrapes both pages and reports whether the output looks sane. 503 when it does not. */
async function healthResponse(): Promise<Response> {
	const [schedule, standings] = await Promise.allSettled([getSchedules(), getStandings()]);
	const teams = standings.status === 'fulfilled' ? standings.value.standings.map(s => s.teamName) : [];
	const unmappedTeams = teams.filter(team => !isKnownTeam(team));
	const failure = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? String(r.reason) : null);

	const report = {
		ok: schedule.status === 'fulfilled' && standings.status === 'fulfilled' && unmappedTeams.length === 0,
		schedule:
			schedule.status === 'fulfilled'
				? { matches: schedule.value.length, undated: schedule.value.filter(s => !s.dateTime).length }
				: { error: failure(schedule) },
		standings:
			standings.status === 'fulfilled'
				? { rows: standings.value.standings.length, updatedAt: standings.value.updatedAt?.toISO() ?? null }
				: { error: failure(standings) },
		unmappedTeams,
		checkedAt: new Date().toISOString(),
	};
	return json(report, report.ok ? 200 : 503);
}

async function route(path: string, env: Env): Promise<Response> {
	switch (path) {
		case '/upnext':
			await notifyUpNext(env);
			return new Response('ok');
		case '/schedule':
			return scheduleResponse(env);
		case '/standing':
			return standingResponse();
		case '/health':
			return healthResponse();
		default:
			return new Response('Not found', { status: 404 });
	}
}

export default {
	async fetch(request, env) {
		if (request.method !== 'GET') {
			return new Response('Not found', { status: 404 });
		}
		const path = new URL(request.url).pathname;
		try {
			return await route(path, env);
		} catch (e) {
			log('error', 'request_failed', { path, ...errorFields(e) });
			return new Response(`error ${e}`, { status: 500 });
		}
	},

	// Awaited (not waitUntil) so a failure marks the cron invocation as failed in the dashboard.
	async scheduled(controller, env) {
		try {
			await notifyUpNext(env);
		} catch (e) {
			log('error', 'cron_failed', { cron: controller.cron, ...errorFields(e) });
			throw e;
		}
	},
} satisfies ExportedHandler<Env>;
