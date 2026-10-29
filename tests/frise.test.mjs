// La Frise (spec #98, ticket #100, ADR 0014) : en défilant jusqu'au Parcours, la section s'épingle et un
// plan incliné, sur le bleu plein cadre, fait glisser le git graph sous HEAD. Le mouvement se vérifie à la
// main ; ici, ce que la page livre : la piste et sa ligne de temps, une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur, et un tracé plein qui suit HEAD. Puis
// (#101) la chorégraphie de chaque Commit au passage de HEAD, et le Commit actif en grand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, attr, blocks, css, elementAt, readFiche, readHome, tags, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)[^{]*\(timeline-scope:\s*--frise\)/;
/** Ce qui appartient à la Frise jouée : ses animations, sa ligne de temps. */
const PLAYED = /@keyframes\s+frise-|\banimation[\w-]*\s*:[^;{}]*\bfrise-|--frise\b/;
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

const keyframesOf = (styles) => new Map(blocks(styles, /@keyframes\s+frise-[\w-]+/).map((block) => [block.match(/@keyframes\s+([\w-]+)/)[1], block]));

for (const { locale, id } of [
	{ locale: 'fr', id: 'parcours' },
	{ locale: 'en', id: 'career' },
]) {
	const html = readHome(locale);
	const styles = css(html);
	const section = elementAt(html, html.indexOf(`<section id="${id}"`)) ?? '';

	// Le repli des scènes (ADR 0009) cherche la scène, de la classe de son préfixe, dans le parent de la piste.
	test(`${locale} : la piste de la Frise est dans la section, déclarée au repli des scènes`, () => {
		const track = tags(section, 'span').find((t) => /\bclass="[^"]*\bfrise-track\b/.test(t));
		assert.ok(track, 'piste absente');
		assert.equal(attr(track, 'aria-hidden'), 'true');
		assert.equal(attr(track, 'data-timeline'), '--frise');
		assert.equal(attr(track, 'data-prefix'), 'frise-');
		assert.ok(section.indexOf(track) < section.search(/<div\b/), 'piste après la scène');
		assert.match(section, /<div class="frise-scene\b/, 'scène absente de l’enveloppe de la piste');
		const rule = [...styles.matchAll(/([^{}]+)\{([^{}]*\bview-timeline\s*:\s*--frise\b[^{}]*)\}/g)];
		assert.equal(rule.length, 1, 'ligne de temps de la Frise');
		assert.match(rule[0][1], /\.frise-track\b/);
		// Toute la page la voit : la portée est posée sur la racine.
		assert.match(styles, /(?:^|[{}\s])html(?:\[[^\]]*\])?\{[^{}]*\btimeline-scope\s*:\s*--frise\b/, 'ligne de temps invisible du reste de la page');
		assert.match(styles, /--frise-length\s*:\s*600svh\b/, 'course de la Frise');
	});

	test(`${locale} : la Frise ne joue qu’en mouvement non réduit, dans un navigateur qui sait la jouer`, () => {
		assert.match(styles, PLAYED, 'CSS de la Frise absente');
		for (const [condition, outside] of [
			['mouvement non réduit', withoutBlocks(styles, MOTION)],
			['@supports sur --frise', withoutBlocks(styles, SUPPORTED)],
		]) {
			assert.doesNotMatch(outside, PLAYED, `Frise hors de ${condition}`);
			// Sans la scène, ses éléments propres ne font que se cacher : le git log vertical reste tel quel.
			const own = [...outside.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(([, selector]) => /\.frise-/.test(selector));
			assert.ok(own.length > 0, `aucune règle de la scène hors de ${condition}`);
			for (const [, selector, body] of own) assert.equal(body, 'display:none', `${selector.trim()} hors de ${condition}`);
		}
	});

	test(`${locale} : les @keyframes de la Frise n’animent que des propriétés composées`, () => {
		const keyframes = keyframesOf(styles);
		assert.ok(keyframes.size > 0, 'aucune @keyframes frise-');
		for (const [name, block] of keyframes) {
			const properties = new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'));
			assert.deepEqual([...properties].filter((p) => !COMPOSITED.has(p)), [], name);
		}
	});

	// Le repli des scènes (ADR 0009) lit les plages dans le style calculé : elles restent des pourcentages
	// littéraux de la piste.
	test(`${locale} : chaque animation de la Frise suit sa ligne de temps, sous une forme que Chrome accepte`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*\banimation(?:-name)?\s*:[^;{}]*\bfrise-[^{}]*)\}/g)];
		assert.ok(rules.length > 0, 'aucune animation de la Frise');
		for (const [, selector, body] of rules) {
			const shorthand = body.match(/\banimation\s*:([^;}]*)/)?.[1] ?? '';
			assert.match(body, /\banimation-timeline\s*:\s*--frise\b/, selector.trim());
			for (const one of shorthand.split(/,(?![^(]*\))/)) assert.match(one, /\bauto\b/, `${selector.trim()} : ${one.trim()} sans durée auto`);
			assert.doesNotMatch(shorthand, /--frise\b/, `${selector.trim()} : ligne de temps dans le raccourci`);
			const range = body.match(/\banimation-range\s*:([^;}]*)/)?.[1] ?? '';
			assert.match(range, /^(?:contain(?:\s+[\d.]+%)?\s*)+$/, `${selector.trim()} : plage ${range}`);
		}
		const named = new Set(rules.flatMap(([, , body]) => body.match(/\banimation(?:-name)?\s*:([^;}]*)/)[1].match(/\bfrise-[\w-]+/g)));
		for (const name of named) assert.ok(keyframesOf(styles).has(name), `${name} sans @keyframes`);
		for (const name of keyframesOf(styles).keys()) assert.ok(named.has(name), `@keyframes ${name} jamais jouée`);
	});

	/** La translation horizontale de début et de fin d'une @keyframes, en pixels. */
	const travel = (name) => {
		const block = keyframesOf(styles).get(name) ?? '';
		return ['(?:from|0%)', '(?:to|100%)'].map((at) => Number(block.match(new RegExp(`${at}\\{translate:(-?[\\d.]+)px\\}`))?.[1]));
	};
	/** La règle (corps) qui joue une animation, et sa plage. */
	const player = (name) => [...styles.matchAll(new RegExp(`\\{([^{}]*\\banimation\\s*:[^;{}]*\\b${name}\\b[^{}]*)\\}`, 'g'))].map((m) => m[1]);

	// Planche D : HEAD va de 2018,25 à 2026,5, à 440 px par an depuis 2018 ; il reste à l'origine du plan.
	test(`${locale} : le plan glisse linéairement sous HEAD, de 2018,25 à 2026,5, sur toute la scène`, () => {
		assert.deepEqual(travel('frise-rail'), [-110, -3740]);
		const [rail] = player('frise-rail');
		assert.ok(rail, 'le rail ne glisse pas');
		assert.match(rail, /\bfrise-rail\s+linear\b/);
	});

	// Translation inverse : l'enveloppe du tracé plein finit toujours sur HEAD (l'origine du plan, où le
	// rail le ramène), et le tracé qu'elle contient reste à sa place sur le rail.
	test(`${locale} : le tracé plein se révèle exactement jusqu’à HEAD, par translation inverse`, () => {
		const width = Number(section.match(/<span class="frise-reveal\b[\s\S]*?<svg\b[^>]*\swidth="(\d+)"/)?.[1]);
		assert.ok(width >= 3740, `enveloppe de ${width} px`);
		const [rail, reveal, built] = ['frise-rail', 'frise-reveal', 'frise-built'].map(travel);
		reveal.forEach((at, i) => assert.equal(at + width + rail[i], 0, 'bord de l’enveloppe ailleurs que sur HEAD'));
		built.forEach((at, i) => assert.equal(at + reveal[i], 0, 'tracé plein déplacé sur le rail'));
		const bodies = ['frise-rail', 'frise-reveal', 'frise-built'].map((name) => player(name)[0] ?? '');
		for (const body of bodies) {
			assert.match(body, /\blinear\b/);
			assert.equal(body.match(/\banimation-range\s*:([^;}]*)/)?.[1], bodies[0].match(/\banimation-range\s*:([^;}]*)/)?.[1], 'plages différentes');
		}
		assert.match(styles, /\.frise-reveal\b[^{}]*\{[^{}]*\boverflow\s*:\s*(?:clip|hidden)\b/, 'enveloppe sans masque');
		assert.doesNotMatch([...keyframesOf(styles).values()].join(''), /clip-path/, 'clip-path animé');
	});

	test(`${locale} : une fine barre de progression va de 0 à 1 sur la même ligne de temps`, () => {
		const block = keyframesOf(styles).get('frise-progress') ?? '';
		assert.match(block, /(?:from|0%)\{scale:0 1\}/);
		assert.match(block, /(?:to|100%)\{scale:1(?: 1)?\}/);
		const [bar] = player('frise-progress');
		assert.ok(bar, 'barre absente');
		assert.match(bar, /\bfrise-progress\s+linear\b/);
		assert.equal(bar.match(/\banimation-range\s*:([^;}]*)/)?.[1], player('frise-rail')[0].match(/\banimation-range\s*:([^;}]*)/)?.[1]);
	});

	/** La scène sur un écran large, et ses requêtes de conteneur (#102), qui la resserrent sur un écran étroit ou bas. */
	const wide = withoutBlocks(styles, /@container\b/);
	const compact = blocks(blocks(styles, SUPPORTED).join(''), /@container\b/);
	/** Les corps des règles qui jouent une animation sur un sélecteur (un Commit, une de ses parties). */
	const playing = (selector, source = wide) =>
		[...source.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^{}]*)\}/g)]
			.filter(([, selectors]) => selectors.split(',').some((one) => selector.test(one.trim())))
			.map(([, , body]) => body);
	/** La plage `contain` d'une règle, en % de la scène : `contain 30%` vaut 30–100 %, `contain contain 40%` 0–40 %. */
	const rangeOf = (body) => {
		const [, first, last] = (body.match(/\banimation-range\s*:([^;}]*)/)?.[1] ?? '').split(/\s*contain\s*/);
		return [parseFloat(first || '0'), parseFloat(last || '100')];
	};
	/** L'opacité d'une @keyframes d'opacité à un instant de la scène (en %), sur la plage d'une règle, remplissage `both`. */
	const keyframes = keyframesOf(styles);
	const opacityAt = (body, at) => {
		const name = body.match(/\banimation\s*:[^;]*?\b(frise-[\w-]+)/)[1];
		const steps = [...(keyframes.get(name) ?? '').matchAll(/((?:[\d.]+%|from|to)(?:,(?:[\d.]+%|from|to))*)\{[^{}]*?\bopacity:([\d.]+)[^{}]*\}/g)]
			.flatMap(([, offsets, value]) => offsets.split(',').map((o) => [o === 'from' ? 0 : o === 'to' ? 100 : parseFloat(o), Number(value)]))
			.sort((a, b) => a[0] - b[0]);
		const [start, end] = rangeOf(body);
		const t = Math.min(100, Math.max(0, ((at - start) / (end - start)) * 100));
		const after = steps.findIndex(([o]) => o > t);
		if (after === 0) return steps[0][1];
		if (after < 0) return steps.at(-1)[1];
		const [[o0, v0], [o1, v1]] = [steps[after - 1], steps[after]];
		return v0 + ((t - o0) / (o1 - o0)) * (v1 - v0);
	};

	// Planche D : HEAD atteint chaque Commit à ces pourcentages de la course (colonne « HEAD sur le point »).
	const PASSAGE = [2.424, 6.061, 27.879, 30.909, 41.576, 46.667, 49.697, 60, 67.879, 75.758, 83.636, 91.515, 99.394];

	test(`${locale} : chaque Commit remplit son point quand HEAD l’atteint, dans l’ordre de la Frise`, () => {
		const kinds = tags(section, 'li').filter((t) => /\bclass="commit\b/.test(t)).map((t) => attr(t, 'data-kind'));
		assert.equal(kinds.length, PASSAGE.length);
		PASSAGE.forEach((passage, i) => {
			for (const part of ['::?before', '::?after']) {
				const [dot] = playing(new RegExp(`\\.commit:nth-child\\(${i + 1}\\)${part}$`));
				assert.ok(dot, `Commit ${i + 1} : ${part} sans animation`);
				const [start, end] = rangeOf(dot);
				assert.ok(Math.abs(start - passage) < 0.002, `Commit ${i + 1} : rempli à ${start} %, HEAD y passe à ${passage} %`);
				assert.equal(end, 100, `Commit ${i + 1} : se vide avant la fin de la scène`);
				// D'un coup, au passage, et dans les deux sens : rien avant la plage, tenu après.
				assert.match(dot, /\bstep-start\b/);
				assert.match(dot, /\bforwards\b/);
			}
		});
		// La fusion reste un anneau : son disque plein n'est pas dessiné dans la scène.
		const scene = blocks(styles, SUPPORTED).join('');
		assert.match(scene, /\.commit(?:\[[^\]]*\])*\[data-kind=["']?merge["']?\](?:\[[^\]]*\])*::?after[^{}]*\{[^{}]*\bdisplay:none\b/, 'fusion remplie');
		assert.ok(kinds.includes('merge'));
	});

	// Planche D : le poteau a fini de monter 0,18 an après le passage de HEAD (colonne « poteau fini »),
	// borné à la fin de la scène pour HEAD.
	const RISEN = [4.606, 8.242, 30.061, 33.091, 43.758, 48.848, 51.879, 62.182, 70.061, 77.939, 85.818, 93.697, 100];

	test(`${locale} : au passage de HEAD, le poteau monte en échelle et soulève l’étiquette`, () => {
		PASSAGE.forEach((passage, i) => {
			for (const [part, property] of [
				['\\.label::?after', 'scale'],
				['\\.caption', 'translate'],
			]) {
				const [rise] = playing(new RegExp(`\\.commit:nth-child\\(${i + 1}\\) ${part}$`));
				assert.ok(rise, `Commit ${i + 1} : ${part} immobile`);
				const [start, end] = rangeOf(rise);
				assert.ok(Math.abs(start - passage) < 0.002, `Commit ${i + 1} : ${part} part à ${start} %, HEAD passe à ${passage} %`);
				assert.ok(Math.abs(end - RISEN[i]) < 0.002, `Commit ${i + 1} : ${part} finit à ${end} %, attendu ${RISEN[i]} %`);
				const name = rise.match(/\banimation\s*:[^;]*?\b(frise-[\w-]+)/)[1];
				assert.match(keyframesOf(styles).get(name), new RegExp(`\\{${property}:`), `${name} n’anime pas ${property}`);
			}
		});
		// Le texte de l'étiquette est au-dessus du poteau, dans l'étiquette redressée.
		assert.match(section, /<div class="label\b[^>]*><div class="caption\b/);
	});

	// Planche D, en années de HEAD : à venir, 0,4 − 0,35 × l'écart (0 au-delà) ; actif, de son passage à celui
	// du suivant, 1 ; passé, 1 − 0,5 × l'écart, jamais sous 0,25.
	test(`${locale} : l’étiquette est pâle avant HEAD, pleine quand son Commit est actif, puis s’estompe`, () => {
		const label = (n) => {
			const rules = playing(new RegExp(`\\.commit:nth-child\\(${n}\\) \\.label$`));
			assert.equal(rules.length, 1, `Commit ${n} : une animation d’opacité, et une seule`);
			return rules[0];
		};
		const cases = [
			// [Commit, instant en % de la scène, opacité de la planche]
			[1, 0, 0.33],
			[2, 2.424 - 0.002, 0.295],
			[3, 6.061, 0],
			[1, 2.424 + 0.001, 1],
			[1, 6.06, 1],
			[1, 6.061 + 0.001, 0.85],
			[1, 27.879, 0.25],
			[2, 27.879 - 0.001, 1],
			[2, 27.879 + 0.001, 0.25],
			[3, 27.879 - 0.03, 0.4],
			[3, 27.879 + 0.001, 1],
			[3, 30.909 + 0.001, 0.875],
			[3, 49.697, 0.25],
			[8, 66, 1],
			[8, 67.879 + 0.001, 0.675],
			[13, 99.39, 0.4],
			[13, 99.394 + 0.001, 1],
			[13, 100, 1],
		];
		for (const [n, at, expected] of cases) {
			const value = opacityAt(label(n), at);
			assert.ok(Math.abs(value - expected) < 0.01, `Commit ${n} à ${at} % : ${value}, attendu ${expected}`);
		}
	});

	// Décision de Louis : sur écran large, l'étiquette pâle d'une bifurcation (`lea`, `access-code`, `cda`),
	// basse sur son poteau replié, croise celle du Commit de `main` actif juste avant elle (constaté en
	// 1280 × 720 et 1920 × 1080). Elle reste éteinte tant que ce Commit est actif, puis reprend la courbe.
	test(`${locale} : sur écran large, l’étiquette à venir qui croiserait celle du Commit actif reste éteinte tant qu’il l’est`, () => {
		const label = (n) => playing(new RegExp(`\\.commit:nth-child\\(${n}\\) \\.label$`))[0];
		for (const n of [2, 4, 7]) {
			const [from, to] = [PASSAGE[n - 2], PASSAGE[n - 1]];
			for (let t = from + 0.002; t < to - 0.001; t += (to - from) / 50) assert.equal(opacityAt(label(n), t), 0, `Commit ${n} allumé à ${t.toFixed(3)} %`);
			assert.ok(opacityAt(label(n), from - 0.002) > 0.25, `Commit ${n} : plus pâle de la planche avant le Commit actif`);
			assert.equal(opacityAt(label(n), to + 0.002), 1, `Commit ${n} pas plein à son passage`);
		}
		// Les autres étiquettes à venir, qui ne croisent rien, gardent la planche.
		for (const [n, at, expected] of [
			[3, 27.879 - 0.03, 0.4],
			[5, 41.576 - 0.03, 0.4],
			[8, 60 - 0.03, 0.4],
			[9, 67.879 - 0.03, 0.4],
		]) {
			const value = opacityAt(label(n), at);
			assert.ok(Math.abs(value - expected) < 0.01, `Commit ${n} à ${at} % : ${value}, attendu ${expected}`);
		}
	});

	// #102 : la scène est un conteneur de taille ; sur un écran étroit ou bas, ses requêtes resserrent la courbe.
	test(`${locale} : sur un écran étroit ou bas, une requête de conteneur de la scène reprend chaque étiquette`, () => {
		assert.match(styles, /\.frise-scene\b[^{}]*\{[^{}]*\bcontainer(?:-name)?\s*:\s*frise\b/, 'scène sans nom de conteneur');
		assert.ok(compact.length > 0, 'aucune requête de conteneur dans la scène jouée');
		// La courbe (générée) et la caméra (Career.astro) se resserrent au même seuil.
		const [query, ...others] = compact.map((block) => block.match(/^@container[^{]*/)[0].trim());
		for (const other of others) assert.equal(other, query, 'seuils différents');
		assert.match(query, /^@container\s+frise\b/, query);
		assert.match(query, /\bwidth\s*<\s*\d+px\b[^{]*\bor\b[^{]*\bheight\s*<\s*\d+px\b/, query);
		PASSAGE.forEach((_, i) => assert.equal(playing(new RegExp(`\\.commit:nth-child\\(${i + 1}\\) \\.label$`), compact.join('')).length, 1, `Commit ${i + 1}`));
	});

	// Resserrée : aucune étiquette à venir, pas même la voisine (écart à la spec, ADR 0014) ; celle du Commit
	// actif s'allume à son passage, dans l'ordre de la Frise, et la précédente s'éteint vite. Au plus deux
	// étiquettes allumées, dont une seule pleine : rien ne se chevauche.
	test(`${locale} : sur un écran étroit ou bas, aucune étiquette à venir n’est allumée ; celle du Commit actif est pleine, la précédente s’éteint vite`, () => {
		const label = (n) => playing(new RegExp(`\\.commit:nth-child\\(${n}\\) \\.label$`), compact.join(''))[0];
		const at = (t) => PASSAGE.map((_, i) => opacityAt(label(i + 1), t));
		PASSAGE.forEach((passage, i) => {
			const [before, after] = [at(passage - 0.002), at(passage + 0.002)];
			assert.equal(before[i], 0, `Commit ${i + 1} allumé avant son passage`);
			assert.equal(after[i], 1, `Commit ${i + 1} éteint à son passage`);
			after.forEach((value, k) => k > i && assert.equal(value, 0, `Commit ${k + 1} allumé au passage du Commit ${i + 1}`));
			after.forEach((value, k) => k < i - 1 && assert.equal(value, 0, `Commit ${k + 1} allumé au passage du Commit ${i + 1}`));
			if (i > 0) assert.ok(after[i - 1] < 0.5, `Commit ${i} encore plein au passage du suivant`);
			if (PASSAGE[i + 1]) assert.equal(at(PASSAGE[i + 1] - 0.002)[i - 1] ?? 0, 0, `Commit ${i} pas éteint avant le passage d’après`);
		});
		for (let t = 0; t <= 100; t += 0.05) {
			const values = at(t);
			assert.ok(values.filter((v) => v > 0.01).length <= 2, `à ${t.toFixed(2)} % : ${values}`);
			assert.ok(values.filter((v) => v > 0.5).length <= 1, `à ${t.toFixed(2)} % : ${values}`);
		}
	});

	// Un doublon visuel : ni lu par les lecteurs d'écran, ni repris dans les extraits ; le texte complet reste
	// une seule fois, dans la liste.
	test(`${locale} : le Commit actif en grand double la liste sans être lu ni indexé`, () => {
		const start = section.search(/<div class="frise-active\b/);
		assert.ok(start >= 0, 'Commit actif absent');
		const active = elementAt(section, start);
		const tag = active.match(/^<div\b[^>]*>/)[0];
		assert.equal(attr(tag, 'aria-hidden'), 'true');
		assert.match(tag, /\sdata-nosnippet\b/);
		const list = elementAt(section, section.indexOf('<ol class="frise'));
		assert.ok(!list.includes('frise-active'), 'doublon dans la liste');
		const titles = [...list.matchAll(/<h3 class="title\b[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
		const steps = active.split(/<div class="frise-step\b/).slice(1);
		assert.equal(steps.length, titles.length, 'un bloc par Commit');
		const places = [...list.matchAll(/<p class="place\b[^>]*>([^<]*)<\/p>/g)].map((m) => m[1]);
		titles.forEach((title, i) => {
			assert.ok(steps[i].includes(`>${title}<`), `bloc ${i + 1} sans « ${title} »`);
			assert.ok(steps[i].includes(`>${places[i]}<`), `bloc ${i + 1} sans « ${places[i]} »`);
		});
		assert.equal(new Set(titles).size, titles.length, 'titre répété dans la liste');
		assert.match(steps[1], /\blea\b/, 'Branche absente du bloc');
	});

	const step = (n) => {
		const rules = playing(new RegExp(`\\.frise-step:nth-child\\(${n}\\)$`));
		assert.equal(rules.length, 1, `bloc ${n} : une animation, et une seule`);
		return rules[0];
	};

	test(`${locale} : le Commit actif en grand change exactement quand HEAD passe un Commit, dans les deux sens`, () => {
		assert.equal(opacityAt(step(1), 0), 1, 'aucun Commit actif au départ');
		PASSAGE.forEach((passage, i) => {
			if (i === 0) return;
			const [current, previous] = [step(i + 1), step(i)];
			// Juste avant le passage : le Commit précédent seul ; juste après, il commence à s'effacer.
			assert.equal(opacityAt(current, passage - 0.002), 0, `bloc ${i + 1} avant son passage`);
			assert.equal(opacityAt(previous, passage - 0.002), 1, `bloc ${i} avant le passage suivant`);
			assert.ok(opacityAt(previous, passage + 0.002) < 1, `bloc ${i} encore plein au passage suivant`);
			// Le fondu fini, avant le passage d'après.
			const settled = i + 1 < PASSAGE.length ? PASSAGE[i + 1] - 0.002 : 100;
			assert.equal(opacityAt(current, settled), 1, `bloc ${i + 1} à ${settled} %`);
			assert.equal(opacityAt(previous, settled), 0, `bloc ${i} à ${settled} %`);
		});
	});

	// Décision de Louis : l'ancien bloc s'efface d'abord, puis le nouveau apparaît en glissant ; jamais deux
	// blocs visibles à la fois.
	test(`${locale} : le Commit actif en grand passe d’un bloc à l’autre en fondu séquencé, jamais deux à la fois`, () => {
		const blocks = PASSAGE.map((_, i) => step(i + 1));
		for (let t = 0; t <= 100; t += 0.01) {
			const visible = blocks.map((block) => opacityAt(block, t)).filter((v) => v > 0);
			assert.ok(visible.length <= 1, `à ${t.toFixed(2)} % : ${visible.length} blocs visibles`);
		}
		PASSAGE.forEach((passage, i) => {
			if (i === 0) return;
			// Au passage, l'ancien s'efface et le nouveau attend qu'il ait disparu.
			assert.equal(opacityAt(step(i + 1), passage + 0.002), 0, `bloc ${i + 1} déjà là pendant que le bloc ${i} s’efface`);
			const name = step(i + 1).match(/\banimation\s*:[^;]*?\b(frise-[\w-]+)/)[1];
			const block = keyframesOf(styles).get(name);
			// Il apparaît en glissant vers sa place.
			assert.match(block, /^@keyframes [\w-]+\{(?:0%|from)\{[^{}]*\btranslate:0 [1-9][\d.]*px\b/, `${name} sans glissement`);
			assert.match(block, /\btranslate:0 0\b|\btranslate:none\b/, `${name} ne revient pas à sa place`);
		});
	});

	// Le titre du Commit actif suit la taille de la scène ; sa date et son lieu aussi, sans passer sous un
	// corps lisible.
	test(`${locale} : la date et le lieu du Commit actif suivent les unités de la scène, avec un plancher`, () => {
		for (const name of ['frise-when', 'frise-place']) {
			const size = blocks(styles, SUPPORTED)
				.join('')
				.match(new RegExp(`\\.${name}\\b[^{}]*\\{[^{}]*\\bfont-size:([^;}]*)`))?.[1];
			assert.match(size ?? '', /^max\((?:1[1-9]|[2-9]\d)px,min\(\d+px,[\d.]+cqh,[\d.]+cqw\)\)$/, `${name} : ${size}`);
		}
	});

	test(`${locale} : les missions sont masquées à l’écran dans la scène, lues par les lecteurs d’écran, visibles dans le git log`, () => {
		const list = elementAt(section, section.indexOf('<ol class="frise'));
		assert.ok(tags(list, 'li').filter((t) => /\bclass="mission\b/.test(t)).length > 0, 'missions absentes de la liste');
		// Masquées comme `.sr-only` : hors du rendu visible, pas de l'arbre d'accessibilité.
		const hidden = (body) => ['position:absolute', 'width:1px', 'height:1px', 'overflow:hidden', 'clip-path:inset(50%)'].every((d) => body.split(';').includes(d));
		const hides = (css) =>
			[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(([, selector, body]) => /\.missions\b/.test(selector) && (hidden(body) || /\bdisplay:none\b/.test(body)));
		assert.ok(hides(blocks(styles, SUPPORTED).join('')), 'missions affichées dans la scène');
		assert.ok(!hides(withoutBlocks(styles, MOTION)), 'missions masquées dans le git log vertical');
	});

	// Le plan, le tracé, les fondus et la barre sont des dessins : le texte de la Frise reste la liste.
	test(`${locale} : le décor de la scène est caché aux lecteurs d’écran, la liste reste lisible`, () => {
		for (const name of ['frise-grid', 'frise-dotted', 'frise-reveal', 'frise-fade', 'frise-progress']) {
			const tag = tags(section, 'span').find((t) => new RegExp(`\\bclass="${name}\\b`).test(t));
			assert.ok(tag, `${name} absent`);
			assert.equal(attr(tag, 'aria-hidden'), 'true', name);
		}
		// Dans la scène, rien de la liste n'est retiré du rendu ni de l'arbre d'accessibilité.
		const scene = blocks(styles, SUPPORTED).join('');
		for (const [, selector, body] of scene.matchAll(/([^{}]*\.(?:frise|commit|label|when|title|branch|place|missions?)\b[^{}]*)\{([^{}]*)\}/g)) {
			if (/::?(?:before|after)/.test(selector)) continue;
			assert.doesNotMatch(body, /\b(?:display:none|visibility:hidden|content-visibility:hidden)\b/, selector.trim());
		}
	});
}

test('les fiches restent sans Frise', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const page = readFiche(slug, locale);
			assert.doesNotMatch(css(page), PLAYED, `${locale} ${slug} : CSS de la Frise`);
			assert.doesNotMatch(page, /\bfrise-track\b/, `${locale} ${slug} : piste de la Frise`);
		}
	}
});
