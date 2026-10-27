// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { defaultLocale, locales } from './src/lib/i18n.ts';
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
	vite: {
		// `:version` de la Lunette : le commit, la date du build et la version d'Astro ; `:Lazy` : celles
		// d'Astro et de TypeScript.
		define: buildDefines(['astro', 'typescript']),
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Archivo',
			cssVariable: '--font-archivo',
			weights: ['100 900'],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
			options: {
				experimental: {
					// L'axe de largeur porte les titres condensés (font-stretch 62 %–125 %).
					variableAxis: { wdth: [['62', '125']] },
				},
			},
		},
		{
			provider: fontProviders.google(),
			name: 'Fragment Mono',
			cssVariable: '--font-mono',
			weights: [400],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-monospace', 'Menlo', 'monospace'],
		},
	],
});
