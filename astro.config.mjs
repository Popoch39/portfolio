// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { defaultLocale, locales } from './src/lib/i18n.ts';
import { cloudflareHeaders } from './src/integrations/cloudflare-headers.mjs';
import { buildDefines } from './src/lib/build-info.mjs';

// https://astro.build/config
export default defineConfig({
	// PROVISOIRE : placeholder en attendant le choix d'un domaine. Canonique, Open Graph,
	// JSON-LD, robots.txt et sitemap.xml en dérivent : c'est le seul réglage à changer.
	site: 'https://louis-pocheron.example',
	// Français à la racine, anglais sous /en/ (ADR 0002). Astro n'en tire que `currentLocale` :
	// les segments traduits passent par `pathOf` du module i18n.
	i18n: {
		locales: [...locales],
		defaultLocale,
		routing: { prefixDefaultLocale: false },
	},
	build: {
		// Aucune feuille de style externe : la CSS part avec le HTML, rien ne bloque le premier rendu.
		inlineStylesheets: 'always',
	},
	// Cache et Early Hints pour Cloudflare Pages, tirés du HTML construit.
	integrations: [cloudflareHeaders()],
	vite: {
		// `:version` de la Lunette : le commit, la date du build et la version d'Astro ; `:Lazy` : celles
		// d'Astro et de TypeScript.
		define: buildDefines(['astro', 'typescript']),
		// En local, le Buffer poste sur la même origine qu'en ligne : `/api` est relayé au Worker de `pnpm worker:dev`.
		server: { proxy: { '/api': 'http://localhost:8787' } },
		build: {
			rollupOptions: {
				output: {
					// L'écouteur de la Lunette et l'aide au préchargement dans un seul morceau : un aller-retour de
					// moins sur le chemin critique de l'accueil.
					manualChunks: (id) => (id.includes('preload-helper') || id.includes('/lunette/keys') ? 'amorce' : undefined),
				},
			},
		},
	},
	// Polices réduites à ce que le site affiche, régénérées par `pnpm build && pnpm polices` (ADR 0005).
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Archivo',
			cssVariable: '--font-archivo',
			fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
			options: {
				// La romaine d'abord : c'est d'elle qu'Astro tire les métriques de la police de repli.
				variants: [
					// L'axe de largeur porte les titres condensés (font-stretch 62 %–100 %).
					{ weight: '100 900', style: 'normal', stretch: '62% 100%', src: ['./src/fonts/archivo.woff2'] },
					// L'italique n'est dessinée qu'à pleine largeur : son axe de largeur est figé à 100 %.
					{ weight: '100 900', style: 'italic', stretch: '100%', src: ['./src/fonts/archivo-italique.woff2'] },
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: 'Fragment Mono',
			cssVariable: '--font-mono',
			fallbacks: ['ui-monospace', 'Menlo', 'monospace'],
			options: {
				variants: [{ weight: 400, style: 'normal', src: ['./src/fonts/fragment-mono.woff2'] }],
			},
		},
	],
});
