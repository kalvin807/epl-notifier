type Level = 'info' | 'warn' | 'error';

/**
 * Structured log line. Workers Logs indexes the fields of logged objects,
 * so events can be filtered in the dashboard (e.g. `event = "unmapped_team"`).
 */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
	const entry = { level, event, ...fields };
	if (level === 'error') console.error(entry);
	else if (level === 'warn') console.warn(entry);
	else console.log(entry);
}

export function errorFields(e: unknown): Record<string, unknown> {
	return e instanceof Error ? { error: e.message, stack: e.stack } : { error: String(e) };
}
