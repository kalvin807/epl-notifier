import { DateTime } from 'luxon';
import { parseNonStandardDateTime, convertTeamNameToZh } from './utils';
import * as cheerio from 'cheerio';

export class Schedule {
	homeTeam: string;
	awayTeam: string;
	dateTime: DateTime | null;
	status: string;

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
		this.status = this.extractStatus(data.eq(3));
	}

	private extractStatus(data: cheerio.Cheerio<cheerio.Element>): string {
		const status = data.find('p.sc-tableGame__status').text().trim();
		if (status) return status;

		const scoreDetail = data.find('p.sc-tableGame__scoreDetail').text().trim();
		if (scoreDetail) return scoreDetail;

		return '';
	}

	toJson(): Record<string, string | number> {
		return {
			homeTeam: convertTeamNameToZh(this.homeTeam),
			awayTeam: convertTeamNameToZh(this.awayTeam),
			dateTime: this.dateTime?.toLocaleString() || '',
			status: this.status,
		};
	}
}
