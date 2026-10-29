// Section 01 · Projets : en-tête de section et liste des dépôts sélectionnés, dans les deux versions
// de l'accueil. Les textes des anatomies de l'aperçu (machine, consigne, relevé) restent en français.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE, PROJECTS, css, moduleGraph, readDist, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		id: 'projets',
		title: 'Projets',
		note: '6 sélectionnés · 41 dépôts publics',
		ficheOf: (slug) => `/projets/${slug}/`,
		first:
			'01 typomaniac Jeu de dactylo multijoueur : runs solo, duels classés en Bo3, MMR et classement. Serveur de duel autoritaire en WebSocket. TypeScript · Elysia · Bun · React 19 2026 →',
		second: /^02 claude-tmux-notify\.nvim Un toast Neovim .* Lua · Neovim · tmux · ★ 3 2026 →$/,
		open: 'Ouvrir la fiche →',
		openLabel: (repo) => `Ouvrir la fiche ${repo}`,
	},
	{
		locale: 'en',
		id: 'projects',
		title: 'Projects',
		note: '6 selected · 41 public repos',
		ficheOf: (slug) => `/en/projects/${slug}/`,
		first:
			'01 typomaniac Multiplayer typing game: solo runs, ranked best-of-three duels, MMR and a leaderboard. Authoritative WebSocket duel server. TypeScript · Elysia · Bun · React 19 2026 →',
		second: /^02 claude-tmux-notify\.nvim A Neovim toast .* Lua · Neovim · tmux · ★ 3 2026 →$/,
		open: 'Open project page →',
		openLabel: (repo) => `Open the ${repo} project page`,
	},
];

