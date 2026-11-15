// Vite/vitest `?raw` imports, used by tests to load HTML fixtures as strings.
declare module '*?raw' {
	const content: string;
	export default content;
}
