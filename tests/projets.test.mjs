// Section 01 · Projets : en-tête de section et liste des dépôts sélectionnés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, moduleGraph, readDist, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'projets') ?? '';

test('la section Projets est la cible de l’ancre #projets et porte son h2', () => {
	assert.ok(section, 'aucune <section id="projets">');
	const h2s = elements(section, 'h2');
	assert.equal(h2s.length, 1);
	assert.equal(text(h2s[0]), 'Projets');
});

test('l’en-tête numérote la section et annonce le volume de dépôts', () => {
	const content = text(section);
	assert.match(content, /^01\s*Projets/);
	assert.match(content, /6 sélectionnés · 41 dépôts publics/);
});

test('six projets en liste ordonnée, chacun lié à sa fiche', () => {
	const lists = elements(section, 'ol');
	assert.equal(lists.length, 1);
	const items = elements(lists[0], 'li');
	assert.equal(items.length, 6);
	const hrefs = items.map((li) => {
		const links = tags(li, 'a');
		assert.equal(links.length, 1, 'un seul lien par projet');
		return attr(links[0], 'href');
	});
	assert.deepEqual(
		hrefs,
		[
			'typomaniac',
			'claude-tmux-notify',
			'claude-status-line',
			'pointcloud-viewer',
			'trekker',
			'ma-parcelle',
		].map((slug) => `/projets/${slug}/`),
	);
});

// La flèche suit celle du reste du site : « ↗ » sort vers un autre site, « → » reste sur celui-ci.
test('chaque lien se lit : numéro, nom, description, stack, année', () => {
	const [first, second] = elements(section, 'li').map((li) => text(elements(li, 'a')[0]));
	assert.equal(
		first,
		'01 typomaniac Jeu de dactylo multijoueur : runs solo, duels classés en Bo3, MMR et classement. Serveur de duel autoritaire en WebSocket. TypeScript · Elysia · Bun · React 19 2026 →',
	);
	assert.match(second, /^02 claude-tmux-notify\.nvim Un toast Neovim .* Lua · Neovim · tmux · ★ 3 2026 →$/);
});

// Aperçu A3 : un panneau par projet, rendu au build, que le script de l'accueil fait vivre.
/** Les panneaux de l'aperçu, du début de chacun au début du suivant. */
const panels = (() => {
	const starts = [...section.matchAll(/<[a-z]+\b[^>]*\sdata-panel(?=[\s=>])[^>]*>/g)].map((m) => m.index);
	return starts.map((start, i) => section.slice(start, starts[i + 1] ?? section.length));
})();
/** Texte d'une partie (`desc`, `stack`) de la ligne complète du projet n° `i`. */
const rowPart = (i, part) =>
	text(elements(elements(section, 'li')[i], 'span').find((s) => new RegExp(`class="[^"]*\\b${part}\\b`).test(tags(s, 'span')[0])) ?? '');

// Sans JavaScript, le navigateur ignore `loading="lazy"` et chargerait l'image même masquée : seule
// une source réservée à l'A3 (grand écran, pointeur qui survole, JavaScript actif) la demande.
test('un panneau d’aperçu par projet, chacun avec son image au repos, différée et réservée à l’A3', () => {
	assert.equal(panels.length, PROJECTS.length);
	panels.forEach((panel, i) => {
		const { slug } = PROJECTS[i];
		const [picture] = elements(panel, 'picture');
		assert.ok(picture, `${slug} : image au repos absente`);
		const sources = tags(picture, 'source');
		assert.equal(sources.length, 1, `${slug} : une source`);
		assert.equal(attr(sources[0], 'srcset'), `/figures/${slug}.svg`, slug);
		const media = attr(sources[0], 'media') ?? '';
		for (const feature of [/\(min-width:\s*1024px\)/, /\(hover:\s*hover\)/, /\(scripting:\s*enabled\)/]) assert.match(media, feature, slug);
		assert.doesNotMatch(panel.replace(picture, ''), /\/figures\//, `${slug} : figure demandée hors de la source A3`);
		const images = tags(picture, 'img');
		assert.equal(images.length, 1, `${slug} : une image au repos`);
		const [image] = images;
		assert.equal(attr(image, 'src'), undefined, `${slug} : l’image ne demande rien hors de l’A3`);
		assert.equal(attr(image, 'loading'), 'lazy', `${slug} : chargement différé`);
		// Ses dimensions réservent la place de la figure avant même son arrivée.
		assert.match(attr(image, 'width') ?? '', /^\d+$/, `${slug} : largeur`);
		assert.match(attr(image, 'height') ?? '', /^\d+$/, `${slug} : hauteur`);
	});
});

test('le projet 01 est sélectionné dès le build : sa ligne et son panneau, eux seuls', () => {
	const rows = elements(section, 'li').map((li) => tags(li, 'a')[0]);
	assert.deepEqual(rows.map((row) => hasAttr(row, 'data-selected')), [true, false, false, false, false, false]);
	const openings = panels.map((panel) => panel.match(/^<[^>]*>/)?.[0] ?? '');
	assert.deepEqual(openings.map((tag) => hasAttr(tag, 'data-active')), [true, false, false, false, false, false]);
});

test('chaque panneau montre la carte vivante, la description, la stack et le lien vers la fiche', () => {
	panels.forEach((panel, i) => {
		const { slug, repo } = PROJECTS[i];
		const [figure] = elements(panel, 'figure');
		assert.ok(figure, `${slug} : carte absente`);
		const scenes = tags(figure, 'div').filter((t) => attr(t, 'data-motion') !== undefined);
		assert.equal(scenes.length, 1, `${slug} : une scène qui nomme son module de mouvement`);
		assert.equal(attr(scenes[0], 'tabindex'), undefined, `${slug} : scène focalisable sans script`);
		// Fig. 0n, la machine, la consigne et le relevé.
		assert.match(text(figure), new RegExp(`^Fig\\. 0${i + 1} \\S.*\\S$`), slug);
		assert.ok(tags(figure, 'span').some((t) => hasAttr(t, 'data-releve')), `${slug} : relevé absent`);
		assert.equal(elements(figure, 'figcaption').length, 0, `${slug} : pas de légende dans l’aperçu`);

		const rest = text(panel.replace(figure, ''));
		assert.ok(rest.startsWith(`${rowPart(i, 'desc')} ${rowPart(i, 'stack')} Ouvrir la fiche →`), `${slug} : « ${rest} »`);

		const links = tags(panel, 'a');
		assert.equal(links.length, 1, `${slug} : un seul lien`);
		assert.equal(attr(links[0], 'href'), `/projets/${slug}/`, slug);
		assert.match(attr(links[0], 'aria-label') ?? '', new RegExp(`^Ouvrir la fiche ${repo.replace('.', '\\.')}$`), slug);
	});
});

/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);

