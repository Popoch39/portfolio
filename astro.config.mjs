// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// PROVISOIRE : placeholder en attendant le choix d'un domaine. Canonique (et plus tard
	// Open Graph, JSON-LD, robots, sitemap) en dérivent : c'est le seul réglage à changer.
	site: 'https://louis-pocheron.example',
	build: {
		// Aucune feuille de style externe : la CSS part avec le HTML, rien ne bloque le premier rendu.
		inlineStylesheets: 'always',
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
