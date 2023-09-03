import * as cheerio from 'cheerio';

const teamJaZhMap = {
	'ルートンタウン': '盧頓',
	'ブライトン': '白禮頓',
	'ニューカッスル': '鈕卡素',
	'クリスタル・パレス': '水晶宮',
	'ウルヴァーハンプトン': '狼隊',
	'リヴァプール': '痢物浦',
	'アストン・ヴィラ': '維拉',
	'アーセナル': '痾仙奴',
	'マンチェスター・U': '獌聯',
	'ウェストハム': '西咸',
	'シェフィールド・U': '錫菲聯',
	'エヴァートン': '愛華頓',
	'ブレントフォード': '賓福特',
	'ボーンマス': '般茅',
	'バーンリー': '般尼',
	'トッテナム': '熱刺',
	'チェルシー': '車路士',
	'フォレスト': '諾定咸',
	'マンチェスター・C': '曼城',
	'フラム': '富咸',
} as Record<string, string>;

class Match {
	homeTeam: string;
	awayTeam: string;
	dateTime: Date | null;

	constructor(homeTeam: string, awayTeam: string, dateTimeRawStr: string) {
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		this.dateTime = this.parseCustomDate(dateTimeRawStr);
	}

	// Example 9/1（金）28:00
	parseCustomDate(str: string): Date | null {
		const dateMatch = str.match(/(\d+)\/(\d+)（.+）(\d+):(\d+)/);
		if (!dateMatch) return null;

		const [_1, monthStr, dayStr, hoursStr, minutesStr] = dateMatch;

		const month = Number(monthStr);
		const day = Number(dayStr);
		const hours = Number(hoursStr);
		const minutes = Number(minutesStr);

		if (isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return null;

		const now = new Date();
		const parsedDate = new Date(now.getFullYear(), month - 1, day);

		parsedDate.setDate(parsedDate.getDate() + Math.floor(hours / 24));
		parsedDate.setHours(hours % 24, minutes);

		return parsedDate;
	}
}

function convertTZ(date: Date, tzString: string) {
	return new Date(
		date.toLocaleString('en-US', {
			timeZone: tzString,
		})
	);
}

function convertTeamNameToZh(teamName: string): string {
	return teamJaZhMap[teamName] || teamName;
}

function buildNextMatchMessage(nextMatch: Match): string {
	const { homeTeam, awayTeam, dateTime } = nextMatch;
	if (!dateTime) return '';
	// convert JST to HKT
	const dateTimeHKT = convertTZ(dateTime, 'Asia/Hong_Kong');
	return `Next match: ${convertTeamNameToZh(homeTeam)} vs ${convertTeamNameToZh(
		awayTeam
	)} at ${dateTimeHKT.toLocaleString()}`;
}

async function triggerDiscordWebhook(webhookUrl: string, nextMatch: Match, allMatches: Match[]) {
	const fields = allMatches
		.toSorted((a, b) => {
			if (!a.dateTime || !b.dateTime) return 0;
			return a.dateTime.getTime() - b.dateTime.getTime();
		})
		.map(match => {
			const { homeTeam, awayTeam, dateTime } = match;
			if (!dateTime) return;
			// convert JST to HKT
			const dateTimeHKT = convertTZ(dateTime, 'Asia/Hong_Kong');
			return {
				name: `${convertTeamNameToZh(homeTeam)} vs ${convertTeamNameToZh(awayTeam)}`,
				value: dateTimeHKT.toLocaleString(),
				inline: true,
			};
		});

	const embedTable = {
		title: 'Upcoming matches',
		color: 0x0099ff,
		fields,
	};

	fetch(webhookUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			content: buildNextMatchMessage(nextMatch),
			embeds: [embedTable],
		}),
	});
}
const userAgent =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

async function run(env: Env): Promise<void> {
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

	const matches = filteredMatchesArray
		.map(element => {
			const dateElement = $(element).find('.sc-tableGame__data--date');
			const datetimeStr = dateElement.text().replace(/\s/g, '').trim();
			const teamElements = $(element).find('.sc-tableGame__team span');
			const [homeTeam, awayTeam] = $(teamElements).text().trim().split(/\s+/);
			if (!homeTeam || !awayTeam) return;
			return new Match(homeTeam, awayTeam, datetimeStr);
		})
		.reduce((acc, match) => {
			if (!match) return acc;
			acc.push(match);
			return acc;
		}, [] as Match[]);

	if (!matches) return;

	// filter matches that is starting in 5 minutes
	const filteredMatches = matches.filter(match => {
		if (!match || !match.dateTime) return false;
		const now = new Date();
		const diff = match.dateTime.getTime() - now.getTime();
		return diff > 0 && diff < 31 * 60 * 1000;
	});

	const nextMatch = filteredMatches[0];
	if (!nextMatch) return;
	triggerDiscordWebhook(env.DISCORD_WEBHOOK_URL, nextMatch, matches);
}

export interface Env {
	DISCORD_WEBHOOK_URL: string;
}

export default {
	async fetch(_request: Request, env: Env) {
		try {
			await run(env);
			return new Response('ok');
		} catch (e) {
			console.error(e);
			return new Response(`error ${e}`, { status: 500 });
		}
	},
	async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
		return ctx.waitUntil(run(env));
	},
};
