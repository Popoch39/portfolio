// Ce que les moteurs et les réseaux lisent d'une fiche : <head>, Open Graph, JSON-LD ; et
// l'en-tête du site, qui ramène aux sections de l'accueil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const headOf = (html) => elements(html, 'head')[0] ?? '';
const meta = (head, key, value) => attr(tags(head, 'meta').find((t) => attr(t, key) === value) ?? '', 'content');
const linkHref = (head, rel) => attr(tags(head, 'link').find((t) => attr(t, 'rel') === rel) ?? '', 'href');
const jsonLd = (html) =>
	elements(html, 'script')
		.filter((s) => attr(tags(s, 'script')[0], 'type') === 'application/ld+json')
		.map((s) => s.replace(/^<script\b[^>]*>|<\/script>$/g, ''));

const home = readHome();
const homePerson = JSON.parse(jsonLd(home)[0]);
const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug) }));

test('chaque fiche a son titre, sa description et son URL canonique absolue', () => {
	for (const { slug, repo, html } of fiches) {
		const head = headOf(html);
		const [title] = elements(head, 'title');
		assert.ok(text(title ?? '').includes(repo), `${repo} : le titre nomme le dépôt`);
		assert.ok((meta(head, 'name', 'description') ?? '').length > 50, `${repo} : description absente ou trop courte`);
		const canonical = linkHref(head, 'canonical');
		assert.ok(URL.canParse(canonical), `${repo} : canonique non absolue`);
		assert.equal(new URL(canonical).pathname, `/projets/${slug}/`);
	}
});

test('Open Graph décrit la fiche, avec l’image du site pour l’instant', () => {
	const siteImage = meta(headOf(home), 'property', 'og:image');
	for (const { repo, html } of fiches) {
		const head = headOf(html);
		assert.equal(meta(head, 'property', 'og:url'), linkHref(head, 'canonical'), repo);
		assert.equal(meta(head, 'property', 'og:title'), text(elements(head, 'title')[0]), repo);
		assert.equal(meta(head, 'property', 'og:description'), meta(head, 'name', 'description'), repo);
		assert.equal(meta(head, 'property', 'og:type'), 'website', `${repo} : une fiche n'est pas un profil`);
		assert.deepEqual(tags(head, 'meta').filter((t) => (attr(t, 'property') ?? '').startsWith('profile:')), [], repo);
		assert.equal(meta(head, 'property', 'og:image'), siteImage, repo);
	}
});

test('un seul JSON-LD SoftwareSourceCode : dépôt, langage, URL, et pour auteur la Person du site', () => {
	const { '@context': _context, ...person } = homePerson;
	for (const { repo, html } of fiches) {
		const blocks = jsonLd(html);
		assert.equal(blocks.length, 1, `${repo} : un seul bloc JSON-LD`);
		assert.ok(headOf(html).includes(blocks[0]), `${repo} : JSON-LD hors du <head>`);
		const data = JSON.parse(blocks[0]);
		assert.equal(data['@context'], 'https://schema.org');
		assert.equal(data['@type'], 'SoftwareSourceCode');
		assert.equal(data.name, repo);
		assert.equal(data.codeRepository, `https://github.com/Popoch39/${repo}`);
		assert.match(data.programmingLanguage ?? '', /^\S/, `${repo} : langage absent`);
		assert.equal(data.url, linkHref(headOf(html), 'canonical'));
		assert.ok((data.description ?? '').length > 50, `${repo} : description absente`);
		assert.deepEqual(data.author, person, `${repo} : l'auteur est la Person de l'accueil`);
	}
});

test('l’en-tête ramène aux sections de l’accueil et marque « Projets » comme courant', () => {
	for (const { repo, html } of fiches) {
		const [nav] = elements(html, 'nav');
		const links = tags(nav, 'a');
		assert.deepEqual(
			links.map((a) => attr(a, 'href')),
			['/#projets', '/#parcours', '/#activite', '/#stack', '/#contact'],
			repo,
		);
		assert.deepEqual(links.filter((a) => hasAttr(a, 'aria-current')).map((a) => attr(a, 'href')), ['/#projets'], repo);
	}
});
