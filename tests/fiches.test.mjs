// Fiches projet : une page par projet, avec son héros, son anatomie et la navigation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, moduleGraph, readDist, readFiche, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug) }));

/** La section anatomie : celle dont le h2 est « Anatomie ». */
const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomie')) ?? '';
/** Le SVG de la figure : le seul `<svg role="img">` de la section. */
const figureSvgOf = (html) => elements(anatomyOf(html), 'svg').filter((svg) => attr(tags(svg, 'svg')[0], 'role') === 'img');
/** Lignes de la nomenclature : les `<li>` qui portent un crochet de pièce. */
const piecesOf = (html) => elements(anatomyOf(html), 'li').filter((li) => attr(tags(li, 'li')[0], 'data-piece') !== undefined);
const hooksOf = (svg) => tags(svg, 'g').filter((g) => attr(g, 'data-piece') !== undefined);

test('six fiches, chacune avec un seul h1 : le nom exact du dépôt', () => {
	for (const { repo, html } of fiches) {
		const h1s = elements(html, 'h1');
		assert.equal(h1s.length, 1, `${repo} : un seul h1`);
		assert.equal(text(h1s[0]), repo);
	}
});

test('le héros situe la fiche : fichier ouvert et rang du projet', () => {
	fiches.forEach(({ repo, html }, index) => {
		const hero = elements(html, 'section')[0] ?? '';
		assert.match(text(hero), new RegExp(`^-- NORMAL -- ~/projets/${repo.replace('.', '\\.')}\\.md projet 0${index + 1} / 06`));
	});
});

test('le héros donne une accroche avec un seul mot en emphase', () => {
	for (const { repo, html } of fiches) {
		const hero = elements(html, 'section')[0] ?? '';
		const [lede, ...others] = elements(hero, 'p');
		assert.ok(lede && others.length === 0, `${repo} : une accroche`);
		const emphases = elements(lede, 'em').map(text);
		assert.equal(emphases.length, 1, `${repo} : une seule emphase`);
		assert.match(emphases[0], /^\S+$/, `${repo} : un seul mot en emphase`);
		assert.ok(text(lede).length > 40, `${repo} : accroche trop courte`);
	}
});

test('le héros liste Stack, Année et Dépôt, avec le lien vers le dépôt', () => {
	for (const { repo, html } of fiches) {
		const [dl] = elements(html, 'dl');
		assert.ok(dl, `${repo} : liste de définitions absente`);
		assert.deepEqual(elements(dl, 'dt').map(text), ['Stack', 'Année', 'Dépôt']);
		const [stack, year, depot] = elements(dl, 'dd');
		assert.ok(text(stack).length > 0);
		assert.match(text(year), /^20\d\d$/);
		assert.deepEqual(tags(depot, 'a').map((a) => attr(a, 'href')), [`https://github.com/Popoch39/${repo}`]);
	}
});

test('la section « A · Anatomie » annonce ses pièces : « N pièces · une seule les compte »', () => {
	for (const { repo, html } of fiches) {
		const section = anatomyOf(html);
		assert.ok(section, `${repo} : section Anatomie absente`);
		assert.match(text(section), new RegExp(`^A\\s*Anatomie\\s*${piecesOf(html).length} pièces · une seule les compte`));
	}
});

test('une figure role="img" avec un libellé, dans une carte : Fig. 1, titre, consigne, relevé au repos', () => {
	for (const { repo, html } of fiches) {
		const svgs = figureSvgOf(html);
		assert.equal(svgs.length, 1, `${repo} : une seule figure`);
		const label = attr(tags(svgs[0], 'svg')[0], 'aria-label') ?? '';
		assert.ok(label.length > 30, `${repo} : libellé de figure absent ou trop court`);
		const [figure] = elements(anatomyOf(html), 'figure');
		const card = text(figure.replace(svgs[0], ''));
		assert.match(card, /^Fig\. 1\s*\S/, `${repo} : « Fig. 1 » puis le titre`);
		const readout = tags(figure, 'span').find((t) => hasAttr(t, 'data-readout'));
		assert.ok(readout, `${repo} : relevé absent`);
		const readoutText = text(figure.slice(figure.indexOf(readout)).match(/^<span[^>]*>[\s\S]*?<\/span>/)?.[0] ?? '');
		assert.ok(readoutText.length > 0, `${repo} : relevé vide`);
	}
});

test('le chargeur monte le mouvement de la figure, chargé à la demande dans un morceau séparé', () => {
	for (const { repo, html } of fiches) {
		const scenes = tags(anatomyOf(html), 'div').filter((t) => attr(t, 'data-motion') !== undefined);
		assert.equal(scenes.length, 1, `${repo} : une scène qui nomme son module de mouvement`);
		const motion = attr(scenes[0], 'data-motion');
		// Sans JavaScript, la figure reste au repos : pas d'arrêt de tabulation sur une scène inerte.
		assert.equal(attr(scenes[0], 'tabindex'), undefined, `${repo} : scène focalisable sans script`);
		const loaders = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
		assert.equal(loaders.length, 1, `${repo} : un chargeur`);
		// Le chargeur, commun à l'accueil, peut vivre dans un morceau que le script importe.
		const loader = moduleGraph(attr(loaders[0], 'src') ?? '').code;
		assert.ok(loader.includes(`./${motion}/motion.ts`), `${repo} : le chargeur ne connaît pas le module « ${motion} »`);
		const chunks = [...loader.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => m[1]);
		assert.ok(chunks.length > 0, `${repo} : aucun morceau chargé à la demande`);
		for (const chunk of chunks) {
			assert.ok(readDist(`_astro/${chunk}`).length > 0, `${repo} : morceau ${chunk} vide`);
			assert.ok(!html.includes(chunk), `${repo} : le morceau ${chunk} est chargé avec la page`);
		}
	}
});

