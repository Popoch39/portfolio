// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Provisional: no production domain yet. Canonical URLs, Open Graph, the sitemap and the
	// JSON-LD all derive from it, so it must be replaced before going live.
	site: 'https://louis-pocheron.example',
	// A single page of about 10 KB of CSS: inlined, it no longer blocks the first paint on a request.
	build: { inlineStylesheets: 'always' },
	// Subsets built by `scripts/fonts.sh` (ADR 0002).
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Archivo',
			cssVariable: '--font-sans',
			fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
			options: {
				variants: [
					{
						weight: '400 900',
						stretch: '62% 100%',
						style: 'normal',
						src: ['./src/assets/fonts/archivo-variable.woff2'],
					},
					{
						weight: 400,
						style: 'italic',
						src: ['./src/assets/fonts/archivo-italic-400.woff2'],
					},
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: 'Fragment Mono',
			cssVariable: '--font-mono',
			fallbacks: ['ui-monospace', 'Menlo', 'monospace'],
			options: {
				variants: [
					{
						weight: 400,
						style: 'normal',
						src: ['./src/assets/fonts/fragment-mono-400.woff2'],
					},
				],
			},
		},
	],
});
