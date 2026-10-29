// Le Tri joué (spec #107, ticket #109) : en défilant jusqu'à l'Activité, la section s'épingle, les niveaux
// du calendrier se fondent en une seule couleur, puis chaque semaine tasse ses Jours actifs vers le bas, en
// vague. Le mouvement se vérifie à la main et en trace ; ici, ce que la page livre : la piste et sa ligne
// de temps, une CSS qui ne joue qu'en mouvement non réduit, dans un navigateur qui sait la jouer, sur le
// compositeur, les 365 cases et leur rang tassé, la plage de chaque semaine et les doublons décoratifs.
// Valeurs attendues recoupées sur l'instantané (colonnes de 7 jours depuis le dimanche 26 octobre 2025).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attr, blocks, css, elementAt, hasAttr, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)[^{]*\(timeline-scope:\s*--tri\)/;
/** Ce qui appartient au Tri joué : ses animations, sa ligne de temps. */
const PLAYED = /@keyframes\s+tri-|\banimation[\w-]*\s*:[^;{}]*\btri-|--tri\b/;
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

const keyframesOf = (styles) => new Map(blocks(styles, /@keyframes\s+tri-[\w-]+/).map((block) => [block.match(/@keyframes\s+([\w-]+)/)[1], block]));

const VERSIONS = [
	{
		locale: 'fr',
		id: 'activite',
		start: '232 jours actifs sur 365',
		notes: [
			'Une seule couleur : un jour actif compte autant qu’un autre, 1 contribution ou 123.',
			'Chaque semaine tassée vers le bas : 4,5 jours actifs par semaine active en moyenne.',
		],
		months: ['nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'],
		scale: ['7 j', '4 j', '1 j'],
	},
	{
		locale: 'en',
		id: 'activity',
		start: '232 active days out of 365',
		notes: [
			'One colour: an active day counts as much as any other, 1 contribution or 123.',
			'Each week packed to the bottom: 4.5 active days per active week on average.',
		],
		months: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct'],
		scale: ['7 d', '4 d', '1 d'],
	},
];

