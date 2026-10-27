// Prérendu au survol (ADR 0006) : un bloc de Speculation Rules par page prérend les liens internes
// sous le pointeur, sauf le sélecteur de langue et les ancres de la page courante. Les règles sont
// évaluées ici sur les liens réels de chaque page, comme le ferait le navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, FICHE, HOME, attr, elements, hasAttr, readPage, tags } from './helpers/dist.mjs';

const ORIGIN = 'https://louis-pocheron.example';
const LOCALES = ['fr', 'en'];

const pages = LOCALES.flatMap((locale) => [HOME[locale], ...PROJECTS.map(({ slug }) => FICHE[locale](slug))]).map((path) => ({
	path,
	html: readPage(path),
}));

/** Les blocs `<script type="speculationrules">` d'une page, leur JSON lu. */
const ruleSets = (html) =>
	elements(html, 'script')
		.filter((s) => attr(tags(s, 'script')[0], 'type') === 'speculationrules')
		.map((s) => JSON.parse(s.replace(/^<script\b[^>]*>|<\/script>$/g, '')));

/**
 * Un lien répond-il à un sélecteur ? Seules les formes `[nom]` et `[nom^='valeur']` (en liste) sont
 * comprises : une autre forme fait échouer le test plutôt que d'être évaluée de travers.
 */
function matchesSelector(tag, selectors) {
	return [selectors]
		.flat()
		.flatMap((list) => list.split(','))
		.some((selector) => {
			const m = selector.trim().match(/^\[([\w-]+)(?:\^=(["'])(.*)\2)?\]$/);
			if (!m) throw new Error(`sélecteur non évalué par le test : ${selector}`);
			return m[2] ? attr(tag, m[1])?.startsWith(m[3]) === true : hasAttr(tag, m[1]);
		});
}

/** Évalue une condition `where` des règles de document sur un lien d'une page servie à `base`. */
function matches(where, tag, base) {
	const [[key, value], ...rest] = Object.entries(where);
	assert.equal(rest.length, 0, 'une seule clé par condition');
	const href = new URL(attr(tag, 'href'), base).href;
	switch (key) {
		case 'and':
			return value.every((w) => matches(w, tag, base));
		case 'or':
			return value.some((w) => matches(w, tag, base));
		case 'not':
			return !matches(value, tag, base);
		case 'href_matches':
			return [value].flat().some((pattern) => new URLPattern(pattern, base).test(href));
		case 'selector_matches':
			return matchesSelector(tag, value);
		default:
			throw new Error(`condition non évaluée par le test : ${key}`);
	}
}

/** Les liens d'une page que les règles prérendent au survol. */
function prerendered({ path, html }) {
	const base = new URL(path, ORIGIN).href;
	const rules = ruleSets(html).flatMap((set) => set.prerender ?? []);
	return tags(html, 'a').filter((tag) => attr(tag, 'href') && rules.some((rule) => rule.where && matches(rule.where, tag, base)));
}

test('chaque page porte un seul bloc de règles : prérendu au survol appuyé (moderate)', () => {
	for (const { path, html } of pages) {
		const sets = ruleSets(html);
		assert.equal(sets.length, 1, path);
		assert.deepEqual(Object.keys(sets[0]), ['prerender'], path);
		assert.ok(sets[0].prerender.length > 0, path);
		for (const rule of sets[0].prerender) assert.equal(rule.eagerness, 'moderate', path);
	}
});

test('le sélecteur de langue, les ancres de la page et les liens externes ne sont jamais prérendus', () => {
	for (const page of pages) {
		const hrefs = prerendered(page).map((tag) => attr(tag, 'href'));
		const language = tags(page.html, 'a').filter((tag) => attr(tag, 'hreflang'));
		assert.equal(language.length, 1, `${page.path} : sélecteur de langue`);
		assert.ok(!hrefs.includes(attr(language[0], 'href')), `${page.path} : langue prérendue`);
		assert.deepEqual(
			hrefs.filter((href) => href.startsWith('#') || !new URL(href, ORIGIN + page.path).href.startsWith(`${ORIGIN}/`)),
			[],
			page.path,
		);
	}
});

test('les liens internes vers une autre page sont tous prérendus', () => {
	for (const page of pages) {
		const internal = tags(page.html, 'a').filter((tag) => {
			const href = attr(tag, 'href');
			return href && !href.startsWith('#') && !attr(tag, 'hreflang') && new URL(href, ORIGIN + page.path).origin === ORIGIN;
		});
		assert.deepEqual(prerendered(page), internal, page.path);
	}
});

for (const locale of LOCALES) {
	test(`${locale} : l'accueil prérend chaque fiche, la fiche l'accueil, ses sections et ses voisines`, () => {
		const home = prerendered(pages.find(({ path }) => path === HOME[locale])).map((tag) => attr(tag, 'href'));
		for (const { slug } of PROJECTS) assert.ok(home.includes(FICHE[locale](slug)), `accueil → ${slug}`);
		PROJECTS.forEach(({ slug }, i) => {
			const fiche = prerendered(pages.find(({ path }) => path === FICHE[locale](slug))).map((tag) => attr(tag, 'href'));
			assert.ok(fiche.includes(HOME[locale]), `${slug} → accueil`);
			assert.ok(fiche.some((href) => href.startsWith(`${HOME[locale]}#`)), `${slug} → section de l'accueil`);
			for (const other of [PROJECTS[i - 1], PROJECTS[i + 1]].filter(Boolean)) {
				assert.ok(fiche.includes(FICHE[locale](other.slug)), `${slug} → ${other.slug}`);
			}
		});
	});
}
