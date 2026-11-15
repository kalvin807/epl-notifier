import { DateTime, Duration } from 'luxon';
import { Schedule } from './schedule';
import { log } from './log';

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
	'チェルシー': '印度火車',
	'フォレスト': '諾定咸',
	'マンチェスター・C': '曼城',
	'フラム': '富咸',
	'イプスウィッチ': '葉士域G',
	'サウサンプトン': '修咸頓',
	'レスター': '李城',
	'サンダーランド': '新特蘭',
	'リーズ': '列斯聯',
	'ハル・C': '侯城',
	'コベントリー・C': '高雲地利',
	'ブライトン・アンド・ホーヴ・アルビオン': '白禮頓',
	'マンチェスター・ユナイテッド': '獌聯',
	'ニューカッスル・ユナイテッド': '鈕卡素',
	'ノッティンガム・フォレスト': '諾定咸',
	'レスター・シティ': '李城',
	'マンチェスター・シティ': '曼城',
	'トッテナム・ホットスパー': '熱刺',
	'ウェストハム・ユナイテッド': '西咸',
	'イプスウィッチ・タウン': '葉士域G',
	'ウルヴァーハンプトン・ワンダラーズ': '狼隊',
	'リーズ・ユナイテッド': '列斯聯',
	'ハル・シティ': '侯城',
	'コベントリー・シティ': '高雲地利',
} as Record<string, string>;

export const userAgent =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

export function isKnownTeam(teamName: string): boolean {
	return teamName in teamJaZhMap;
}

// Warn once per isolate per name, so a newly promoted team shows up in Workers Logs
// instead of silently leaking Japanese names into Discord.
const warnedUnmapped = new Set<string>();

export function convertTeamNameToZh(teamName: string): string {
	const zh = teamJaZhMap[teamName];
	if (zh) return zh;
	if (teamName && !warnedUnmapped.has(teamName)) {
		warnedUnmapped.add(teamName);
		log('warn', 'unmapped_team', { team: teamName });
	}
	return teamName;
}

const TZ_SOURCE = 'Asia/Tokyo';
const TZ_OUTPUT = 'Asia/Hong_Kong';

/**
 * Parse Yahoo's schedule cell, e.g. `11/21（土）\n<br>\n24:30` (JST, hours may exceed 24).
 * The page omits the year, so pick whichever of last/this/next year lands closest to now;
 * this keeps late-December pages listing `1/3` and early-January pages listing `12/30` correct.
 */
export function parseNonStandardDateTime(dateString: string): DateTime | null {
	const parts = dateString
		.split('\n')
		.map(str => str.trim())
		.filter(Boolean);
	if (parts.length !== 2) return null;

	const dateMatch = /^(\d{1,2})\/(\d{1,2})/.exec(parts[0]!);
	const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(parts[1]!);
	if (!dateMatch || !timeMatch) return null;

	const [month, day, hours, minutes] = [dateMatch[1], dateMatch[2], timeMatch[1], timeMatch[2]].map(Number) as [
		number,
		number,
		number,
		number,
	];

	const now = DateTime.now().setZone(TZ_SOURCE);
	const candidates = [now.year - 1, now.year, now.year + 1]
		.map(year =>
			DateTime.fromObject({ year, month, day }, { zone: TZ_SOURCE }).plus(Duration.fromObject({ hours, minutes }))
		)
		.filter(dt => dt.isValid);
	if (!candidates.length) return null;

	const closest = candidates.reduce((best, dt) =>
		Math.abs(dt.diff(now).toMillis()) < Math.abs(best.diff(now).toMillis()) ? dt : best
	);
	return closest.setZone(TZ_OUTPUT);
}

/**
 * `a - b` in minutes round to the nearest integer sync to same timezone
 */
export const timeDiffInMinutesTZSafe = (a: DateTime, b: DateTime, tz: string): number => {
	a = a.setZone(tz);
	b = b.setZone(tz);
	const diff = a.diff(b, 'minutes');
	return Math.round(diff.minutes);
};

export const sortSchedules = (unsorted: Schedule[]): Schedule[] => {
	return [...unsorted].sort((a, b) => {
		if (!(a.dateTime && b.dateTime)) {
			return 0;
		}
		const diffInSeconds = a.dateTime.diff(b.dateTime, 'seconds');
		return diffInSeconds?.seconds || a.homeTeam.localeCompare(b.homeTeam);
	});
};