for (const version of VERSIONS) {
	const { locale, id } = version;
	const html = readHome(locale);
	const styles = css(html);
	const section = elementAt(html, html.indexOf(`<section id="${id}"`)) ?? '';

	// Comme la Frise : la piste, hors de l'épingle, porte la ligne de temps que suit toute la scène.
	test(`${locale} : la piste du Tri est dans la section, avant sa scène, et porte sa ligne de temps`, () => {
		const track = tags(section, 'span').find((t) => /\bclass="[^"]*\btri-track\b/.test(t));
		assert.ok(track, 'piste absente');
		assert.equal(attr(track, 'aria-hidden'), 'true');
		assert.ok(section.indexOf(track) < section.search(/<div\b/), 'piste après la scène');
		assert.match(section, /<div class="tri-scene\b/, 'scène absente de l’enveloppe de la piste');
		const rule = [...styles.matchAll(/([^{}]+)\{([^{}]*\bview-timeline\s*:\s*--tri\b[^{}]*)\}/g)];
		assert.equal(rule.length, 1, 'ligne de temps du Tri');
		assert.match(rule[0][1], /\.tri-track\b/);
		// La scène voit la ligne de temps de sa piste, sa sœur : la portée est posée sur la section.
		assert.match(styles, /\.activity(?:\[[^\]]*\])?\{[^{}]*\btimeline-scope\s*:\s*--tri\b/, 'ligne de temps invisible de la scène');
		assert.match(styles, /--tri-length\s*:\s*300svh\b/, 'course du Tri');
	});

	test(`${locale} : le Tri ne joue qu’en mouvement non réduit, dans un navigateur qui sait la jouer`, () => {
		assert.match(styles, PLAYED, 'CSS du Tri absente');
		for (const [condition, outside] of [
			['mouvement non réduit', withoutBlocks(styles, MOTION)],
			['@supports sur --tri', withoutBlocks(styles, SUPPORTED)],
		]) {
			assert.doesNotMatch(outside, PLAYED, `Tri hors de ${condition}`);
			// Sans la scène, ce qui n'appartient qu'à elle se cache : le socle reste tel quel. La vue, qui porte
			// aussi la figure du socle, reste affichée ; seule sa planche se cache.
			const own = [...outside.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(([, selector]) => /\.tri-(?:track|start|board|grid|move|months|scale|note)\b/.test(selector));
			assert.ok(own.length > 0, `aucune règle de la scène hors de ${condition}`);
			for (const [, selector, body] of own) assert.equal(body, 'display:none', `${selector.trim()} hors de ${condition}`);
		}
	});

	test(`${locale} : les @keyframes du Tri n’animent que des propriétés composées`, () => {
		const keyframes = keyframesOf(styles);
		assert.ok(keyframes.size > 0, 'aucune @keyframes tri-');
		for (const [name, block] of keyframes) {
			const properties = new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'));
			assert.deepEqual([...properties].filter((p) => !COMPOSITED.has(p)), [], name);
		}
	});

	// Le repli des scènes (ADR 0009) lit les plages dans le style calculé : elles restent des pourcentages
	// littéraux de la piste (ADR 0014).
	test(`${locale} : chaque animation du Tri suit sa ligne de temps, sous une forme que Chrome accepte`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*\banimation(?:-name)?\s*:[^;{}]*\btri-[^{}]*)\}/g)];
		assert.ok(rules.length > 0, 'aucune animation du Tri');
		for (const [, selector, body] of rules) {
			const shorthand = body.match(/\banimation\s*:([^;}]*)/)?.[1] ?? '';
			assert.match(body, /\banimation-timeline\s*:\s*--tri\b/, selector.trim());
			for (const one of shorthand.split(/,(?![^(]*\))/)) assert.match(one, /\bauto\b/, `${selector.trim()} : ${one.trim()} sans durée auto`);
			assert.doesNotMatch(shorthand, /--tri\b/, `${selector.trim()} : ligne de temps dans le raccourci`);
		}
		for (const [, selector, range] of blocks(styles, SUPPORTED).join('').matchAll(/([^{}]+)\{[^{}]*\banimation-range\s*:([^;}]*)/g))
			assert.match(range, /^(?:contain(?:\s+[\d.]+%)?\s*)+$/, `${selector.trim()} : plage ${range}`);
		const named = new Set(rules.flatMap(([, , body]) => body.match(/\banimation(?:-name)?\s*:([^;}]*)/)[1].match(/\btri-[\w-]+/g)));
		for (const name of named) assert.ok(keyframesOf(styles).has(name), `${name} sans @keyframes`);
		for (const name of keyframesOf(styles).keys()) assert.ok(named.has(name), `@keyframes ${name} jamais jouée`);
	});

	/**
	 * Les colonnes d'un calque de cases : par semaine, chaque case en [rang d'origine, rang tassé ou palier].
	 * Une case sans rang tassé reste à son rang.
	 */
	const layer = (name) => {
		const grid = elementAt(section, section.search(new RegExp(`<div class="[^"]*\\btri-grid\\b[^"]*\\b${name}\\b`)));
		assert.ok(grid, `calque ${name} absent`);
		return [...grid.matchAll(/<span\b[^>]*>(.*?)<\/span>/g)].map(([, column]) =>
			tags(column, 'i').map((cell) => {
				const classes = attr(cell, 'class');
				const row = Number(classes.match(/\br(\d)\b/)[1]);
				return [row, Number(classes.match(/\b[kl](\d)\b/)?.[1] ?? row)];
			}),
		);
	};

	test(`${locale} : les 365 jours sont de vraies cases, sans infobulle, une colonne par semaine`, () => {
		const [empty, flat, levels] = ['tri-empty', 'tri-flat', 'tri-levels'].map(layer);
		for (const columns of [empty, flat, levels]) assert.equal(columns.length, 53);
		assert.equal(empty.flat().length, 133, 'jours vides');
		assert.equal(flat.flat().length, 232, 'Jours actifs');
		// Le calque à niveaux double celui d'une seule couleur, case pour case.
		assert.deepEqual(levels.map((column) => column.map(([row]) => row)), flat.map((column) => column.map(([row]) => row)));
		const grids = section.slice(section.indexOf('<div class="tri-stage'));
		assert.equal(tags(grids, 'i').filter((cell) => attr(cell, 'title') !== undefined).length, 0, 'case avec infobulle');
	});

	// La heatmap GitHub : 1–4, 5–14, 15–49 et 50 contributions ou plus.
	test(`${locale} : le calendrier de départ garde les cinq niveaux de la heatmap`, () => {
		const levels = layer('tri-levels').flat().map(([, level]) => level);
		assert.deepEqual([1, 2, 3, 4].map((level) => levels.filter((l) => l === level).length), [96, 95, 28, 13]);
		// Semaine du 6 septembre : 0, 13, 13, 18, 12, 10, 0 contributions.
		assert.deepEqual(layer('tri-levels')[45], [[1, 2], [2, 2], [3, 3], [4, 2], [5, 2]]);
	});

	test(`${locale} : chaque semaine tasse ses Jours actifs en bas, dans l’ordre des dates, et ses jours vides au-dessus`, () => {
		const [empty, flat] = ['tri-empty', 'tri-flat'].map(layer);
		// Semaine du 26 octobre : 0, 3, 0, 3, 3, 4, 1 contributions.
		assert.deepEqual(flat[0], [[1, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
		assert.deepEqual(empty[0], [[0, 0], [2, 1]]);
		// Semaine du 6 septembre.
		assert.deepEqual(flat[45], [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]);
		assert.deepEqual(empty[45], [[0, 0], [6, 1]]);
		// Une pause ne bouge pas ; la dernière semaine, d'un seul jour, le pose tout en bas.
		assert.deepEqual(empty[9], [0, 1, 2, 3, 4, 5, 6].map((row) => [row, row]));
		assert.deepEqual(flat[52], [[0, 6]]);
		flat.forEach((column, week) => {
			const packed = column.map(([, k]) => k);
			assert.deepEqual(packed, column.map((_, i) => 7 - column.length + i), `semaine ${week}`);
			assert.deepEqual(empty[week].map(([, k]) => k), empty[week].map((_, i) => i), `semaine ${week}`);
		});
	});

	// Planche H2 : la semaine w se tasse sur 5/8 du temps (28–56 %), à partir de 28 % + 28 × 3/8 × w/53.
	test(`${locale} : une plage de tassement par semaine, en vague de la première à la dernière`, () => {
		const ranges = [...blocks(styles, SUPPORTED).join('').matchAll(/\.tri-move>:nth-child\((\d+)\)>i\{animation-range:contain ([\d.]+)% contain ([\d.]+)%\}/g)].map(
			([, nth, from, to]) => [Number(nth), Number(from), Number(to)],
		);
		assert.deepEqual(ranges.map(([nth]) => nth), Array.from({ length: 53 }, (_, i) => i + 1));
		ranges.forEach(([week, from, to], i) => {
			assert.ok(Math.abs(from - (28 + (10.5 * i) / 53)) < 0.001, `semaine ${week} : départ ${from} %`);
			assert.ok(Math.abs(to - from - 17.5) < 0.002, `semaine ${week} : durée ${to - from} %`);
			if (i) assert.ok(from > ranges[i - 1][1], `semaine ${week} avant la précédente`);
		});
		assert.ok(ranges.at(-1)[2] <= 56, 'tassement au-delà de 56 %');
		const pack = keyframesOf(styles).get('tri-pack') ?? '';
		assert.match(pack, /translate:/, 'les cases ne glissent pas');
		// Une case qui garde son rang n'est pas animée : seules les cases au rang tassé jouent `tri-pack`.
		const [player] = [...blocks(styles, SUPPORTED).join('').matchAll(/([^{}]+)\{[^{}]*\banimation\s*:[^;{}]*\btri-pack\b/g)].map(([, s]) => s);
		assert.equal(player, '.tri-move>span>[class*=" k"]');
		const cells = section.slice(section.indexOf('<div class="tri-stage'));
		const still = tags(cells, 'i').filter((cell) => {
			const [, row, packed] = attr(cell, 'class').match(/\br(\d) k(\d)\b/) ?? [];
			return row !== undefined && row === packed;
		});
		assert.deepEqual(still, [], 'case animée qui garde son rang');
	});

	/** La plage posée sur un sélecteur exact par une règle de la scène (liste de sélecteurs comprise). */
	const rangeAt = (selector) => {
		const scene = blocks(styles, SUPPORTED).join('');
		const rule = [...scene.matchAll(/([^{}]+)\{([^{}]*\banimation-range\s*:[^{}]*)\}/g)].findLast(([, s]) => s.split(',').some((one) => one.trim() === selector));
		return rule?.[2].match(/\banimation-range\s*:([^;}]*)/)[1];
	};

	// Planche H2 : `main` à 62–84 %, la semaine w sur 5/8 du temps, à partir de 62 % + 22 × 3/8 × w/53. Ses
	// cases rejoignent son nœud, ses jours vides s'effacent, son nœud grandit, son trait se trace et son
	// étiquette de pause apparaît, tous sur sa plage.
	test(`${locale} : les semaines tassées deviennent \`main\` en vague, de la première à la dernière`, () => {
		const parse = (range = '') => range.match(/^contain ([\d.]+)% contain ([\d.]+)%$/)?.slice(1).map(Number);
		for (let w = 0; w < 53; w++) {
			const n = w + 1;
			const from = 62 + (8.25 * w) / 53;
			const elements = [`.tri-move>:nth-child(${n})`, `.tri-week:nth-child(${n})>*`];
			if (w > 0) elements.push(`.tri-week:nth-child(${n})::before`);
			for (const selector of elements) {
				const range = parse(rangeAt(selector));
				assert.ok(range, `${selector} sans plage`);
				assert.ok(Math.abs(range[0] - from) < 0.001, `${selector} : départ ${range[0]} %`);
				assert.ok(Math.abs(range[1] - from - 13.75) < 0.002, `${selector} : durée ${range[1] - range[0]} %`);
			}
		}
		assert.ok(parse(rangeAt('.tri-week:nth-child(53)>*'))[1] <= 84, '`main` au-delà de 84 %');
	});

	// La scène finit sur le socle : ce qui naît avec `main` part de rien et finit à sa place (aucune étape
	// `to`), ce qui disparaît finit à rien.
	test(`${locale} : chaque élément de \`main\` finit dans l’état du socle`, () => {
		const keyframes = keyframesOf(styles);
		const played = (selector) => {
			const scene = blocks(styles, SUPPORTED).join('');
			const rule = [...scene.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^{}]*)\}/g)].find(([, s]) => s.split(',').some((one) => one.trim().replace(/\[data-astro-cid-\w+\]/g, '') === selector));
			const name = rule?.[2].match(/\banimation\s*:[^;}]*?\b(tri-[\w-]+)/)?.[1];
			assert.ok(name, `${selector} sans animation`);
			return keyframes.get(name);
		};
		const born = (selector, step) => {
			const block = played(selector);
			assert.match(block, new RegExp(`(?:from|0%)(?:,[\\d.]+%)*\\{${step}\\}`), selector);
			assert.doesNotMatch(block, /(?:to|100%)\{/, `${selector} ne finit pas à sa place`);
		};
		born('.tri-node', 'scale:0');
		born('.tri-week[data-link]::before', 'scale:0 1');
		born('.tri-pause', 'opacity:0');
		assert.match(played('.tri-flat>span'), /(?:to|100%)\{scale:0\}/, 'les Jours actifs ne rejoignent pas leur nœud');
		assert.match(played('.tri-empty>span'), /(?:to|100%)\{opacity:0\}/, 'les jours vides restent');
	});

	/** Les éléments complets de la section dont la balise ouvrante porte la classe `name`. */
	const withClass = (name) =>
		[...section.matchAll(new RegExp(`<[a-z]+\\b[^>]*\\sclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"[^>]*>`, 'g'))].map((m) => elementAt(section, m.index));
	const decorative = (element) => {
		const tag = element.match(/^<[^>]*>/)[0];
		return attr(tag, 'aria-hidden') === 'true' && hasAttr(tag, 'data-nosnippet');
	};

	// Le compteur du départ, les notes, les mois et l'échelle doublent le compteur, le tableau et la figure.
	test(`${locale} : les doublons décoratifs de la scène sont cachés aux lecteurs d’écran et exclus des extraits`, () => {
		const [start] = withClass('tri-start');
		assert.ok(start, 'compteur de départ absent');
		assert.equal(text(start), version.start);
		assert.ok(decorative(start), 'compteur de départ lu ou repris');
		const [board] = withClass('tri-board');
		assert.ok(board && decorative(board), 'planche lue ou reprise');
		assert.deepEqual(withClass('tri-note').map(text), version.notes);
		assert.deepEqual(tags(withClass('tri-months')[0] ?? '', 'span').length, 12);
		assert.deepEqual(elementsText(withClass('tri-months')[0]), version.months);
		assert.deepEqual(elementsText(withClass('tri-scale')[0]), version.scale);
		for (const name of ['tri-note', 'tri-months', 'tri-scale', 'tri-grid']) assert.ok(board.includes(withClass(name)[0]), `${name} hors de la planche`);
	});

	// `main` et la phrase finissent la scène dans la vue de la planche, où les cases les rejoignent : la
	// figure y est posée, mais hors de la planche décorative, pour rester lue et reprise.
	test(`${locale} : la figure est dans la vue, lue par les lecteurs d’écran, la phrase en texte réel`, () => {
		const [view] = withClass('tri-view');
		const [figure] = withClass('tri-figure');
		assert.ok(view && figure && view.includes(figure), 'figure hors de la vue');
		assert.ok(!withClass('tri-board')[0].includes(figure), 'figure dans la planche décorative');
		for (const name of ['tri-stage', 'tri-view']) assert.ok(!decorative(withClass(name)[0]), `${name} cachée aux lecteurs d’écran`);
		const [main] = withClass('tri-main');
		assert.equal(attr(main, 'role'), 'img');
		assert.match(text(withClass('tri-conclusion')[0]), /^(?:Le nombre de commits|The number of commits)/);
		assert.ok(!hasAttr(withClass('tri-conclusion')[0].match(/^<[^>]*>/)[0], 'aria-hidden'), 'phrase cachée');
	});

	/** La plage d'une règle de la scène qui joue `name` sur un sélecteur. */
	const rangeOf = (selector, name) => {
		const scene = blocks(styles, SUPPORTED).join('');
		const body =
			[...scene.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^{}]*)\}/g)].find(
				([, s, b]) => selector.test(s.trim().replace(/\[[^\]]*\]/g, '')) && new RegExp(`\\b${name}\\b`).test(b),
			)?.[2] ?? '';
		return body.match(/\banimation-range\s*:([^;}]*)/)?.[1];
	};

	// Planche H2 : une seule couleur à 6–22 %, la commande gagne ` | group-by` au début du tassement.
	test(`${locale} : les niveaux se fondent en une seule couleur pendant que la commande se complète`, () => {
		assert.match(keyframesOf(styles).get('tri-hide') ?? '', /(?:to|100%)\{opacity:0\}/);
		assert.equal(rangeOf(/^\.tri-levels\b/, 'tri-hide'), 'contain 6% contain 22%');
		assert.equal(rangeOf(/^\.tri-command>span:nth-child\(2\)/, 'tri-show'), 'contain 6% contain 22%');
		assert.equal(rangeOf(/^\.tri-command>span:nth-child\(3\)/, 'tri-show'), 'contain 28% contain 33.6%');
		assert.equal(rangeOf(/^\.tri-months\b/, 'tri-hide'), 'contain 28% contain 36.4%');
		assert.equal(rangeOf(/^\.tri-empty\b/, 'tri-dim'), 'contain 28% contain 56%');
		assert.match(keyframesOf(styles).get('tri-dim') ?? '', /\{opacity:\.5\}/);
	});

	// Planche H2 : la commande gagne ` | uniq` au début de `main`, le compteur change d'unité pendant que
	// les nœuds arrivent, la phrase vient à 88–97 %.
	test(`${locale} : le compteur passe aux Semaines actives pendant \`main\`, puis la phrase arrive`, () => {
		assert.equal(rangeOf(/^\.tri-command>span:nth-child\(4\)/, 'tri-show'), 'contain 62% contain 66.4%');
		const [hide, show] = [rangeOf(/^\.tri-start\b/, 'tri-hide'), rangeOf(/^\.tri-count\b/, 'tri-show')];
		assert.ok(hide, 'le compteur de départ reste');
		assert.equal(show, hide, 'les deux compteurs ne se croisent pas');
		const [, from, to] = hide.match(/^contain ([\d.]+)% contain ([\d.]+)%$/).map(Number);
		assert.ok(from >= 62 && to <= 84, `compteur hors de \`main\` : ${hide}`);
		assert.equal(rangeOf(/^\.tri-conclusion\b/, 'tri-show'), 'contain 88% contain 97%');
	});
}

/** Le texte de chaque enfant d'un élément. */
function elementsText(element = '') {
	return [...element.matchAll(/<span\b[^>]*>(.*?)<\/span>/g)].map(([, inner]) => text(inner));
}
