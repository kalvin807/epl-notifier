import { describe, it, expect } from 'vitest';
import { parseScore } from './schedule';

const scoreTestCases: {
	expected: string | null;
	input: string;
}[] = [
	{ input: '0 - \n        1', expected: '0-1' },
	{ input: '1 - \n        4', expected: '1-4' },
	{ input: '3\n         - 0', expected: '3-0' },
	{ input: '3\n         - 1', expected: '3-1' },
	{ input: '2\n         - 1', expected: '2-1' },
	{ input: '0 - 0', expected: '0-0' },
	{ input: '-', expected: null },
];

describe('parseScore', () => {
	scoreTestCases.forEach(({ expected, input }) => {
		it(`should parse ${input} to ${expected}`, () => {
			const result = parseScore(input);
			expect(result).toBe(expected);
		});
	});
});
