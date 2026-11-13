// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Canonical URLs, Open Graph, the sitemap and the JSON-LD all derive from it.
	site: 'https://louis-pocheron.com',
	// A single page of about 10 KB of CSS: inlined, it no longer blocks the first paint on a request.
	// `preserve`: `en/404.astro` gives `en/404.html`, the file Cloudflare serves for an unknown URL under
	// `/en/` (ADR 0011); `directory` would bury it in `en/404/index.html`. Index pages stay directories.
	build: { inlineStylesheets: 'always', format: 'preserve' },
	// Every page is a directory, and its URL says so, as Cloudflare serves it: `/`, `/en/`. Without it,
	// `preserve` would have `astro:i18n` drop the slash.
	trailingSlash: 'always',
	// French at `/`, English under `/en/`: the language is the URL and nothing else (ADR 0011).
	// Same order as `languages` (`src/i18n/lang.ts`).
	i18n: {
		locales: ['fr', 'en'],
		defaultLocale: 'fr',
		routing: { prefixDefaultLocale: false },
	},
	// A `<meta>` with the hashes of every script and style Astro emits. `frame-ancestors` is
	// ignored in a `<meta>`: it is sent as a header, with the other ones, by `public/_headers`.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				// The paper grain is an SVG data URI (`src/intro/grain.ts`).
				"img-src 'self' data:",
				"font-src 'self'",
				// The Formulaire du Café posts to the site's own Worker (`/api/contact`, ADR 0010); the
				// Web Analytics beacon reports to Cloudflare.
				"connect-src 'self' https://cloudflareinsights.com",
				"object-src 'none'",
				"base-uri 'self'",
				"form-action 'self'",
			],
			// The one third-party script, agreed on: Cloudflare Web Analytics, cookieless (`Layout.astro`).
			scriptDirective: {
				resources: ["'self'", 'https://static.cloudflareinsights.com'],
			},
			styleDirective: {
				resources: [
					"'self'",
					// Scenes compute their layout at build time into `style` attributes (Atome, Frise,
					// Grain, Montage). Without a hash or a nonce for attributes, only this lets them through.
					{ resource: "'unsafe-inline'", kind: 'attribute' },
				],
			},
		},
	},
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
