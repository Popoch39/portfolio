// Ce que les moteurs et les réseaux lisent d'une fiche, dans chaque version : <head>, Open Graph,
// JSON-LD ; et l'en-tête du site, qui ramène aux sections de l'accueil de la même langue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, readDist, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

// L'image française garde l'adresse d'avant l'anglais ; l'anglaise se range à côté, comme celle de l'accueil.
const VERSIONS = [
	{
		locale: 'fr',
		sections: ['projets', 'parcours', 'activite', 'stack', 'contact'],
		image: (slug) => `/og/${slug}.png`,
		alt: (repo) => `${repo} en lettres capitales condensées, suivi d’un curseur bleu, avec sa figure au repos, « `,
	},
	{
		locale: 'en',
		sections: ['projects', 'career', 'activity', 'stack', 'contact'],
		image: (slug) => `/og/${slug}.en.png`,
		alt: (repo) => `${repo} in condensed capitals, followed by a blue cursor, with its figure at rest, “`,
	},
];

const headOf = (html) => elements(html, 'head')[0] ?? '';
const meta = (head, key, value) => attr(tags(head, 'meta').find((t) => attr(t, key) === value) ?? '', 'content');
const linkHref = (head, rel) => attr(tags(head, 'link').find((t) => attr(t, 'rel') === rel) ?? '', 'href');
const jsonLd = (html) =>
	elements(html, 'script')
		.filter((s) => attr(tags(s, 'script')[0], 'type') === 'application/ld+json')
		.map((s) => s.replace(/^<script\b[^>]*>|<\/script>$/g, ''));

for (const { locale, sections, image: imagePath, alt } of VERSIONS) {
	const homePerson = JSON.parse(jsonLd(readHome(locale))[0]);
	const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug, locale) }));

	test(`${locale} : chaque fiche a son titre, sa description et son URL canonique absolue`, () => {
		for (const { slug, repo, html } of fiches) {
			const head = headOf(html);
			const [title] = elements(head, 'title');
			assert.ok(text(title ?? '').includes(repo), `${repo} : le titre nomme le dépôt`);
			assert.ok((meta(head, 'name', 'description') ?? '').length > 50, `${repo} : description absente ou trop courte`);
			const canonical = linkHref(head, 'canonical');
			assert.ok(URL.canParse(canonical), `${repo} : canonique non absolue`);
			assert.equal(new URL(canonical).pathname, FICHE[locale](slug));
		}
	});

	test(`${locale} : Open Graph décrit la fiche`, () => {
		for (const { repo, html } of fiches) {
			const head = headOf(html);
			assert.equal(meta(head, 'property', 'og:url'), linkHref(head, 'canonical'), repo);
			assert.equal(meta(head, 'property', 'og:title'), text(elements(head, 'title')[0]), repo);
			assert.equal(meta(head, 'property', 'og:description'), meta(head, 'name', 'description'), repo);
			assert.equal(meta(head, 'property', 'og:type'), 'website', `${repo} : une fiche n'est pas un profil`);
			assert.deepEqual(tags(head, 'meta').filter((t) => (attr(t, 'property') ?? '').startsWith('profile:')), [], repo);
		}
	});

	test(`${locale} : chaque fiche a sa propre image de partage : PNG 1200×630 en URL absolue, avec texte alternatif de la langue`, () => {
		for (const { slug, repo, html } of fiches) {
			const head = headOf(html);
			const image = meta(head, 'property', 'og:image');
			assert.ok(image && URL.canParse(image), `${repo} : og:image absente ou non absolue : ${image}`);
			assert.equal(new URL(image).origin, new URL(linkHref(head, 'canonical')).origin, repo);
			assert.equal(new URL(image).pathname, imagePath(slug), `${repo} : l'image de la fiche dans sa langue, pas celle du site`);
			assert.equal(meta(head, 'property', 'og:image:type'), 'image/png', repo);
			assert.equal(meta(head, 'property', 'og:image:width'), '1200', repo);
			assert.equal(meta(head, 'property', 'og:image:height'), '630', repo);
			assert.ok((meta(head, 'property', 'og:image:alt') ?? '').startsWith(alt(repo)), `${repo} : le texte alternatif nomme le projet dans la langue de la fiche`);
			assert.equal(meta(head, 'name', 'twitter:card'), 'summary_large_image', `${repo} : carte Twitter grand format`);
		}
	});

	test(`${locale} : l’image de partage de chaque fiche est livrée par le site : un PNG de 1200×630`, () => {
		for (const { repo, html } of fiches) {
			const png = readDist(new URL(meta(headOf(html), 'property', 'og:image')).pathname.slice(1), null);
			assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${repo} : signature PNG absente`);
			// Premier bloc IHDR : largeur puis hauteur, entiers 32 bits gros-boutistes.
			assert.equal(png.toString('latin1', 12, 16), 'IHDR', repo);
			assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], repo);
		}
	});

	test(`${locale} : un seul JSON-LD SoftwareSourceCode : dépôt, langage, langue, URL, et pour auteur la Person du site`, () => {
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
			assert.equal(data.inLanguage, locale, `${repo} : langue de la description`);
			assert.equal(data.url, linkHref(headOf(html), 'canonical'));
			assert.ok((data.description ?? '').length > 50, `${repo} : description absente`);
			// Celle de l'accueil de la même version : champs traduits, même identifiant dans les deux.
			assert.deepEqual(data.author, person, `${repo} : l'auteur est la Person de l'accueil`);
			assert.ok(URL.canParse(data.author['@id'] ?? ''), `${repo} : la Person n'a pas d'identifiant`);
		}
	});

	// Le sélecteur de langue, en fin de navigation, est vérifié par i18n.test.mjs.
	test(`${locale} : l’en-tête ramène aux sections de l’accueil de la version et marque « Projets » comme courant`, () => {
		const anchors = sections.map((id) => `${HOME[locale]}#${id}`);
		for (const { repo, html } of fiches) {
			const [nav] = elements(html, 'nav');
			const links = tags(nav, 'a').filter((a) => !hasAttr(a, 'hreflang'));
			assert.deepEqual(
				links.map((a) => attr(a, 'href')),
				anchors,
				repo,
			);
			assert.deepEqual(links.filter((a) => hasAttr(a, 'aria-current')).map((a) => attr(a, 'href')), [anchors[0]], repo);
		}
	});
}

test('chaque version d’une fiche a sa propre image de partage', () => {
	const imageOf = (slug, locale) => new URL(meta(headOf(readFiche(slug, locale)), 'property', 'og:image')).pathname.slice(1);
	for (const { slug, repo } of PROJECTS) {
		assert.notDeepEqual(readDist(imageOf(slug, 'fr'), null), readDist(imageOf(slug, 'en'), null), repo);
	}
});

test('la Person des fiches a le même identifiant dans les deux versions', () => {
	const ids = VERSIONS.map(({ locale }) => JSON.parse(jsonLd(readFiche(PROJECTS[0].slug, locale))[0]).author['@id']);
	assert.equal(ids[0], ids[1]);
});
