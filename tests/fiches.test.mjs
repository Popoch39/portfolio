// Fiches projet : une page par projet et par version, avec son héros, son anatomie et la navigation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, PROJECTS, moduleGraph, readDist, readFiche, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		file: (repo) => `~/projets/${repo}.md`,
		rank: 'projet',
		terms: ['Stack', 'Année', 'Dépôt'],
		anatomy: 'Anatomie',
		note: (n) => `${n} pièces · une seule les compte`,
		partsList: 'Nomenclature',
		others: 'Autres projets',
		previous: (rank) => `← précédent · ${rank}`,
		next: (rank) => `${rank} · suivant →`,
		status: (repo) => `~/louis/projets/${repo}.md`,
		count: (n) => `Fig. 1 · ${n} pièces`,
	},
	{
		locale: 'en',
		file: (repo) => `~/projects/${repo}.md`,
		rank: 'project',
		terms: ['Stack', 'Year', 'Repository'],
		anatomy: 'Anatomy',
		note: (n) => `${n} parts · only one counts`,
		partsList: 'Parts list',
		others: 'Other projects',
		previous: (rank) => `← previous · ${rank}`,
		next: (rank) => `${rank} · next →`,
		status: (repo) => `~/louis/projects/${repo}.md`,
		count: (n) => `Fig. 1 · ${n} parts`,
	},
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Le SVG de la figure : le seul `<svg role="img">` de la section. */
const figureSvgIn = (section) => elements(section, 'svg').filter((svg) => attr(tags(svg, 'svg')[0], 'role') === 'img');
/** Lignes de la nomenclature : les `<li>` qui portent un crochet de pièce. */
const piecesIn = (section) => elements(section, 'li').filter((li) => attr(tags(li, 'li')[0], 'data-piece') !== undefined);
const hooksOf = (svg) => tags(svg, 'g').filter((g) => attr(g, 'data-piece') !== undefined);

