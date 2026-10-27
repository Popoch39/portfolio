// Les deux versions du site (spec #31, ADR 0002) : français à la racine, anglais sous /en/, liées
// l'une à l'autre pour les moteurs (hreflang, sitemap) et pour le visiteur (sélecteur). Chaque page,
// l'accueil comme les six fiches, existe dans les deux versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, alternates, attr, elements, hasAttr, headOf, readDist, readPage, tags, text } from './helpers/dist.mjs';

const LOCALES = ['fr', 'en'];
const LANG = { fr: 'fr', en: 'en' };
const OG_LOCALE = { fr: 'fr_FR', en: 'en_GB' };
const otherOf = (locale) => (locale === 'fr' ? 'en' : 'fr');

const canonicalOf = (html) => attr(tags(headOf(html), 'link').find((t) => attr(t, 'rel') === 'canonical') ?? '', 'href');
const og = (html, property) =>
	tags(headOf(html), 'meta')
		.filter((t) => attr(t, 'property') === property)
		.map((t) => attr(t, 'content'));

/** Chaque page du site, avec l'adresse et le HTML de ses deux versions. */
const PAGES = [
	{ name: 'accueil', path: HOME },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, path: { fr: FICHE.fr(slug), en: FICHE.en(slug) } })),
].map(({ name, path }) => {
	const html = Object.fromEntries(LOCALES.map((locale) => [locale, readPage(path[locale])]));
	const url = Object.fromEntries(LOCALES.map((locale) => [locale, canonicalOf(html[locale])]));
	return { name, path, html, url };
});
/** Les versions de toutes les pages, une à une. */
const VERSIONS = PAGES.flatMap((page) => LOCALES.map((locale) => ({ ...page, locale, label: `${page.name} (${locale})`, page: page.html[locale] })));

test('chaque page existe dans les deux versions, chacune à son adresse', () => {
	for (const { label, locale, path, url } of VERSIONS) assert.equal(new URL(url[locale]).pathname, path[locale], label);
});

test('chaque version déclare sa langue', () => {
	for (const { label, locale, page } of VERSIONS) assert.equal(attr(tags(page, 'html')[0], 'lang'), LANG[locale], label);
});

test('les deux versions de chaque page se déclarent l’une l’autre, x-default vers l’anglais', () => {
	for (const { label, page, url } of VERSIONS) {
		const declared = alternates(page);
		assert.deepEqual(declared, { fr: url.fr, en: url.en, 'x-default': url.en }, label);
		for (const href of Object.values(declared)) assert.ok(URL.canParse(href), `${label} : hreflang non absolu : ${href}`);
	}
});

/** Le fichier de `dist/` servi à un chemin du site, ou `undefined` s'il n'existe pas. */
const served = (pathname) => {
	try {
		return pathname.endsWith('/') ? readPage(pathname) : readDist(pathname.slice(1), null);
	} catch {
		return undefined;
	}
};
/** Les liens internes d'une page : `<a>` du corps dont l'adresse reste sur le site. */
const internalLinks = (html) => tags(elements(html, 'body')[0] ?? '', 'a').filter((a) => attr(a, 'href').startsWith('/'));

test('aucun lien interne n’est cassé, dans les deux versions', () => {
	for (const { label, locale, page, url } of VERSIONS) {
		const links = internalLinks(page);
		assert.ok(links.length > 0, label);
		for (const a of links) assert.ok(served(new URL(attr(a, 'href'), url[locale]).pathname), `${label} : ${attr(a, 'href')} ne mène à aucune page`);
	}
});

test('les liens internes d’une version restent dans sa langue, sauf le sélecteur', () => {
	const isEnglish = (pathname) => pathname === HOME.en || pathname.startsWith(HOME.en);
	for (const { label, locale, page, url } of VERSIONS) {
		for (const a of internalLinks(page).filter((link) => !hasAttr(link, 'hreflang'))) {
			const { pathname } = new URL(attr(a, 'href'), url[locale]);
			assert.equal(isEnglish(pathname), locale === 'en', `${label} : ${attr(a, 'href')} mène à l’autre langue`);
		}
	}
});

