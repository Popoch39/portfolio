// La Plongée (spec #68, ADR 0009) : sur l'accueil, la page s'arrête au défilement, le curseur du nom
// grandit jusqu'à remplir l'écran, puis se range dans le carré de « 01 Projets ». Le mouvement se
// vérifie à la main ; ici, ce que la page livre : la scène, et une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { PROJECTS, attr, blocks, css, elementAt, moduleGraph, readDist, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)/;
/** Ce qui appartient à la scène jouée : ses animations, sa ligne de temps, ses propriétés. */
const PLAYED = /@keyframes\s+dive-|\banimation[\w-]*\s*:[^;{}]*\bdive-|\b(?:animation-timeline|animation-range|view-timeline|timeline-scope)\s*:|--dive\b/;
/** Les seules propriétés que le compositeur anime seul. */
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

/** L'élément de la scène : celui qui s'épingle, l'en-tête et le héros dedans. */
const sceneOf = (html) => elementAt(html, html.search(/<div class="dive-scene\b/));

/** Le script module de la page, en chemin servi. */
const moduleOf = (html) => attr(tags(html, 'script').find((t) => attr(t, 'type') === 'module') ?? '', 'src') ?? '';
/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);
/** Le repli de Firefox : ce que le module de la page importe à la demande pour régler les animations `dive-`. */
const fallbacksOf = (html) => onDemand(moduleGraph(moduleOf(html)).code).filter((path) => readDist(path.slice(1)).includes('dive-'));

for (const { locale, projects } of [
	{ locale: 'fr', projects: 'projets' },
	{ locale: 'en', projects: 'projects' },
]) {
	const html = readHome(locale);
	const styles = css(html);

	test(`${locale} : la scène contient l’en-tête du site et le héros, et Projets la suit dans le flux`, () => {
		const scene = sceneOf(html);
		assert.ok(scene, 'scène absente');
		assert.match(scene, /<header\b/, 'en-tête hors de la scène');
		assert.match(scene, /<h1\b/, 'héros hors de la scène');
		assert.doesNotMatch(scene, new RegExp(`id="${projects}"`), 'Projets dans la scène');
		assert.ok(html.indexOf(scene) + scene.length < html.indexOf(`id="${projects}"`), 'Projets avant la scène');
	});

	test(`${locale} : le bleu qui couvre l’écran est décoratif`, () => {
		const scene = sceneOf(html) ?? '';
		const blue = tags(scene, 'div').find((tag) => /\bclass="dive-blue\b/.test(tag));
		assert.ok(blue, 'bleu absent de la scène');
		assert.equal(attr(blue, 'aria-hidden'), 'true');
		assert.equal(text(elementAt(scene, scene.indexOf(blue))), '');
	});

	test(`${locale} : la Plongée ne joue qu’en mouvement non réduit, dans un navigateur qui sait la jouer`, () => {
		assert.match(styles, PLAYED, 'CSS de la Plongée absente');
		for (const [condition, outside] of [
			['mouvement non réduit', withoutBlocks(styles, MOTION)],
			['@supports (animation-timeline: view())', withoutBlocks(styles, SUPPORTED)],
		]) {
			assert.doesNotMatch(outside, PLAYED, `Plongée hors de ${condition}`);
			// Sans la scène, ses éléments propres ne font que se cacher : ni épinglage, ni place réservée.
			const rules = [...outside.matchAll(/([^{}]*\.dive[\w-]*[^{}]*)\{([^{}]*)\}/g)];
			for (const [, selector, body] of rules) assert.equal(body, 'display:none', `${selector.trim()} hors de ${condition}`);
		}
	});

	test(`${locale} : les @keyframes de la Plongée n’animent que des propriétés composées, sauf une bascule de visibility à part`, () => {
		const keyframes = blocks(styles, /@keyframes\s+dive-[\w-]+/);
		assert.ok(keyframes.length > 0, 'aucune @keyframes dive-');
		for (const block of keyframes) {
			const name = block.match(/@keyframes\s+([\w-]+)/)[1];
			const properties = new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'));
			// Mêlée à une propriété composée, `visibility` ferait jouer toute l'animation par le thread principal.
			if (properties.has('visibility')) assert.deepEqual([...properties], ['visibility'], name);
			else assert.deepEqual([...properties].filter((p) => !COMPOSITED.has(p)), [], name);
		}
	});

	test(`${locale} : le héros couvert par le bleu passe en visibility: hidden, hors de la tabulation`, () => {
		const hiding = blocks(styles, /@keyframes\s+dive-[\w-]+/)
			.filter((block) => /visibility:\s*hidden/.test(block))
			.map((block) => block.match(/@keyframes\s+([\w-]+)/)[1]);
		assert.ok(hiding.length > 0, 'aucune @keyframes ne cache le héros');
		const users = [...styles.matchAll(/([^{}]+)\{[^{}]*\banimation(?:-name)?\s*:([^;{}]*)/g)].filter(([, , list]) => hiding.some((name) => list.includes(name)));
		assert.ok(users.some(([, selector]) => /\.dive-hero\b/.test(selector)), 'le héros n’est jamais caché');
	});

	// Le minifieur sait replier la ligne de temps dans le raccourci, ou écrire une durée nulle : Chrome
	// refuse le premier en entier, et la seconde jouerait l'animation d'un coup.
	test(`${locale} : chaque animation de la Plongée suit la scène, sous une forme que Chrome accepte`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*\banimation(?:-name)?\s*:[^;{}]*\bdive-[^{}]*)\}/g)];
		assert.ok(rules.length > 0, 'aucune animation de la Plongée');
		for (const [, selector, body] of rules) {
			assert.match(body, /\banimation-timeline\s*:\s*--dive\b/, selector.trim());
			assert.doesNotMatch(body, /\banimation\s*:[^;]*--dive\b/, `${selector.trim()} : ligne de temps dans le raccourci`);
			assert.doesNotMatch(body, /\banimation-duration\s*:[^;]*\b0m?s\b/, `${selector.trim()} : durée nulle`);
		}
	});

	// Firefox joue la scène par un repli, que Chrome et Safari ne téléchargent pas : l'accueil garde son
	// seul module, et le repli n'est ni dans le HTML ni préchargé.
	test(`${locale} : un seul module au chargement, le repli n’arrive qu’à la demande`, () => {
		assert.equal(tags(html, 'script').filter((t) => attr(t, 'type') === 'module').length, 1, 'un seul script module');
		const fallbacks = fallbacksOf(html);
		assert.equal(fallbacks.length, 1, `replis : ${fallbacks.join(', ')}`);
		assert.ok(!moduleGraph(moduleOf(html)).paths.includes(fallbacks[0]), 'repli chargé avec le module');
		assert.ok(!html.includes(fallbacks[0].slice('/_astro/'.length)), 'repli dans le HTML');
	});

	// Les tickets de la Plongée ajoutent chacun leurs animations : le repli les prend toutes par leur
	// préfixe, sans liste à tenir, et reste de quelques centaines d'octets sur le réseau (Brotli qualité
	// 4, comme le budget des pages).
	test(`${locale} : le repli règle les animations dive- sans en nommer aucune, en moins de 1 000 octets`, () => {
		const code = readDist(fallbacksOf(html)[0]?.slice(1) ?? '');
		for (const name of blocks(styles, /@keyframes\s+dive-[\w-]+/).map((block) => block.match(/@keyframes\s+([\w-]+)/)[1])) {
			assert.ok(!code.includes(name), `${name} nommée par le repli`);
		}
		const weight = brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;
		assert.ok(weight <= 1000, `repli de ${weight} o`);
	});
}

