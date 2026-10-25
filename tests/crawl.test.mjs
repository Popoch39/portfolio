// Ce que lisent les robots d'exploration : robots.txt et sitemap.xml, dérivés de l'URL
// du site (le seul réglage à changer avec le domaine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDist, readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const head = elements(readHome(), 'head')[0] ?? '';
const linkHref = (rel) => attr(tags(head, 'link').find((t) => attr(t, 'rel') === rel) ?? '', 'href');

test('robots.txt autorise l’exploration et donne l’URL absolue du sitemap', () => {
	const robots = readDist('robots.txt');
	assert.match(robots, /^User-agent: \*$/m);
	assert.match(robots, /^Allow: \/$/m);
	const sitemap = robots.match(/^Sitemap: (\S+)$/m)?.[1];
	assert.ok(sitemap, 'ligne Sitemap absente');
	assert.ok(URL.canParse(sitemap), `URL de sitemap non absolue : ${sitemap}`);
	assert.equal(new URL(sitemap).pathname, '/sitemap.xml');
});

test('sitemap.xml liste la page d’accueil à son URL canonique', () => {
	const sitemap = readDist('sitemap.xml');
	assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
	assert.match(sitemap, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
	const locs = elements(sitemap, 'loc').map(text);
	assert.deepEqual(locs, [linkHref('canonical')]);
});

test('la page signale son sitemap dans le <head>', () => {
	const href = linkHref('sitemap');
	assert.ok(href, '<link rel="sitemap"> absent');
	assert.equal(new URL(href, 'https://x.invalid/').pathname, '/sitemap.xml');
});
