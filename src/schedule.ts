import { DateTime } from 'luxon';
import * as cheerio from 'cheerio/slim';
import type { Element } from 'domhandler';
import { parseNonStandardDateTime, convertTeamNameToZh } from './utils';

/** `"2 - \n 1"` → `"2-1"`; returns null for an unplayed match (`"-"`). */
export const parseScore = (scoreDetailRaw: string): string | null => {
	const scoreBreakdown = scoreDetailRaw
		.split('-')
		.map(str => str.trim())
		.filter(str => str !== '');
	if (scoreBreakdown.length !== 2) return null;
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
	constructor(row: Element | string) {
		const cells = cheerio.load(row)('td');
		this.dateTime = parseNonStandardDateTime(cells.eq(0).text().trim());
		this.homeTeam = convertTeamNameToZh(cells.eq(2).text().trim());
		this.awayTeam = convertTeamNameToZh(cells.eq(4).text().trim());
		this.score = parseScore(cells.eq(3).find('p.sc-tableGame__scoreDetail').text().trim());
	}

	/** Shape served by `/schedule`; keep stable for API consumers. */
	toJson(): Record<string, string | number | null | undefined> {
		return {
			homeTeam: this.homeTeam,
			awayTeam: this.awayTeam,
			dateTime: this.dateTime?.toJSON(),
			status: this.score,
		};
	}

	/** internal use */
	setFields(homeTeam: string, awayTeam: string, dateTime: DateTime, score: string | null): Schedule {
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		this.dateTime = dateTime;
		this.score = score;
		return this;
	}
}