// L'exploration d'un robot : partie des deux accueils, elle suit les liens internes de page en page
// et doit atteindre toutes les pages du sitemap, sans lien cassé.
test('l’exploration depuis les deux accueils atteint les deux versions de chaque page', () => {
	const seen = new Set();
	const queue = [HOME.fr, HOME.en];
	while (queue.length) {
		const pathname = queue.shift();
		if (seen.has(pathname)) continue;
		seen.add(pathname);
		const html = served(pathname);
		assert.ok(html, `${pathname} ne mène à aucune page`);
		for (const a of internalLinks(String(html))) {
			const next = new URL(attr(a, 'href'), `https://x.invalid${pathname}`).pathname;
			if (next.endsWith('/')) queue.push(next);
		}
	}
	assert.deepEqual([...seen].sort(), PAGES.flatMap(({ path }) => LOCALES.map((locale) => path[locale])).sort());
});

test('og:locale est la langue de la version, og:locale:alternate l’autre', () => {
	for (const { label, locale, page } of VERSIONS) {
		assert.deepEqual(og(page, 'og:locale'), [OG_LOCALE[locale]], label);
		assert.deepEqual(og(page, 'og:locale:alternate'), [OG_LOCALE[otherOf(locale)]], label);
	}
});

// Le sélecteur « FR / EN », en fin de navigation : la langue courante en texte, l'autre en lien vers
// la même page dans l'autre langue (la fiche trekker anglaise depuis la française, pas l'accueil).
test('le sélecteur termine la navigation : la langue courante marquée, l’autre liée à la même page', () => {
	for (const { label, locale, page, url } of VERSIONS) {
		const [nav] = elements(page, 'nav');
		const tail = nav.slice(nav.lastIndexOf('#'));
		assert.equal(text(tail.slice(tail.indexOf('</a>') + 4)), 'FR / EN', `${label} : « FR / EN » doit clore la navigation`);

		const current = tags(nav, 'span').filter((t) => hasAttr(t, 'aria-current'));
		assert.equal(current.length, 1, `${label} : une seule langue courante`);
		const currentText = text(nav.slice(nav.indexOf(current[0])).replace(/<\/span>[\s\S]*$/, ''));
		assert.equal(currentText, LANG[locale].toUpperCase(), label);

		const other = otherOf(locale);
		const links = elements(nav, 'a').filter((a) => attr(a, 'hreflang'));
		assert.equal(links.length, 1, `${label} : un seul lien de langue`);
		const [link] = links;
		assert.equal(text(link), LANG[other].toUpperCase(), label);
		assert.equal(new URL(attr(link, 'href'), url[locale]).href, url[other], `${label} : le sélecteur mène à l’autre version`);
		assert.equal(attr(link, 'hreflang'), LANG[other], label);
		assert.equal(attr(link, 'lang'), LANG[other], label);
	}
});

// Le sitemap déclare chaque version avec ses alternatives, comme le <head> de la page.
const sitemap = readDist('sitemap.xml');
const entries = elements(sitemap, 'url').map((url) => ({
	loc: text(elements(url, 'loc')[0] ?? ''),
	alternates: Object.fromEntries(tags(url, 'xhtml:link').map((t) => [attr(t, 'hreflang'), attr(t, 'href')])),
}));

test('le sitemap déclare l’espace de noms xhtml de ses alternatives', () => {
	assert.match(tags(sitemap, 'urlset')[0] ?? '', /\sxmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
});

test('le sitemap liste les deux versions de chaque page, chacune avec ses alternatives', () => {
	assert.equal(entries.length, PAGES.length * LOCALES.length);
	for (const { label, locale, url } of VERSIONS) {
		const entry = entries.find(({ loc }) => loc === url[locale]);
		assert.ok(entry, `${label} : ${url[locale]} absent du sitemap`);
		assert.deepEqual(entry.alternates, { fr: url.fr, en: url.en, 'x-default': url.en }, label);
	}
});

test('chaque URL du sitemap est servie, en sa langue, avec les mêmes alternatives que son <head>', () => {
	for (const { loc, alternates: declared } of entries) {
		const html = readPage(new URL(loc).pathname);
		assert.equal(canonicalOf(html), loc, `${loc} : canonique`);
		assert.deepEqual(alternates(html), declared, `${loc} : alternatives`);
		const lang = Object.entries(declared).find(([hreflang, href]) => hreflang !== 'x-default' && href === loc)?.[0];
		if (lang) assert.equal(attr(tags(html, 'html')[0], 'lang'), lang, `${loc} : lang`);
	}
});