// Hors de l'A3 (téléphone, toucher, sans survol), l'accueil reste léger : il ne télécharge que son
// script d'amorce. L'aperçu, le chargeur des fiches et la mise en avant des pièces n'arrivent qu'une
// fois la bascule vérifiée, par import dynamique.
test('l’aperçu vit par le chargeur des fiches, importé à la demande seulement en A3', () => {
	const scripts = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
	assert.equal(scripts.length, 1, 'un seul script module');
	const home = moduleGraph(attr(scripts[0], 'src') ?? '');
	assert.ok(!home.code.includes('/motion.ts'), `le chargeur arrive avec la page : ${home.paths.join(', ')}`);
	assert.ok(!home.code.includes('data-piece'), `la mise en avant des pièces arrive avec la page : ${home.paths.join(', ')}`);
	// L'amorce et l'assistant d'import à la demande de Vite : 5,8 Ko avec le chargeur et l'aperçu.
	const weight = home.paths.reduce((sum, path) => sum + readDist(path.slice(1)).length, 0);
	assert.ok(weight <= 2500, `script d’amorce de ${weight} o`);

	const preview = onDemand(home.code).map(moduleGraph);
	assert.ok(preview.length > 0, 'aucun morceau chargé à la demande');
	const motions = new Set(panels.map((panel) => attr(tags(panel, 'div').find((t) => attr(t, 'data-motion') !== undefined) ?? '', 'data-motion')));
	for (const motion of motions) assert.ok(preview.some((graph) => graph.code.includes(`./${motion}/motion.ts`)), `le chargeur ne connaît pas le module « ${motion} »`);

	// Un seul chargeur : le même morceau sert l'accueil et les fiches.
	const fiche = readFiche(PROJECTS[0].slug);
	const ficheScript = tags(fiche, 'script').find((t) => attr(t, 'type') === 'module') ?? '';
	const ficheGraph = moduleGraph(attr(ficheScript, 'src') ?? '');
	const loaders = (paths) => paths.filter((path) => readDist(path.slice(1)).includes('/motion.ts'));
	const homeLoaders = loaders([...new Set(preview.flatMap((graph) => graph.paths))]);
	const shared = homeLoaders.filter((path) => loaders(ficheGraph.paths).includes(path));
	assert.equal(shared.length, 1, `chargeurs : accueil ${homeLoaders}, fiche ${loaders(ficheGraph.paths)}`);

	for (const path of [...preview.flatMap((graph) => graph.paths), ...preview.flatMap((graph) => onDemand(graph.code))]) {
		assert.ok(!html.includes(path.slice('/_astro/'.length)), `le morceau ${path} est chargé avec la page`);
	}
});

// La description et la stack sont lues dans la ligne ; leur doublon visuel dans l'aperçu est tu.
test('le texte doublé de l’aperçu est ignoré des technologies d’assistance', () => {
	panels.forEach((panel, i) => {
		const { slug } = PROJECTS[i];
		for (const part of ['desc', 'stack']) {
			// L'élément de l'aperçu qui porte ce texte, et lui seul.
			const holder = [...panel.matchAll(/<[a-z]+\b[^>]*>([^<]*)(?=<)/g)].find((m) => text(m[1]) === rowPart(i, part));
			assert.ok(holder, `${slug} : ${part} absente de l’aperçu`);
			assert.equal(attr(holder[0], 'aria-hidden'), 'true', `${slug} : ${part} lue deux fois`);
		}
	});
});

// Fig., machine, consigne et relevé de la carte de l'aperçu : doublon visuel, tu comme la description.
// La scène, elle, reste lue : le mouvement lui donne son rôle et son libellé.
test('les textes de la carte de l’aperçu sont ignorés des technologies d’assistance, pas sa scène', () => {
	panels.forEach((panel, i) => {
		const { slug } = PROJECTS[i];
		const [figure] = elements(panel, 'figure');
		const spoken = figure.replace(/<(\w+)\b[^>]*\saria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '');
		assert.equal(text(spoken), '', `${slug} : « ${text(spoken)} » lu depuis l’aperçu`);
		assert.ok(tags(spoken, 'div').some((t) => attr(t, 'data-motion') !== undefined), `${slug} : scène masquée`);
	});
});