/** Les modules que les morceaux du site demandent, en chemins servis ; le repli n'est pas exécuté. */
const requested = [];
const fallbackFiles = new Set(fallbacksOf(readHome()).map((path) => path.slice('/_astro/'.length)));
registerHooks({
	resolve(specifier, context, next) {
		if (!context.parentURL?.includes('/dist/_astro/')) return next(specifier, context);
		requested.push(specifier);
		return fallbackFiles.has(specifier.replace(/^\.\//, '')) ? { url: 'data:text/javascript,', shortCircuit: true } : next(specifier, context);
	},
});

let runs = 0;
/**
 * Exécute le module de l'accueil dans un faux navigateur. `supported` : les animations pilotées par le
 * défilement ; `reduced` : le mouvement réduit. Les images ne passent que quand le test les rend
 * (`frame`) ; `loaded` dit si le repli a été demandé.
 */
async function run({ supported, reduced }) {
	const frames = [];
	const before = requested.length;
	Object.assign(globalThis, {
		CSS: { supports: (...condition) => (/animation-timeline|animation-range|timeline-scope|view-timeline/.test(condition.join(':')) ? supported : false) },
		matchMedia: (query) => ({
			matches: /prefers-reduced-motion\s*(?::\s*reduce\s*)?\)/.test(query) ? reduced : /no-preference/.test(query) ? !reduced : false,
			addEventListener() {},
			removeEventListener() {},
		}),
		requestAnimationFrame: (callback) => frames.push(callback),
		addEventListener() {},
		document: {
			createElement: () => ({ relList: { supports: () => true } }),
			querySelector: () => null,
			querySelectorAll: () => [],
		},
	});
	await import(`${new URL(`../dist${moduleOf(readHome())}`, import.meta.url)}?${++runs}`);
	await setImmediate();
	return {
		loaded: () => requested.slice(before).some((specifier) => fallbackFiles.has(specifier.replace(/^\.\//, ''))),
		frame: () => frames.splice(0).forEach((callback) => callback(performance.now())),
	};
}

test('le repli n’est demandé que sans animations pilotées par le défilement et hors mouvement réduit, après le premier rendu', async () => {
	for (const [browser, options] of [
		['Chrome', { supported: true, reduced: false }],
		['Firefox en mouvement réduit', { supported: false, reduced: true }],
	]) {
		const page = await run(options);
		for (let i = 0; i < 3; i++) {
			page.frame();
			await setImmediate();
		}
		assert.equal(page.loaded(), false, browser);
	}

	const firefox = await run({ supported: false, reduced: false });
	assert.equal(firefox.loaded(), false, 'demandé avant la première image');
	// Une image est rendue après ses rappels `requestAnimationFrame` : le repli attend la tâche suivante.
	firefox.frame();
	await Promise.resolve();
	assert.equal(firefox.loaded(), false, 'demandé avant que la première image soit peinte');
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(firefox.loaded(), true, 'repli jamais demandé');
});

test('les fiches restent sans Plongée', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const html = readFiche(slug, locale);
			assert.equal(sceneOf(html), undefined, `${locale} ${slug} : scène`);
			assert.doesNotMatch(css(html), PLAYED, `${locale} ${slug} : CSS de la Plongée`);
		}
	}
});