test('la légende vraie suit la carte : « Fig. 1 — … »', () => {
	for (const { repo, html } of fiches) {
		const [caption] = elements(anatomyOf(html), 'figcaption');
		assert.ok(caption, `${repo} : légende absente`);
		assert.match(text(caption), /^Fig\. 1 — \S.{30,}/);
	}
});

test('la nomenclature compte 5 à 8 pièces, en liste ordonnée sous son titre', () => {
	for (const { repo, html } of fiches) {
		const section = anatomyOf(html);
		assert.deepEqual(elements(section, 'h3').map(text), ['Nomenclature'], repo);
		const [ol] = elements(section, 'ol');
		const items = elements(ol ?? '', 'li');
		assert.ok(items.length >= 5 && items.length <= 8, `${repo} : ${items.length} pièces`);
		assert.equal(piecesOf(html).length, items.length, `${repo} : chaque ligne porte son crochet de pièce`);
		items.forEach((li, index) => assert.match(text(li), new RegExp(`^0${index + 1}\\s*\\S`), `${repo} : numéro de la pièce ${index + 1}`));
	}
});

test('les identifiants de la nomenclature sont exactement les crochets de pièce du SVG', () => {
	for (const { repo, html } of fiches) {
		const ids = piecesOf(html).map((li) => attr(tags(li, 'li')[0], 'data-piece'));
		assert.ok(ids.length > 0, `${repo} : nomenclature vide`);
		assert.equal(new Set(ids).size, ids.length, `${repo} : identifiants en double`);
		const hooks = new Set(hooksOf(figureSvgOf(html)[0] ?? '').map((g) => attr(g, 'data-piece')));
		assert.deepEqual([...hooks].sort(), [...ids].sort(), repo);
	}
});

test('une seule pièce maîtresse, la même dans la nomenclature et dans le SVG', () => {
	for (const { repo, html } of fiches) {
		const masters = piecesOf(html).filter((li) => hasAttr(tags(li, 'li')[0], 'data-master'));
		assert.equal(masters.length, 1, `${repo} : une seule pièce maîtresse`);
		const masterId = attr(tags(masters[0], 'li')[0], 'data-piece');
		const svgMasters = new Set(hooksOf(figureSvgOf(html)[0] ?? '').filter((g) => hasAttr(g, 'data-master')).map((g) => attr(g, 'data-piece')));
		assert.deepEqual([...svgMasters], [masterId], repo);
	}
});

test('les liens précédent et suivant enchaînent les fiches, en boucle de 06 à 01', () => {
	fiches.forEach(({ repo, html }, index) => {
		const nav = elements(html, 'nav').find((n) => attr(tags(n, 'nav')[0], 'aria-label') === 'Autres projets');
		assert.ok(nav, `${repo} : navigation « Autres projets » absente`);
		const previous = PROJECTS[(index + PROJECTS.length - 1) % PROJECTS.length];
		const next = PROJECTS[(index + 1) % PROJECTS.length];
		const links = elements(nav, 'a');
		assert.deepEqual(links.map((a) => attr(tags(a, 'a')[0], 'href')), [`/projets/${previous.slug}/`, `/projets/${next.slug}/`]);
		const rank = (project) => String(PROJECTS.indexOf(project) + 1).padStart(2, '0');
		assert.equal(text(links[0]), `← précédent · ${rank(previous)} ${previous.repo}`);
		assert.equal(text(links[1]), `${rank(next)} · suivant → ${next.repo}`);
	});
});

test('la barre d’état nomme le fichier de la fiche et compte les pièces de la figure', () => {
	for (const { repo, html } of fiches) {
		const footers = elements(html, 'footer');
		assert.equal(footers.length, 1, `${repo} : une barre d'état`);
		const status = text(footers[0]);
		assert.ok(status.includes(`~/louis/projets/${repo}.md`), `${repo} : fichier absent de « ${status} »`);
		assert.ok(status.includes(`Fig. 1 · ${piecesOf(html).length} pièces`), `${repo} : « Fig. 1 · N pièces » absent de « ${status} »`);
	}
});

test('chaque pièce mène à son code : permalien GitHub figé sur un SHA complet, avec plage de lignes', () => {
	for (const { repo, html } of fiches) {
		assert.ok(piecesOf(html).length > 0, `${repo} : nomenclature vide`);
		for (const li of piecesOf(html)) {
			const links = tags(li, 'a');
			assert.equal(links.length, 1, `${repo} : un lien par pièce`);
			const href = attr(links[0], 'href') ?? '';
			const m = href.match(/^https:\/\/github\.com\/Popoch39\/[\w.-]+\/blob\/([0-9a-f]{40})\/([^#]+)#L(\d+)-L(\d+)$/);
			assert.ok(m, `${repo} : permalien invalide ${href}`);
			assert.ok(Number(m[3]) <= Number(m[4]), `${repo} : plage de lignes inversée ${href}`);
			assert.ok(text(li).includes(m[2]), `${repo} : le lien nomme le fichier ${m[2]}`);
		}
	}
});
