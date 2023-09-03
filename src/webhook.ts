import { Schedule } from './schedule';
import { convertTeamNameToZh } from './utils';

function buildNextMatchMessage(nextMatch: Schedule): string {
	const { homeTeam, awayTeam, dateTime } = nextMatch;
	if (!dateTime) return '';
	// convert JST to HKT
	const dateTimeHKT = dateTime.setZone('Asia/Hong_Kong');
	return `Next match: ${convertTeamNameToZh(homeTeam)} vs ${convertTeamNameToZh(
		awayTeam
	)} at ${dateTimeHKT.toLocaleString()}`;
}

export async function triggerDiscordWebhook(
	webhookUrl: string,
	nextMatch: Schedule,
	allMatches: Schedule[]
) {
	const fields = allMatches
		.toSorted((a, b) => {
			if (!a.dateTime || !b.dateTime) return 0;
			return a.dateTime.millisecond - b.dateTime.millisecond;
		})
		.map(match => {
			const { homeTeam, awayTeam, dateTime } = match;
			if (!dateTime) return;
			// convert JST to HKT
			const dateTimeHKT = dateTime.setZone('Asia/Hong_Kong');
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
