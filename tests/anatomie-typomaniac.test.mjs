// Anatomie de typomaniac dans ses deux versions : le banc de duel parle la langue de la page, sur
// la fiche, dans la figure autonome et dans l'aperçu de l'accueil ; son mouvement, un seul morceau
// pour les deux versions, porte les deux langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE, attr, elements, moduleGraph, readDist, readFiche, readHome, tags, text } from './helpers/dist.mjs';

const SLUG = 'typomaniac';

/** Les textes de l'anatomie d'une fiche : titre de la carte, consignes, relevé, légende, libellé, nomenclature. */
function anatomy(html, heading) {
	const section = elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(heading)) ?? '';
	const [figure = ''] = elements(section, 'figure');
	const [svg = ''] = elements(section, 'svg').filter((s) => attr(tags(s, 'svg')[0], 'role') === 'img');
	const byClass = (fragment, name, cls) => elements(fragment, name).filter((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, name)[0]));
	const pieces = elements(section, 'li').filter((li) => /^item\b/.test(attr(tags(li, 'li')[0], 'class') ?? ''));
	return {
		title: text(figure.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? ''),
		releve: text(figure.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? ''),
		caption: text(elements(section, 'figcaption')[0] ?? '').replace(/^Fig\. 1 — /, ''),
		label: attr(tags(svg, 'svg')[0] ?? '', 'aria-label') ?? '',
		names: pieces.map((li) => text(byClass(li, 'span', 'name')[0] ?? '')),
	};
}

test('en : la fiche anglaise de typomaniac montre son anatomie en anglais, relevé au repos au format britannique', () => {
	const en = anatomy(readFiche(SLUG, 'en'), 'Anatomy');
	assert.equal(en.title, 'Duel bench with a referee tower');
	assert.equal(en.releve, 'round 2/3 · 18.6 s · A 1–0 B');
	assert.match(en.caption, /^Each keystroke leaves its keyboard timestamped, in 50 ms batches\./);
	assert.match(en.label, /^Duel bench in isometric view: /);
	assert.deepEqual(en.names, ['Base', 'Keyboards A and B', 'Cables', 'Referee tower', 'Checkpoint', 'Round lamps', 'Mast']);
});

test('en : la figure autonome anglaise et l’aperçu de l’accueil anglais nomment le banc en anglais', () => {
	const figure = readDist(FIGURE.en(SLUG).slice(1));
	assert.match(attr(tags(figure, 'svg')[0], 'aria-label') ?? '', /^Duel bench in isometric view: /);
	const home = readHome('en');
	const start = home.search(new RegExp(`\\sdata-panel="${SLUG}"`));
	const next = home.slice(start + 1).search(/\sdata-panel="/);
	const panel = home.slice(start, next < 0 ? undefined : start + 1 + next);
	assert.equal(text(panel.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? ''), 'Duel bench');
	assert.equal(text(panel.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? ''), 'round 2/3 · 18.6 s · A 1–0 B');
	assert.match(attr(tags(panel, 'img')[0] ?? '', 'alt') ?? '', /^Duel bench in isometric view: /);
});

// Un seul morceau de mouvement sert les deux versions : il porte l'aide au clavier et les mots du
// relevé vivant dans les deux langues, et choisit selon la langue du document.
test('le mouvement du banc, un seul morceau pour les deux versions, parle les deux langues', () => {
	const [loader] = tags(readFiche(SLUG, 'en'), 'script').filter((t) => attr(t, 'type') === 'module');
	const code = moduleGraph(attr(loader, 'src') ?? '').code;
	const chunks = [...code.matchAll(new RegExp(`\\./${SLUG}/motion\\.ts"?:[^,}]*?import\\(\\s*["'\`]\\./(motion\\.[\\w-]+\\.js)`, 'g'))].map((m) => m[1]);
	assert.equal(new Set(chunks).size, 1, 'un seul morceau de mouvement');
	const motion = readDist(`_astro/${chunks[0]}`);
	for (const words of ['Banc de duel, joueur A', 'Duel bench, player A', 'reprise dans', 'resumes in', 'accepted at']) {
		assert.ok(motion.includes(words), `« ${words} » absent du mouvement`);
	}
});

test('fr : la fiche française de typomaniac garde son anatomie et son relevé au repos', () => {
	const fr = anatomy(readFiche(SLUG, 'fr'), 'Anatomie');
	assert.equal(fr.title, 'Banc de duel à tour d’arbitrage');
	assert.equal(fr.releve, 'manche 2/3 · 18,6 s · A 1–0 B');
	assert.match(fr.label, /^Banc de duel en vue isométrique : /);
	assert.deepEqual(fr.names, ['Socle', 'Claviers A et B', 'Câbles', 'Tour d’arbitrage', 'Guichet', 'Lampes de manche', 'Mât']);
});
