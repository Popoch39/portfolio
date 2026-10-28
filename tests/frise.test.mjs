// La Frise (spec #98, ticket #100, ADR 0014) : en défilant jusqu'au Parcours, la section s'épingle et un
// plan incliné, sur le bleu plein cadre, fait glisser le git graph sous HEAD. Le mouvement se vérifie à la
// main ; ici, ce que la page livre : la piste et sa ligne de temps, une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur, et un tracé plein qui suit HEAD.
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
		assert.match(styles, /--frise-length\s*:\s*400svh\b/, 'course de la Frise');
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
		assert.doesNotMatch(styles.match(/@keyframes\s+frise-[\s\S]*/)?.[0] ?? '', /clip-path/, 'clip-path animé');
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
