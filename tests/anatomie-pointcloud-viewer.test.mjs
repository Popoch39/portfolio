// Anatomie de pointcloud-viewer en deux langues : la fiche anglaise et l'aperçu de l'accueil anglais
// la montrent en anglais, et la version française garde ses textes et ses nombres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { FIGURE, readDist, readFiche, readHome, elements, tags, text } from './helpers/dist.mjs';

const SLUG = 'pointcloud-viewer';

/** Le relevé d'un fragment de page : le texte du `<span data-releve>`. */
const releveOf = (html) => text(html.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? '');
/** La carte de la figure de la fiche : le `<figure>` de la section dont le h2 est l'anatomie. */
const cardOf = (html, heading) => elements(elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(heading)) ?? '', 'figure')[0] ?? '';

/**
 * Ce qui trahit du français dans un texte anglais : ses lettres accentuées, et ses mots-outils les
 * plus courants. « arrondissement », mot anglais aussi, n'en fait pas partie.
 */
const FRENCH = /[àâçéèêëîïôûùœ]|\b(?:le|la|les|des|du|un|une|est|et|sur|dans|pour|qui|au|aux|vers|tête|pièce)\b/i;
const frenchIn = (fragments) => fragments.filter((fragment) => FRENCH.test(fragment));
/** Les attributs qui portent du texte lu ou annoncé : libellés, alternatives, contenus de méta. */
const spokenAttributes = (html) => [...html.matchAll(/\s(?:aria-label|aria-valuetext|alt|title|content)="([^"]*)"/g)].map(([, value]) => value);

test('en : la fiche ne montre ni n’annonce aucun texte français de l’anatomie', () => {
	const html = readFiche(SLUG, 'en');
	const [head] = elements(html, 'head');
	const [hero] = elements(html, 'section');
	const anatomy = elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomy')) ?? '';
	const structured = elements(head, 'script')
		.filter((script) => /type="application\/ld\+json"/.test(script))
		.map((script) => JSON.parse(text(script)).description);
	const fragments = [text(elements(head, 'title')[0]), ...spokenAttributes(head), ...structured, ...[hero, anatomy].flatMap((part) => [text(part), ...spokenAttributes(part)])];
	assert.ok(anatomy, 'section de l’anatomie');
	assert.deepEqual(frenchIn(fragments), []);
});

test('en : l’aperçu de l’accueil et la figure autonome ne portent aucun texte français', () => {
	const home = readHome('en');
	const panel = home.slice(home.indexOf(`data-panel="${SLUG}"`)).match(/^[\s\S]*?(?=<div class="panel"|$)/)[0];
	const figure = readDist(FIGURE.en(SLUG).slice(1));
	assert.equal(releveOf(panel), '100,000 pts · 1.80 MB · EPSG:2154');
	assert.deepEqual(frenchIn([text(panel), ...spokenAttributes(panel), ...spokenAttributes(tags(figure, 'svg')[0])]), []);
});

/** Le morceau du mouvement de la figure, tel que le chargeur l'importe à la demande. */
function motionChunk() {
	const loader = readdirSync(new URL('../dist/_astro/', import.meta.url))
		.filter((name) => name.endsWith('.js'))
		.map((name) => readDist(`_astro/${name}`))
		.find((code) => code.includes(`"./${SLUG}/motion.ts"`));
	const [, chunk] = loader?.match(new RegExp(`"\\./${SLUG}/motion\\.ts":[^,}]*?(motion\\.[\\w-]+\\.js)`)) ?? [];
	assert.ok(chunk, 'morceau du mouvement introuvable dans le chargeur');
	return readDist(`_astro/${chunk}`);
}

test('un seul module de mouvement parle les deux langues : relevés et aide au clavier', () => {
	const code = motionChunk();
	for (const words of ['cliquet', 'ratchet', 'intensité', 'intensity', 'Entrée relance un bake', 'Enter starts a new bake']) assert.ok(code.includes(words), words);
});

test('le relevé au repos suit le format de la langue', () => {
	assert.equal(releveOf(cardOf(readFiche(SLUG, 'fr'), 'Anatomie')), '100 000 pts · 1,80 Mo · EPSG:2154');
	assert.equal(releveOf(cardOf(readFiche(SLUG, 'en'), 'Anatomy')), '100,000 pts · 1.80 MB · EPSG:2154');
});
