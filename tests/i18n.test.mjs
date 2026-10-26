// Les deux versions du site (spec #31, ADR 0002) : français à la racine, anglais sous /en/, liées
// l'une à l'autre pour les moteurs (hreflang, sitemap) et pour le visiteur (sélecteur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME, alternates, attr, elements, hasAttr, headOf, readDist, readHome, readPage, tags, text } from './helpers/dist.mjs';

const LANG = { fr: 'fr', en: 'en' };
const OG_LOCALE = { fr: 'fr_FR', en: 'en_GB' };
const otherOf = (locale) => (locale === 'fr' ? 'en' : 'fr');

const canonicalOf = (html) => attr(tags(headOf(html), 'link').find((t) => attr(t, 'rel') === 'canonical') ?? '', 'href');
const og = (html, property) =>
	tags(headOf(html), 'meta')
		.filter((t) => attr(t, 'property') === property)
		.map((t) => attr(t, 'content'));

const homes = Object.entries(HOME).map(([locale]) => ({ locale, html: readHome(locale) }));
const urlOf = Object.fromEntries(homes.map(({ locale, html }) => [locale, canonicalOf(html)]));

test('l’accueil existe dans les deux versions, chacune à son adresse', () => {
	for (const { locale, html } of homes) {
		assert.equal(new URL(canonicalOf(html)).pathname, HOME[locale], locale);
	}
});

test('chaque version de l’accueil déclare sa langue', () => {
	for (const { locale, html } of homes) assert.equal(attr(tags(html, 'html')[0], 'lang'), LANG[locale]);
});

test('les deux versions de l’accueil se déclarent l’une l’autre, x-default vers l’anglais', () => {
	for (const { locale, html } of homes) {
		const declared = alternates(html);
		assert.deepEqual(declared, { fr: urlOf.fr, en: urlOf.en, 'x-default': urlOf.en }, locale);
		for (const href of Object.values(declared)) assert.ok(URL.canParse(href), `${locale} : hreflang non absolu : ${href}`);
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

test('aucun lien interne de l’accueil n’est cassé, dans les deux versions', () => {
	for (const { locale, html } of homes) {
		const internal = tags(elements(html, 'body')[0] ?? '', 'a')
			.map((a) => attr(a, 'href'))
			.filter((href) => href.startsWith('/'));
		assert.ok(internal.length > 0, locale);
		for (const href of internal) assert.ok(served(new URL(href, urlOf[locale]).pathname), `${locale} : ${href} ne mène à aucune page`);
	}
});

test('og:locale est la langue de la version, og:locale:alternate l’autre', () => {
	for (const { locale, html } of homes) {
		assert.deepEqual(og(html, 'og:locale'), [OG_LOCALE[locale]], locale);
		assert.deepEqual(og(html, 'og:locale:alternate'), [OG_LOCALE[otherOf(locale)]], locale);
	}
});

// Le sélecteur « FR / EN », en fin de navigation : la langue courante en texte, l'autre en lien.
test('le sélecteur termine la navigation : la langue courante marquée, l’autre liée à sa version', () => {
	for (const { locale, html } of homes) {
		const [nav] = elements(html, 'nav');
		const tail = nav.slice(nav.lastIndexOf('#'));
		assert.equal(text(tail.slice(tail.indexOf('</a>') + 4)), 'FR / EN', `${locale} : « FR / EN » doit clore la navigation`);

		const current = tags(nav, 'span').filter((t) => hasAttr(t, 'aria-current'));
		assert.equal(current.length, 1, `${locale} : une seule langue courante`);
		const currentText = text(nav.slice(nav.indexOf(current[0])).replace(/<\/span>[\s\S]*$/, ''));
		assert.equal(currentText, LANG[locale].toUpperCase(), locale);

		const other = otherOf(locale);
		const links = elements(nav, 'a').filter((a) => attr(a, 'hreflang'));
		assert.equal(links.length, 1, `${locale} : un seul lien de langue`);
		const [link] = links;
		assert.equal(text(link), LANG[other].toUpperCase(), locale);
		assert.equal(new URL(attr(link, 'href'), urlOf[locale]).href, urlOf[other], `${locale} : le sélecteur mène à l’autre version`);
		assert.equal(attr(link, 'hreflang'), LANG[other], locale);
		assert.equal(attr(link, 'lang'), LANG[other], locale);
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

test('le sitemap liste les deux versions de l’accueil, chacune avec ses alternatives', () => {
	for (const locale of Object.keys(HOME)) {
		const entry = entries.find(({ loc }) => loc === urlOf[locale]);
		assert.ok(entry, `${urlOf[locale]} absent du sitemap`);
		assert.deepEqual(entry.alternates, { fr: urlOf.fr, en: urlOf.en, 'x-default': urlOf.en }, locale);
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
