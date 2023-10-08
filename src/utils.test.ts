import { describe, expect, it, beforeAll, afterAll, vitest } from 'vitest';
import { parseNonStandardDateTime, sortSchedules } from './utils';
import { Schedule } from './schedule';
import { DateTime } from 'luxon';

const testCase: {
	expected: string;
	input: string;
}[] = [
	{
		input: '10/7（土）\n                  \n                  20:30',
		expected: '2023-10-07T19:30:00.000+08:00',
	},
	{
		input: '10/7（土）\n                  \n                  23:00',
		expected: '2023-10-07T22:00:00.000+08:00',
	},
	{
		input: '10/7（土）\n                  \n                  25:30',
		expected: '2023-10-08T00:30:00.000+08:00', // Corrected to next day and adjusted the time
	},
	{
		input: '10/8（日）\n                  \n                  22:00',
		expected: '2023-10-08T21:00:00.000+08:00',
	},
	{
		input: '10/8（日）\n                  \n                  24:30',
		expected: '2023-10-08T23:30:00.000+08:00',
	},
];

describe('parseNonStandardDateTime', () => {
	beforeAll(() => {
		// lock date to 2023-10-01T00:00:00.000+09:00
		vitest
			.spyOn(global.Date, 'now')
			.mockImplementation(() => new Date('2023-10-01T00:00:00.000+09:00').valueOf());
	});

	afterAll(() => {
		vitest.restoreAllMocks();
	});

	testCase.forEach(({ expected, input }) => {
		it(`should parse ${input} to ${expected}`, () => {
			const result = parseNonStandardDateTime(input);
			// enforce timezone to Asia/Hong_Kong for testing
			expect(result?.setZone('Asia/Hong_Kong').toISO()).toBe(expected);
		});
	});
});

describe('sortSchedules', () => {
	it('should sort schedules by date time', () => {
		const testCase = [
			{
				homeTeam: 'エヴァートン',
				awayTeam: 'ボーンマス',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '3-0',
			},
			{
				homeTeam: 'フラム',
				awayTeam: 'シェフィールド・U',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '3-1',
			},
			{
				homeTeam: 'マンチェスター・U',
				awayTeam: 'ブレントフォード',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '2-1',
			},
			{
				homeTeam: 'クリスタル・パレス',
				awayTeam: 'フォレスト',
				dateTime: '2023-10-08T00:30:00.000+08:00',
				score: '0-0',
			},
			{
				homeTeam: 'ブライトン',
				awayTeam: 'リヴァプール',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'ウェストハム',
				awayTeam: 'ニューカッスル',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'ウルヴァーハンプトン',
				awayTeam: 'アストン・ヴィラ',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'アーセナル',
				awayTeam: 'マンチェスター・C',
				dateTime: '2023-10-08T23:30:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'ルートンタウン',
				awayTeam: 'トッテナム',
				dateTime: '2023-10-07T19:30:00.000+08:00',
				score: '0-1',
			},
			{
				homeTeam: 'バーンリー',
				awayTeam: 'チェルシー',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '1-4',
			},
		];
		const expectedOut = [
			{
				homeTeam: 'ルートンタウン',
				awayTeam: 'トッテナム',
				dateTime: '2023-10-07T19:30:00.000+08:00',
				score: '0-1',
			},

			{
				homeTeam: 'エヴァートン',
				awayTeam: 'ボーンマス',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '3-0',
			},
			{
				homeTeam: 'バーンリー',
				awayTeam: 'チェルシー',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '1-4',
			},
			{
				homeTeam: 'フラム',
				awayTeam: 'シェフィールド・U',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '3-1',
			},

			{
				homeTeam: 'マンチェスター・U',
				awayTeam: 'ブレントフォード',
				dateTime: '2023-10-07T22:00:00.000+08:00',
				score: '2-1',
			},
			{
				homeTeam: 'クリスタル・パレス',
				awayTeam: 'フォレスト',
				dateTime: '2023-10-08T00:30:00.000+08:00',
				score: '0-0',
			},

			{
				homeTeam: 'ウェストハム',
				awayTeam: 'ニューカッスル',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'ウルヴァーハンプトン',
				awayTeam: 'アストン・ヴィラ',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'ブライトン',
				awayTeam: 'リヴァプール',
				dateTime: '2023-10-08T21:00:00.000+08:00',
				score: null,
			},
			{
				homeTeam: 'アーセナル',
				awayTeam: 'マンチェスター・C',
				dateTime: '2023-10-08T23:30:00.000+08:00',
				score: null,
			},
		];
		const expected = expectedOut.map(({ homeTeam, awayTeam, dateTime, score }) =>
			new Schedule('').setFields(homeTeam, awayTeam, DateTime.fromISO(dateTime), score)
		);
		const schedules = testCase.map(({ homeTeam, awayTeam, dateTime, score }) =>
			new Schedule('').setFields(homeTeam, awayTeam, DateTime.fromISO(dateTime), score)
		);

		const result = sortSchedules(schedules);
		expect(result).toEqual(expected);
	});
});
