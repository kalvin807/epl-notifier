export async function triggerDiscordWebhook(webhookUrl: string, payload: Record<string, unknown>) {
	fetch(webhookUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify(payload),
	});
}