for (const version of VERSIONS) {
	const { locale, id } = version;
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === id) ?? '';

	test(`${locale} : la section ${version.title} est la cible de l’ancre #${id} et porte son h2`, () => {
		assert.ok(section, `aucune <section id="${id}">`);
		const h2s = elements(section, 'h2');
		assert.equal(h2s.length, 1);
		assert.equal(text(h2s[0]), version.title);
	});

	test(`${locale} : l’en-tête numérote la section et annonce le volume de dépôts`, () => {
		const content = text(section);
		assert.match(content, new RegExp(`^01\\s*${version.title}`));
		assert.ok(content.includes(version.note), `« ${version.note} » absent`);
	});

	test(`${locale} : six projets en liste ordonnée, chacun lié à sa fiche`, () => {
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
			['typomaniac', 'claude-tmux-notify', 'claude-status-line', 'pointcloud-viewer', 'trekker', 'ma-parcelle'].map(version.ficheOf),
		);
	});

	// La flèche suit celle du reste du site : « ↗ » sort vers un autre site, « → » reste sur celui-ci.
	test(`${locale} : chaque lien se lit : numéro, nom, description, stack, année`, () => {
		const [first, second] = elements(section, 'li').map((li) => text(elements(li, 'a')[0]));
		assert.equal(first, version.first);
		assert.match(second, version.second);
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
	test(`${locale} : un panneau d’aperçu par projet, chacun avec son image au repos, différée et réservée à l’A3`, () => {
		assert.equal(panels.length, PROJECTS.length);
		panels.forEach((panel, i) => {
			const { slug } = PROJECTS[i];
			const [picture] = elements(panel, 'picture');
			assert.ok(picture, `${slug} : image au repos absente`);
			const sources = tags(picture, 'source');
			assert.equal(sources.length, 1, `${slug} : une source`);
			// La figure de la version : son libellé est dans la langue de la page.
			assert.equal(attr(sources[0], 'srcset'), FIGURE[locale](slug), slug);
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

	// Masqué par `visibility`, un panneau inactif ferait quand même demander et analyser son SVG au repos
	// sur le thread principal, au milieu de la Plongée : hors du rendu, l'image différée n'est pas demandée.
	test(`${locale} : l’image au repos d’un panneau inactif est retirée du rendu, celle du panneau actif non`, () => {
		const styles = css(html);
		const hidden = [...styles.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(([, selector, body]) => /:not\(\[data-active\]\)[^,]*\bimg\b/.test(selector) && /display:\s*none/.test(body));
		assert.equal(hidden.length, 1, 'une règle retire l’image des panneaux inactifs');
	});

	test(`${locale} : le projet 01 est sélectionné dès le build : sa ligne et son panneau, eux seuls`, () => {
		const rows = elements(section, 'li').map((li) => tags(li, 'a')[0]);
		assert.deepEqual(rows.map((row) => hasAttr(row, 'data-selected')), [true, false, false, false, false, false]);
		const openings = panels.map((panel) => panel.match(/^<[^>]*>/)?.[0] ?? '');
		assert.deepEqual(openings.map((tag) => hasAttr(tag, 'data-active')), [true, false, false, false, false, false]);
	});

	test(`${locale} : chaque panneau montre la carte vivante, la description, la stack et le lien vers la fiche`, () => {
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
			assert.ok(rest.startsWith(`${rowPart(i, 'desc')} ${rowPart(i, 'stack')} ${version.open}`), `${slug} : « ${rest} »`);

			const links = tags(panel, 'a');
			assert.equal(links.length, 1, `${slug} : un seul lien`);
			assert.equal(attr(links[0], 'href'), version.ficheOf(slug), slug);
			assert.equal(attr(links[0], 'aria-label'), version.openLabel(repo), slug);
		});
	});

	/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
	const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);

	// Hors de l'A3 (téléphone, toucher, sans survol), l'accueil reste léger : il ne télécharge que son
	// script d'amorce. L'aperçu, le chargeur des fiches et la mise en avant des pièces n'arrivent qu'une
	// fois la bascule vérifiée, par import dynamique.
	test(`${locale} : l’aperçu vit par le chargeur des fiches, importé à la demande seulement en A3`, () => {
		const scripts = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
		assert.equal(scripts.length, 1, 'un seul script module');
		const home = moduleGraph(attr(scripts[0], 'src') ?? '');
		assert.ok(!home.code.includes('/motion.ts'), `le chargeur arrive avec la page : ${home.paths.join(', ')}`);
		assert.ok(!home.code.includes('data-piece'), `la mise en avant des pièces arrive avec la page : ${home.paths.join(', ')}`);
		// L'amorce, l'écouteur de la Lunette (ADR 0007, qui relève le plafond de 2 500 à 4 000 octets),
		// la demande du Glissé (ADR 0010, qui le porte à 4 100), l'écouteur du Buffer (ADR 0016, qui le
		// porte à 4 350) et l'assistant d'import à la demande de Vite ; le chargeur, l'aperçu, la Lunette,
		// le Glissé et le script du Buffer n'en sont pas.
		const weight = home.paths.reduce((sum, path) => sum + readDist(path.slice(1)).length, 0);
		assert.ok(weight <= 4350, `script d’amorce de ${weight} o`);

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
	test(`${locale} : le texte doublé de l’aperçu est ignoré des technologies d’assistance`, () => {
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
	test(`${locale} : les textes de la carte de l’aperçu sont ignorés des technologies d’assistance, pas sa scène`, () => {
		panels.forEach((panel, i) => {
			const { slug } = PROJECTS[i];
			const [figure] = elements(panel, 'figure');
			const spoken = figure.replace(/<(\w+)\b[^>]*\saria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '');
			assert.equal(text(spoken), '', `${slug} : « ${text(spoken)} » lu depuis l’aperçu`);
			assert.ok(tags(spoken, 'div').some((t) => attr(t, 'data-motion') !== undefined), `${slug} : scène masquée`);
		});
	});
}

// La mention de la ligne sélectionnée est écrite par la CSS, qui ne lit pas le dictionnaire.
test('la ligne sélectionnée de l’aperçu annonce « Anatomy → » sur l’accueil anglais', () => {
	const style = elements(readHome('en'), 'style').join('\n');
	assert.match(style, /:lang\(en\)::?after\{content:"Anatomy →"/);
});
