// Budget de poids (spec #46, ticket #49) : ce qu'une page fait télécharger avant son premier rendu —
// son HTML, les polices qu'elle précharge, son module et ce qu'il importe statiquement —, compressé
// en Brotli qualité 4, proche de la compression à la volée de Cloudflare. Les morceaux chargés à la
// demande (mouvement des figures) n'en font pas partie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, constants } from 'node:zlib';
import { PROJECTS, attr, moduleGraph, readDist, readFiche, readHome, tags } from './helpers/dist.mjs';

/** Seuils en kilo-octets (1 Ko = 1 000 o). L'accueil passe de 80 à 90 Ko pour l'Atome (ADR 0011), puis à 92 Ko pour le Buffer (ADR 0016). */
const BUDGET = { accueil: 92_000, fiche: 130_000 };

const brotli = (content) => brotliCompressSync(content, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;

/** Poids compressé d'une page et de ce qu'elle charge d'office, fichier par fichier. */
function weigh(html) {
	const links = tags(html, 'link').filter((t) => attr(t, 'rel') === 'preload' && attr(t, 'as') === 'font');
	const modules = tags(html, 'script').filter((t) => attr(t, 'type') === 'module' && attr(t, 'src'));
	const files = [...links.map((t) => attr(t, 'href')), ...modules.flatMap((t) => moduleGraph(attr(t, 'src')).paths)];
	const parts = [{ file: 'HTML', size: brotli(html) }, ...files.map((file) => ({ file, size: brotli(readDist(file.slice(1), null)) }))];
	return { total: parts.reduce((sum, { size }) => sum + size, 0), parts };
}

const pages = [
	{ name: 'accueil', budget: BUDGET.accueil, html: readHome() },
	{ name: 'accueil anglais', budget: BUDGET.accueil, html: readHome('en') },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, budget: BUDGET.fiche, html: readFiche(slug) })),
	...PROJECTS.map(({ slug }) => ({ name: `fiche anglaise ${slug}`, budget: BUDGET.fiche, html: readFiche(slug, 'en') })),
];

test('chaque page tient son budget : accueil 92 Ko, fiche 130 Ko, en Brotli', () => {
	for (const { name, budget, html } of pages) {
		const { total, parts } = weigh(html);
		const detail = parts.map(({ file, size }) => `${file} ${size} o`).join(', ');
		assert.ok(total <= budget, `${name} : ${total} o > ${budget} o (${detail})`);
	}
});

test('le budget compte les polices préchargées et le module de la page', () => {
	const { parts } = weigh(readHome());
	assert.ok(parts.filter(({ file }) => file.endsWith('.woff2')).length >= 1, 'aucune police préchargée comptée');
	assert.ok(parts.some(({ file }) => file.endsWith('.js')), 'aucun module compté');
});
