// Polices réduites en local (spec #46, ticket #49, ADR 0005) : chaque caractère que le build fait
// dessiner est dans la `cmap` de la police servie qui le dessine. Un texte qui gagne un caractère
// fait échouer la suite jusqu'à la régénération des polices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { PROJECTS, css, elements, readDist, readFiche, readHome, text } from './helpers/dist.mjs';
import { cmap } from './helpers/fonts.mjs';

const REGENERATE = '`pnpm build && pnpm polices`';

const pages = [
	{ name: 'accueil', html: readHome() },
	{ name: 'accueil anglais', html: readHome('en') },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, html: readFiche(slug) })),
	...PROJECTS.map(({ slug }) => ({ name: `fiche anglaise ${slug}`, html: readFiche(slug, 'en') })),
];

/**
 * Les polices servies, d'après les `@font-face` du build : le fichier qu'elles chargent, la source
 * dont il est tiré, et les caractères absents de cette source, que le navigateur prend dans une
 * police du système (la preuve qu'ils y manquent est vérifiée plus bas).
 */
const faces = css(pages[0].html).match(/@font-face\s*{[^}]*}/gi) ?? [];
const servedFile = (family, style) =>
	faces
		.find((face) => new RegExp(`font-family:\\s*"?${family}-`).test(face) && new RegExp(`font-style:\\s*${style}`).test(face) && /url\(/.test(face))
		?.match(/url\(["']?\/([^)"']+)/)?.[1];
// En points de code, pour que les invisibles se lisent : U+00AD césure conditionnelle, U+202F espace
// fine insécable (nombres formatés par `Intl`), U+1D49 ᵉ, U+2197 ↗, U+232B ⌫, U+2423 ␣, U+2605 ★.
const FONTS = {
	romaine: { file: servedFile('Archivo', 'normal'), source: 'Archivo[wdth,wght].ttf', absent: [0x202f, 0x1d49, 0x2197, 0x232b, 0x2423, 0x2605] },
	italique: { file: servedFile('Archivo', 'italic'), source: 'Archivo-Italic[wdth,wght].ttf', absent: [] },
	mono: { file: servedFile('Fragment Mono', 'normal'), source: 'FragmentMono-Regular.ttf', absent: [0xad, 0x202f, 0x1d49, 0x232b, 0x2423, 0x2605] },
};
const sourceOf = (font) => readFileSync(new URL(`../src/vendor/fonts/${FONTS[font].source}`, import.meta.url));
const servedCmap = Object.fromEntries(Object.entries(FONTS).map(([font, { file }]) => [font, cmap(readDist(file, null))]));
const sourceCmap = Object.fromEntries(Object.keys(FONTS).map((font) => [font, cmap(sourceOf(font))]));

/** Les entités nommées qu'Astro et le contenu écrivent ; une entité inconnue reste lue telle quelle. */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: String.fromCharCode(0xa0) };

/** Les caractères qu'un texte fait dessiner (hors caractères de contrôle), capitales comprises pour `text-transform: uppercase`. */
function drawn(content, { capitals = true } = {}) {
	// Une seule passe : `&#38;lt;` s'affiche `&lt;`, pas `<`.
	const decoded = content.replace(/&(?:#x([\da-f]+)|#(\d+)|(\w+));/gi, (entity, hex, dec, name) =>
		hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : (ENTITIES[name] ?? entity),
	);
	const chars = new Set([...decoded].filter((char) => !/\p{Cc}/u.test(char)));
	if (capitals) for (const char of [...chars]) for (const upper of char.toUpperCase()) chars.add(upper);
	return chars;
}

/** Ce qui manque à une police pour dessiner ces caractères, avec ce qu'il faut faire. */
function uncovered(font, chars) {
	const missing = [...chars].filter((char) => !servedCmap[font].has(char.codePointAt(0)) && !FONTS[font].absent.includes(char.codePointAt(0)));
	const regenerate = missing.filter((char) => sourceCmap[font].has(char.codePointAt(0)));
	const absent = missing.filter((char) => !sourceCmap[font].has(char.codePointAt(0)));
	// Le point de code en plus du caractère : une espace ou une marque invisible doit se voir.
	const list = (chars) => chars.map((char) => `« ${char} » U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(', ');
	return [
		...(regenerate.length ? [`${list(regenerate)} absent(s) de la ${font} : lancer ${REGENERATE}`] : []),
		...(absent.length ? [`${list(absent)} absent(s) de la source ${FONTS[font].source} : choisir un autre caractère, ou le tolérer dans tests/polices.test.mjs`] : []),
	];
}

test('chaque caractère de chaque page, en français et en anglais, est dans la romaine et dans la mono', () => {
	for (const page of pages) {
		const chars = drawn(page.html);
		assert.deepEqual([...uncovered('romaine', chars), ...uncovered('mono', chars)], [], page.name);
	}
});

test('chaque caractère des modules JS et des figures autonomes est dans la romaine et dans la mono', () => {
	const files = [
		...readdirSync(new URL('../dist/_astro/', import.meta.url)).filter((name) => name.endsWith('.js')).map((name) => `_astro/${name}`),
		...['figures', 'en/figures'].flatMap((dir) => readdirSync(new URL(`../dist/${dir}/`, import.meta.url)).map((name) => `${dir}/${name}`)),
	];
	assert.ok(files.length > 12, 'modules et figures introuvables');
	for (const file of files) {
		const chars = drawn(readDist(file));
		assert.deepEqual([...uncovered('romaine', chars), ...uncovered('mono', chars)], [], file);
	}
});

test('chaque caractère en italique (emphase de l’accroche, diplômes de l’accueil anglais) est dans l’italique', () => {
	for (const page of pages) {
		const italics = [...elements(page.html, 'em'), ...elements(page.html, 'i')].map(text).join(' ');
		assert.ok(italics.length > 0, `${page.name} : aucune emphase`);
		assert.deepEqual(uncovered('italique', drawn(italics, { capitals: false })), [], page.name);
	}
});

test('un caractère ajouté hors des polices fait échouer la couverture, avec la commande qui les régénère', () => {
	assert.deepEqual(uncovered('romaine', new Set('aő')), [`« ő » U+0151 absent(s) de la romaine : lancer ${REGENERATE}`]);
	assert.match(uncovered('mono', new Set('☃'))[0], /absent\(s\) de la source FragmentMono-Regular\.ttf/);
});

test('les caractères lus sont ceux que dessine le navigateur : entités numériques et nommées décodées', () => {
	const chars = drawn('&#x2014;&#8217;&amp;&lt;&gt;&quot;&apos;&nbsp;&#38;lt;', { capitals: false });
	assert.deepEqual([...chars], ['—', '’', '&', '<', '>', '"', "'", String.fromCharCode(0xa0), 'l', 't', ';']);
});

test('les caractères tolérés manquent bien à la source de leur police', () => {
	for (const [font, { absent, source }] of Object.entries(FONTS)) {
		for (const point of absent) assert.ok(!sourceCmap[font].has(point), `U+${point.toString(16).toUpperCase()} est dans ${source} : le retirer des tolérés`);
	}
});

test('chaque police tient son plafond : romaine 45 Ko, italique 10 Ko, mono 15 Ko', () => {
	const ceilings = { romaine: 45_000, italique: 10_000, mono: 15_000 };
	for (const [font, { file }] of Object.entries(FONTS)) {
		const size = readDist(file, null).length;
		assert.ok(size <= ceilings[font], `${font} : ${size} o > ${ceilings[font]} o`);
	}
});
