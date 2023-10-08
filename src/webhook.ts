export async function triggerDiscordWebhook(webhookUrl: string, payload: Record<string, unknown>) {
	try {
		console.log('Triggering Discord webhook', payload);
		await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
	} catch (e) {
		console.error(e);
	}
}
