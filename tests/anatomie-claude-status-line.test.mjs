// Anatomie de claude-status-line en anglais : la rampe à cadran parle la langue de la page sur la
// fiche anglaise et dans l'aperçu de l'accueil anglais. Les textes de la machine elle-même (libellés
// `5h` et `sem` du binaire, délais au format de `fmtReset`, plaque `v1.0.0`) restent tels quels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readFiche, readHome, readDist, FIGURE, tags, attr, elements, text } from './helpers/dist.mjs';

const SLUG = 'claude-status-line';

/** Des marques sûres du français : lettres accentuées et mots-outils qui n'existent pas en anglais. */
const FRENCH = /[àâçéèêëîïôûùœ]|\b(le|la|les|des|du|et|une?|sur|pour|dans|avec|sans|glissez|règle|semaine|heures?)\b/i;
const assertEnglish = (value, where) => assert.doesNotMatch(value, FRENCH, `${where} : texte français « ${value} »`);

const card = (html) => {
	const section = elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomy')) ?? '';
	return { section, figure: elements(section, 'figure')[0] ?? '' };
};
const byClass = (fragment, name, cls) => elements(fragment, name).filter((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, name)[0]));
const releveIn = (fragment) => text(fragment.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? '');

test('en : la fiche montre la rampe à cadran en anglais : titres, accroche, consignes, légende, libellé, nomenclature', () => {
	const html = readFiche(SLUG, 'en');
	const { section, figure } = card(html);
	const [hero] = elements(html, 'section');
	const svg = elements(section, 'svg').find((s) => attr(tags(s, 'svg')[0], 'role') === 'img') ?? '';
	const pieces = elements(section, 'li').filter((li) => attr(tags(li, 'li')[0], 'data-piece') !== undefined);
	assert.equal(pieces.length, 8);
	const texts = {
		title: text(elements(html, 'title')[0] ?? ''),
		description: attr(tags(html, 'meta').find((t) => attr(t, 'name') === 'description') ?? '', 'content') ?? '',
		lede: text(elements(hero ?? '', 'p')[0] ?? ''),
		heading: text(figure.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? ''),
		caption: text(elements(section, 'figcaption')[0] ?? ''),
		label: attr(tags(svg, 'svg')[0] ?? '', 'aria-label') ?? '',
		...Object.fromEntries(byClass(figure, 'span', 'consigne').map((s, i) => [`consigne ${i}`, text(s)])),
		...Object.fromEntries(
			pieces.flatMap((li) => {
				const id = attr(tags(li, 'li')[0], 'data-piece');
				return [
					[`${id} : nom`, text(byClass(li, 'span', 'name')[0] ?? '')],
					[`${id} : rôle`, text((byClass(li, 'span', 'role')[0] ?? '').replace(/<a\b[\s\S]*<\/a>/, ''))],
				];
			}),
		),
	};
	for (const [where, value] of Object.entries(texts)) {
		assert.ok(value, `${where} vide`);
		assertEnglish(value, where);
	}
	assert.match(texts.heading, /^Dial rail\b/);
	assert.match(texts.label, /arrow keys/);
});

test('en : le relevé au repos est la ligne du binaire, pourcentages à l’anglaise', () => {
	const expected = 'stdin · 5h 68% · reset 2h14 · sem 41% · 3j';
	assert.equal(releveIn(card(readFiche(SLUG, 'en')).figure), expected);
	const preview = elements(readHome('en'), 'figure').find((f) => f.includes(`data-motion="${SLUG}"`)) ?? '';
	assert.equal(releveIn(preview), expected);
	// Le français garde son espace fine insécable avant « % ».
	const fr = elements(readFiche(SLUG, 'fr'), 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomie')) ?? '';
	assert.equal(releveIn(fr), 'stdin · 5h 68 % · reset 2h14 · sem 41 % · 3j');
});

test('en : la figure autonome et la carte de l’aperçu de l’accueil sont en anglais', () => {
	const standalone = readDist(FIGURE.en(SLUG).slice(1));
	assertEnglish(attr(tags(standalone, 'svg')[0], 'aria-label') ?? '', 'figure autonome');
	const preview = elements(readHome('en'), 'figure').find((f) => f.includes(`data-motion="${SLUG}"`)) ?? '';
	assert.ok(preview, 'aperçu absent');
	for (const s of elements(preview, 'span')) assertEnglish(text(s), 'aperçu');
	for (const img of tags(preview, 'img')) assertEnglish(attr(img, 'alt') ?? '', 'aperçu, image');
});

test('le mouvement n’a qu’un morceau pour les deux langues, et il porte les deux', () => {
	const pattern = new RegExp(`"\\./${SLUG}/motion\\.ts":\\(\\)=>[^,}]*?(motion\\.[\\w-]+\\.js)`, 'g');
	const chunks = new Set(
		readdirSync(new URL('../dist/_astro/', import.meta.url))
			.filter((name) => name.endsWith('.js'))
			.flatMap((name) => [...readDist(`_astro/${name}`).matchAll(pattern)].map((m) => m[1])),
	);
	assert.equal(chunks.size, 1, `morceaux du mouvement : ${[...chunks].join(', ')}`);
	const code = readDist(`_astro/${[...chunks][0]}`);
	for (const label of ['Lancer le tour', 'Arrêter le tour', 'Start the tour', 'Stop the tour']) assert.ok(code.includes(label), label);
});
