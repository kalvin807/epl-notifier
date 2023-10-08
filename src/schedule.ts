import { DateTime } from 'luxon';
import { parseNonStandardDateTime, convertTeamNameToZh } from './utils';
import * as cheerio from 'cheerio';

export const parseScore = (scoreDetailRaw: string): string | null => {
	const scoreBreakdown = scoreDetailRaw
		.split('-')
		.map(str => str.trim())
		.filter(str => str !== '');
	if (!scoreBreakdown || scoreBreakdown.length !== 2) return null;
	return scoreBreakdown.join('-');
};

export class Schedule {
	homeTeam: string;
	awayTeam: string;
	dateTime: DateTime | null;
	score: string | null;

	/**
	 * td in following order
	 *  日時
	 *  種別
	 *  ホーム
	 *  スコア
	 *     |- sc-tableGame__scoreDetail
	 *     |- sc-tableGame__status
	 *  アウェイ
	 */
	constructor(selector: cheerio.Element | string) {
		const data = cheerio.load(selector)('td');
		const dateTimeStr = data.eq(0).text().trim();
		this.dateTime = parseNonStandardDateTime(dateTimeStr);
		this.homeTeam = data.eq(2).text().trim();
		this.awayTeam = data.eq(4).text().trim();
		this.score = this.extractStatus(data.eq(3));
	}

	private extractStatus(data: cheerio.Cheerio<cheerio.Element>): string | null {
		const scoreDetailRaw = data.find('p.sc-tableGame__scoreDetail').text().trim();
		const score = parseScore(scoreDetailRaw);
		return score;
	}

	toJson(): Record<string, string | number | null | undefined> {
		return {
			homeTeam: convertTeamNameToZh(this.homeTeam),
			awayTeam: convertTeamNameToZh(this.awayTeam),
			dateTime: this.dateTime?.toJSON(),
			status: this.score,
		};
	}

	setFields(
		homeTeam: string,
		awayTeam: string,
		dateTime: DateTime,
		score: string | null
	): Schedule {
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		this.dateTime = dateTime;
		this.score = score;
		return this;
	}
}

export const buildSchedulesAsDiscordEmbed = (schedules: Schedule[]): Record<string, unknown>[] => {
	const payload = schedules.map(s => {
		const { homeTeam, awayTeam, dateTime, score } = s;
		if (!dateTime) return null;
		return {
			name: `${convertTeamNameToZh(homeTeam)} vs ${convertTeamNameToZh(awayTeam)}`,
			value: score ? score : dateTime.toFormat('MM/dd HH:mm'),
			inline: false,
		};
	});

	return payload.filter((o): o is Exclude<typeof o, null> => o !== null);
};