for (const version of VERSIONS) {
	const { locale } = version;
	const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug, locale) }));
	/** La section anatomie : celle dont le h2 est « Anatomie » (« Anatomy »). */
	const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(version.anatomy)) ?? '';
	const figureSvgOf = (html) => figureSvgIn(anatomyOf(html));
	const piecesOf = (html) => piecesIn(anatomyOf(html));

	test(`${locale} : six fiches, chacune avec un seul h1 : le nom exact du dépôt`, () => {
		for (const { repo, html } of fiches) {
			const h1s = elements(html, 'h1');
			assert.equal(h1s.length, 1, `${repo} : un seul h1`);
			assert.equal(text(h1s[0]), repo);
		}
	});

	test(`${locale} : le héros situe la fiche : fichier ouvert et rang du projet`, () => {
		fiches.forEach(({ repo, html }, index) => {
			const hero = elements(html, 'section')[0] ?? '';
			assert.match(text(hero), new RegExp(`^-- NORMAL -- ${escape(version.file(repo))} ${version.rank} 0${index + 1} / 06`));
		});
	});

	test(`${locale} : le héros donne une accroche avec un seul mot en emphase`, () => {
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

	test(`${locale} : le héros liste ${version.terms.join(', ')}, avec le lien vers le dépôt`, () => {
		for (const { repo, html } of fiches) {
			const [dl] = elements(html, 'dl');
			assert.ok(dl, `${repo} : liste de définitions absente`);
			assert.deepEqual(elements(dl, 'dt').map(text), version.terms);
			const [stack, year, depot] = elements(dl, 'dd');
			assert.ok(text(stack).length > 0);
			assert.match(text(year), /^20\d\d$/);
			assert.deepEqual(tags(depot, 'a').map((a) => attr(a, 'href')), [`https://github.com/Popoch39/${repo}`]);
		}
	});

	test(`${locale} : la section « A · ${version.anatomy} » annonce ses pièces : « ${version.note('N')} »`, () => {
		for (const { repo, html } of fiches) {
			const section = anatomyOf(html);
			assert.ok(section, `${repo} : section ${version.anatomy} absente`);
			assert.match(text(section), new RegExp(`^A\\s*${version.anatomy}\\s*${escape(version.note(piecesOf(html).length))}`));
		}
	});

	test(`${locale} : une figure role="img" avec un libellé, dans une carte : Fig. 1, titre, consigne, relevé au repos`, () => {
		for (const { repo, html } of fiches) {
			const svgs = figureSvgOf(html);
			assert.equal(svgs.length, 1, `${repo} : une seule figure`);
			const label = attr(tags(svgs[0], 'svg')[0], 'aria-label') ?? '';
			assert.ok(label.length > 30, `${repo} : libellé de figure absent ou trop court`);
			const [figure] = elements(anatomyOf(html), 'figure');
			const card = text(figure.replace(svgs[0], ''));
			assert.match(card, /^Fig\. 1\s*\S/, `${repo} : « Fig. 1 » puis le titre`);
			const releve = tags(figure, 'span').find((t) => hasAttr(t, 'data-releve'));
			assert.ok(releve, `${repo} : relevé absent`);
			const releveText = text(figure.slice(figure.indexOf(releve)).match(/^<span[^>]*>[\s\S]*?<\/span>/)?.[0] ?? '');
			assert.ok(releveText.length > 0, `${repo} : relevé vide`);
		}
	});

	test(`${locale} : le chargeur monte le mouvement de la figure, chargé à la demande dans un morceau séparé`, () => {
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

	test(`${locale} : chaque fiche monte sa propre anatomie, et le chargeur ne connaît que celles des six projets`, () => {
		const known = new Set();
		for (const { slug, repo, html } of fiches) {
			const [scene] = tags(anatomyOf(html), 'div').filter((t) => attr(t, 'data-motion') !== undefined);
			assert.equal(attr(scene ?? '', 'data-motion'), slug, `${repo} : la scène ne monte pas le module du projet`);
			const [loader] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
			for (const [, folder] of moduleGraph(attr(loader, 'src') ?? '').code.matchAll(/\.\/([\w-]+)\/motion\.ts/g)) known.add(folder);
		}
		assert.deepEqual([...known].sort(), PROJECTS.map(({ slug }) => slug).sort());
	});

	test(`${locale} : la légende vraie suit la carte : « Fig. 1 — … »`, () => {
		for (const { repo, html } of fiches) {
			const [caption] = elements(anatomyOf(html), 'figcaption');
			assert.ok(caption, `${repo} : légende absente`);
			assert.match(text(caption), /^Fig\. 1 — \S.{30,}/);
		}
	});

	test(`${locale} : la nomenclature compte 5 à 8 pièces, en liste ordonnée sous son titre « ${version.partsList} »`, () => {
		for (const { repo, html } of fiches) {
			const section = anatomyOf(html);
			assert.deepEqual(elements(section, 'h3').map(text), [version.partsList], repo);
			const [ol] = elements(section, 'ol');
			const items = elements(ol ?? '', 'li');
			assert.ok(items.length >= 5 && items.length <= 8, `${repo} : ${items.length} pièces`);
			assert.equal(piecesOf(html).length, items.length, `${repo} : chaque ligne porte son crochet de pièce`);
			items.forEach((li, index) => assert.match(text(li), new RegExp(`^0${index + 1}\\s*\\S`), `${repo} : numéro de la pièce ${index + 1}`));
		}
	});

	test(`${locale} : les identifiants de la nomenclature sont exactement les crochets de pièce du SVG`, () => {
		for (const { repo, html } of fiches) {
			const ids = piecesOf(html).map((li) => attr(tags(li, 'li')[0], 'data-piece'));
			assert.ok(ids.length > 0, `${repo} : nomenclature vide`);
			assert.equal(new Set(ids).size, ids.length, `${repo} : identifiants en double`);
			const hooks = new Set(hooksOf(figureSvgOf(html)[0] ?? '').map((g) => attr(g, 'data-piece')));
			assert.deepEqual([...hooks].sort(), [...ids].sort(), repo);
		}
	});

	test(`${locale} : une seule pièce maîtresse, la même dans la nomenclature et dans le SVG`, () => {
		for (const { repo, html } of fiches) {
			const masters = piecesOf(html).filter((li) => hasAttr(tags(li, 'li')[0], 'data-master'));
			assert.equal(masters.length, 1, `${repo} : une seule pièce maîtresse`);
			const masterId = attr(tags(masters[0], 'li')[0], 'data-piece');
			const svgMasters = new Set(hooksOf(figureSvgOf(html)[0] ?? '').filter((g) => hasAttr(g, 'data-master')).map((g) => attr(g, 'data-piece')));
			assert.deepEqual([...svgMasters], [masterId], repo);
		}
	});

	test(`${locale} : les liens précédent et suivant enchaînent les fiches de la version, en boucle de 06 à 01`, () => {
		fiches.forEach(({ repo, html }, index) => {
			const nav = elements(html, 'nav').find((n) => attr(tags(n, 'nav')[0], 'aria-label') === version.others);
			assert.ok(nav, `${repo} : navigation « ${version.others} » absente`);
			const previous = PROJECTS[(index + PROJECTS.length - 1) % PROJECTS.length];
			const next = PROJECTS[(index + 1) % PROJECTS.length];
			const links = elements(nav, 'a');
			assert.deepEqual(
				links.map((a) => attr(tags(a, 'a')[0], 'href')),
				[FICHE[locale](previous.slug), FICHE[locale](next.slug)],
			);
			const rank = (project) => String(PROJECTS.indexOf(project) + 1).padStart(2, '0');
			assert.equal(text(links[0]), `${version.previous(rank(previous))} ${previous.repo}`);
			assert.equal(text(links[1]), `${version.next(rank(next))} ${next.repo}`);
		});
	});

	test(`${locale} : la barre d’état nomme le fichier de la fiche et compte les pièces de la figure`, () => {
		for (const { repo, html } of fiches) {
			const footers = elements(html, 'footer');
			assert.equal(footers.length, 1, `${repo} : une barre d'état`);
			const status = text(footers[0]);
			assert.ok(status.includes(version.status(repo)), `${repo} : fichier absent de « ${status} »`);
			const count = version.count(piecesOf(html).length);
			assert.ok(status.includes(count), `${repo} : « ${count} » absent de « ${status} »`);
		}
	});

	test(`${locale} : chaque pièce mène à son code : permalien GitHub figé sur un SHA complet, avec plage de lignes`, () => {
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
}

/**
 * Les textes propres à l'anatomie d'une fiche (contrat des anatomies) : titre, accroche, consignes,
 * relevé, légende, libellé de la figure, nom et rôle de chaque pièce. Le cadre de la fiche n'en fait
 * pas partie : il suit toujours la langue de la page.
 */
function anatomyTexts(html, anatomy) {
	const section = elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(anatomy)) ?? '';
	const [figure] = elements(section, 'figure');
	const [svg] = figureSvgIn(section);
	const byClass = (fragment, name, cls) => elements(fragment, name).filter((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, name)[0]));
	const [hero] = elements(html, 'section');
	return {
		title: text(elements(head(html), 'title')[0] ?? ''),
		lede: text(elements(hero ?? '', 'p')[0] ?? ''),
		heading: text((figure ?? '').match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? ''),
		consignes: byClass(figure ?? '', 'span', 'consigne').map(text),
		releve: text((figure ?? '').match(/data-releve[^>]*>([^<]*)</)?.[1] ?? ''),
		caption: text(elements(section, 'figcaption')[0] ?? '').replace(/^Fig\. 1 — /, ''),
		label: attr(tags(svg ?? '', 'svg')[0] ?? '', 'aria-label'),
		pieces: piecesIn(section).map((li) => [text(byClass(li, 'span', 'name')[0] ?? ''), text((byClass(li, 'span', 'role')[0] ?? '').replace(/<a\b[\s\S]*<\/a>/, ''))]),
	};
}
const head = (html) => elements(html, 'head')[0] ?? '';

// Contrat des anatomies, phase « expand » : un texte encore en chaîne seule est français, et la
// fiche anglaise l'affiche faute de traduction. Une anatomie pas encore traduite (son titre SEO est
// le même dans les deux versions) s'y montre donc en français, entière et sans erreur.
test('en : une anatomie pas encore traduite s’affiche en français, entière, sur la fiche anglaise', () => {
	for (const { slug, repo } of PROJECTS) {
		const fr = anatomyTexts(readFiche(slug, 'fr'), 'Anatomie');
		const en = anatomyTexts(readFiche(slug, 'en'), 'Anatomy');
		assert.ok(en.pieces.length >= 5 && en.pieces.every(([name, role]) => name && role), `${repo} : nomenclature anglaise incomplète`);
		if (en.title !== fr.title) continue;
		assert.deepEqual(en, fr, `${repo} : anatomie à moitié traduite`);
	}
});
