import { DateTime, Duration } from 'luxon';
import { Schedule } from './schedule';

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
} as Record<string, string>;

export const userAgent =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

export function convertTeamNameToZh(teamName: string): string {
	return teamJaZhMap[teamName] || teamName;
}

export function parseNonStandardDateTime(dateString: string): DateTime | null {
	// Assume current year
	const currentYear = DateTime.now().year;

	// Remove leading/trailing white space and split the input string by newline
	const parts = dateString
		.split('\n')
		.map(str => str.trim())
		.filter(Boolean);

	if (parts.length !== 2) {
		return null;
	}

	const [date, time] = parts;

	if (!date || !time) {
		return null;
	}

	const formattedDate = date.trim().replace(/[^0-9\/]/g, '');
	const fullDateString = `${currentYear}/${formattedDate}`;

	const timeParts = time.split(':').map(str => Number(str.trim()));

	if (timeParts.length !== 2 || timeParts.some(isNaN)) {
		return null;
	}

	const [hours, minutes] = timeParts;

	// it is always in JST
	let dt = DateTime.fromFormat(fullDateString, 'yyyy/M/d', {
		zone: 'Asia/Tokyo',
	});

	// If hours >= 24, add extra days and set the remaining hours
	if (hours! >= 24) {
		// Add days to the date for hours >= 24
		dt = dt.plus(Duration.fromObject({ days: Math.floor(hours! / 24) }));
		// Calculate the "real" hour within a 24-hour day
		const realHour = hours! % 24;
		// Add the real hour and minutes to the DateTime object
		dt = dt.set({ hour: realHour, minute: minutes });
	} else {
		// Add the real hour and minutes to the DateTime object
		dt = dt.set({ hour: hours, minute: minutes });
	}

	return dt.setZone('Asia/Hong_Kong');
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
