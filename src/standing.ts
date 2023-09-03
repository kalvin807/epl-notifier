import * as cheerio from 'cheerio';
import { convertTeamNameToZh } from './utils';

/**
 * sc-tableValue__data in following order
 *  standing 0 順位
 *  changes 1
 *  team_name 2 チーム名
 *  victory_point 3 勝点
 *  match_count 4 試合数
 *  won_count 5 勝数
 *  drawn_count 6 引分数
 *  lost_count 7 敗数
 *  goal_point 8 得点
 *  lost_point 9 失点
 *  point_difference 10 得失点差
 */
export class Standing {
	standing: number;
	teamName: string;
	victoryPoint: number;
	matchCount: number;
	wonCount: number;
	drawnCount: number;
	lostCount: number;
	goalPoint: number;
	lostPoint: number;
	pointDifference: number;

	constructor(selector: cheerio.Element | string) {
		const data = cheerio.load(selector)('td');
		this.standing = Number(data.eq(0).text().trim());
		this.teamName = data.eq(2).text().trim();
		this.victoryPoint = Number(data.eq(3).text().trim());
		this.matchCount = Number(data.eq(4).text().trim());
		this.wonCount = Number(data.eq(5).text().trim());
		this.drawnCount = Number(data.eq(6).text().trim());
		this.lostCount = Number(data.eq(7).text().trim());
		this.goalPoint = Number(data.eq(8).text().trim());
		this.lostPoint = Number(data.eq(9).text().trim());
		this.pointDifference = Number(data.eq(10).text().trim());
	}

	toJson(): Record<string, string | number> {
		return {
			standing: this.standing,
			teamName: convertTeamNameToZh(this.teamName),
			victoryPoint: this.victoryPoint,
			matchCount: this.matchCount,
			wonCount: this.wonCount,
			drawnCount: this.drawnCount,
			lostCount: this.lostCount,
			goalPoint: this.goalPoint,
			lostPoint: this.lostPoint,
			pointDifference: this.pointDifference,
		};
	}
}
