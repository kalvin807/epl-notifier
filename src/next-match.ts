import { DateTime } from 'luxon';
import { Schedule } from './schedule';
import { timeDiffInMinutesTZSafe } from './utils';

export const filterNextMatches = (matches: Schedule[], bufferTime: number): Schedule[] => {
	const now = DateTime.now();

	return matches.filter(match => {
		if (!match.dateTime) return false;
		const diff = timeDiffInMinutesTZSafe(match.dateTime, now, 'Asia/Tokyo');
		return diff > 0 && diff <= bufferTime;
	});
};
