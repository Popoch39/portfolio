// En-têtes servis par Cloudflare Pages (spec #46, ticket #51) : le build livre `dist/_headers`.
// Les règles y sont évaluées ici comme le ferait Cloudflare, fichier par fichier du build : une
// adresse reçoit les en-têtes de toutes les règles dont le motif la couvre, et un même en-tête
// répété est concaténé par des virgules (https://developers.cloudflare.com/pages/configuration/headers/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, attr, distFiles, headOf, readDist, readPage, tags } from './helpers/dist.mjs';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';
/** Plafond d'un cache court : une journée. */
const SHORT_MAX = 86_400;

/** Les règles de `_headers` : un motif d'adresse non indenté, puis ses en-têtes `Nom: valeur` indentés. */
function parse(source) {
	const rules = [];
	for (const [index, line] of source.split('\n').entries()) {
		const at = `_headers, ligne ${index + 1}`;
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
		assert.ok(line.length <= 2000, `${at} : plus de 2 000 caractères`);
		if (/^\s/.test(line)) {
			const m = line.match(/^\s+([A-Za-z][\w-]*):\s*(\S.*)$/);
			assert.ok(m, `${at} : en-tête indenté « Nom: valeur » attendu, lu « ${line} »`);
			assert.ok(rules.length > 0, `${at} : en-tête avant tout motif`);
			rules.at(-1).headers.push({ name: m[1].toLowerCase(), value: m[2].trim() });
		} else {
			assert.match(line, /^\/\S*$/, `${at} : motif d'adresse attendu`);
			assert.ok((line.match(/\*/g) ?? []).length <= 1, `${at} : un seul * par motif`);
			rules.push({ pattern: line, headers: [] });
		}
	}
	return rules;
}

/** Un motif de Cloudflare couvre-t-il l'adresse ? `*` prend tout, `:nom` un segment. */
function covers(pattern, path) {
	const source = pattern
		.split(/(\*|:[A-Za-z]\w*)/)
		.map((part) => (part === '*' ? '.*' : part.startsWith(':') ? '[^/]+' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
		.join('');
	return new RegExp(`^${source}$`).test(path);
}

const rules = parse(readDist('_headers'));

/** Les en-têtes servis à une adresse, règles cumulées. */
const served = (path) => rules.filter(({ pattern }) => covers(pattern, path)).flatMap(({ headers }) => headers);
const cacheControl = (path) =>
	served(path)
		.filter(({ name }) => name === 'cache-control')
		.map(({ value }) => value)
		.join(', ');
const links = (path) => served(path).filter(({ name }) => name === 'link').map(({ value }) => value);

/** L'adresse qui sert un fichier du build : `projets/trekker/index.html` → `/projets/trekker/`. */
const urlOf = (file) => `/${file.replace(/(^|\/)index\.html$/, '$1')}`;

const files = distFiles().filter((file) => file !== '_headers');
const pages = ['fr', 'en'].flatMap((locale) => [HOME[locale], ...PROJECTS.map(({ slug }) => FICHE[locale](slug))]);
/** Fichiers non versionnés par hachage hors pages : figures autonomes, images de partage, favicons. */
const unhashed = files.filter((file) => !file.startsWith('_astro/') && !file.endsWith('.html') && !['robots.txt', 'sitemap.xml'].includes(file));

/** Le préchargement d'une police dans un en-tête `Link` : `</url>; rel=preload; as=font; …`. */
function fontLink(value) {
	const [target, ...params] = value.split(';').map((part) => part.trim());
	const url = target.match(/^<([^>]+)>$/)?.[1];
	assert.ok(url, `Link sans <url> : ${value}`);
	return { url, params: params.sort() };
}

test('dist/_headers suit la syntaxe de Cloudflare Pages', () => {
	assert.ok(rules.length > 0, 'aucune règle');
	assert.ok(rules.length <= 100, `${rules.length} règles, Cloudflare en lit 100 au plus`);
	for (const { pattern, headers } of rules) assert.ok(headers.length > 0, `${pattern} : motif sans en-tête`);
});

test('le cache immutable vaut pour /_astro/*, et seulement là', () => {
	const hashed = files.filter((file) => file.startsWith('_astro/'));
	assert.ok(hashed.some((file) => file.endsWith('.woff2')) && hashed.some((file) => file.endsWith('.js')), 'polices et modules attendus sous _astro/');
	for (const file of hashed) assert.equal(cacheControl(urlOf(file)), IMMUTABLE, file);
	for (const file of files.filter((file) => !file.startsWith('_astro/'))) {
		assert.doesNotMatch(cacheControl(urlOf(file)), /immutable/, file);
	}
	for (const { pattern, headers } of rules) {
		if (headers.some(({ value }) => /immutable/.test(value))) assert.equal(pattern, '/_astro/*');
	}
});

test('les 14 pages, françaises et anglaises, sont en revalidation', () => {
	const html = files.filter((file) => file.endsWith('.html')).map(urlOf);
	assert.deepEqual(html.toSorted(), pages.toSorted(), 'pages du build');
	for (const page of pages) assert.equal(cacheControl(page), REVALIDATE, page);
});

test('figures autonomes, images de partage et favicons ont un cache court', () => {
	assert.ok(unhashed.some((file) => file.startsWith('figures/')) && unhashed.some((file) => file.startsWith('en/figures/')), 'figures attendues');
	assert.ok(unhashed.some((file) => file.startsWith('og/')) && unhashed.includes('og.png'), 'images de partage attendues');
	for (const file of unhashed) {
		const m = cacheControl(urlOf(file)).match(/^public, max-age=(\d+)$/);
		assert.ok(m && Number(m[1]) > 0 && Number(m[1]) <= SHORT_MAX, `${file} : « ${cacheControl(urlOf(file))} »`);
	}
});

test('robots.txt et sitemap.xml ne reçoivent aucun en-tête', () => {
	for (const path of ['/robots.txt', '/sitemap.xml']) assert.deepEqual(served(path), [], path);
});

test('chaque page annonce en Link exactement les polices préchargées dans son <head>, et elles existent', () => {
	for (const page of pages) {
		const preloads = tags(headOf(readPage(page)), 'link').filter((t) => attr(t, 'rel') === 'preload');
		assert.ok(preloads.length > 0 && preloads.every((t) => attr(t, 'as') === 'font'), `${page} : seules des polices sont préchargées`);
		const announced = links(page).map(fontLink);
		assert.deepEqual(announced.map(({ url }) => url).toSorted(), preloads.map((t) => attr(t, 'href')).toSorted(), page);
		for (const { url, params } of announced) {
			assert.deepEqual(params, ['as=font', 'crossorigin', 'rel=preload', 'type="font/woff2"'], `${page} : ${url}`);
			assert.ok(readDist(url.slice(1), null).length > 0, `${page} : ${url} vide`);
		}
	}
});

test('seules les pages portent des Link', () => {
	for (const file of files.filter((file) => !file.endsWith('.html'))) assert.deepEqual(links(urlOf(file)), [], file);
});
