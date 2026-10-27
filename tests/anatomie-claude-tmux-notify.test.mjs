// Anatomie de claude-tmux-notify en deux langues : le tableau d'annonciateur parle anglais sur la
// fiche anglaise et dans l'aperçu de l'accueil anglais, sans que rien ne change côté français.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { FIGURE, readDist, readFiche, readHome, attr, elements, tags, text } from './helpers/dist.mjs';

const SLUG = 'claude-tmux-notify';

/** La section anatomie d'une fiche : celle dont le h2 est « Anatomie » (« Anatomy »). */
const sectionOf = (html, heading) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(heading)) ?? '';
const byClass = (fragment, name, cls) => elements(fragment, name).filter((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, name)[0]));
const releveOf = (fragment) => text(fragment.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? '');
const titleOf = (fragment) => text(fragment.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? '');
/** Le panneau de l'aperçu du projet sur l'accueil : du crochet `data-panel` au suivant. */
const panelOf = (html) => html.slice(html.indexOf(`data-panel="${SLUG}"`)).split(/\sdata-panel="/)[0];

const EN = {
	machine: 'Annunciator board',
	title: 'Drop-flap annunciator board',
	pointer: 'Click a window to make Claude wait, a dropped flap to plug into its jack',
	touch: 'Tap a window to make Claude wait, a dropped flap to plug into its jack',
	releve: '1:nvim active · polling 1,000 ms',
	parts: ['Tape punch', 'Reel and guillotine', 'Seconds escapement', 'Read head and buffer loop', 'Corded plug', 'Flap', 'Trembler bell'],
};

test('en : la fiche montre le tableau en anglais : titre, consignes, relevé au repos et nomenclature', () => {
	const section = sectionOf(readFiche(SLUG, 'en'), 'Anatomy');
	const [figure] = elements(section, 'figure');
	assert.equal(titleOf(figure), EN.title);
	assert.deepEqual(byClass(figure, 'span', 'consigne').map(text), [EN.pointer, EN.touch]);
	assert.equal(releveOf(figure), EN.releve);
	const names = elements(section, 'li')
		.filter((li) => /^item\b/.test(attr(tags(li, 'li')[0], 'class') ?? ''))
		.map((li) => text(byClass(li, 'span', 'name')[0] ?? ''));
	assert.deepEqual(names, EN.parts);
	assert.match(text(elements(section, 'figcaption')[0]), /every 1,000 ms, Neovim reads/);
});

test('en : le libellé de la figure, sur la fiche et dans la figure autonome, est en anglais', () => {
	const svg = tags(sectionOf(readFiche(SLUG, 'en'), 'Anatomy'), 'svg').find((tag) => attr(tag, 'role') === 'img');
	const standalone = tags(readDist(FIGURE.en(SLUG).slice(1)), 'svg')[0];
	for (const tag of [svg, standalone]) {
		assert.match(attr(tag, 'aria-label'), /^Wall-mounted annunciator board\. .* Arrow keys or digits to pick a window, Enter to call or acknowledge, F to end a turn\.$/);
	}
});

test('en : l’aperçu de l’accueil anglais nomme la machine et donne consignes et relevé en anglais', () => {
	const panel = panelOf(readHome('en'));
	assert.equal(titleOf(panel), EN.machine);
	assert.deepEqual(byClass(panel, 'span', 'consigne').map(text), [EN.pointer, EN.touch]);
	assert.equal(releveOf(panel), EN.releve);
	assert.match(attr(tags(panel, 'img')[0], 'alt'), /^Wall-mounted annunciator board\./);
});

test('fr : la fiche et l’aperçu gardent leur relevé au repos, sans séparateur de milliers sous 10 000', () => {
	assert.equal(releveOf(sectionOf(readFiche(SLUG, 'fr'), 'Anatomie')), '1:nvim au premier plan · sondage 1000 ms');
	assert.equal(releveOf(panelOf(readHome('fr'))), '1:nvim au premier plan · sondage 1000 ms');
});

test('un seul module de mouvement sert les deux versions, sous 20 Ko minifié', () => {
	const chunks = readdirSync(new URL('../dist/_astro/', import.meta.url)).filter((file) => file.endsWith('.js'));
	const loader = chunks.map((file) => readDist(`_astro/${file}`)).find((code) => code.includes(`"./${SLUG}/motion.ts"`)) ?? '';
	const chunk = loader.match(new RegExp(`"\\./${SLUG}/motion\\.ts":\\(\\)=>[^,}]*?(motion\\.[\\w-]+\\.js)`))?.[1];
	assert.ok(chunk, 'morceau de mouvement introuvable dans le chargeur');
	const code = readDist(`_astro/${chunk}`);
	// Les deux langues de l'aide au clavier de la scène vivent dans le même morceau.
	assert.match(code, /Tableau d’annonciateur : flèches/);
	assert.match(code, /Annunciator board: arrow keys/);
	assert.ok(Buffer.byteLength(code) <= 20_000, `${Buffer.byteLength(code)} o`);
});
