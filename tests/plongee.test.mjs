// La Plongée (spec #68, ADR 0009) : sur l'accueil, la page s'arrête au défilement, le curseur du nom
// grandit jusqu'à remplir l'écran, puis se range dans le carré de « 01 Projets ». Le mouvement se
// vérifie à la main ; ici, ce que la page livre : la scène, et une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { PROJECTS, attr, blocks, css, elementAt, elements, moduleGraph, readDist, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)/;
/** Ce qui appartient à la scène jouée : ses animations, sa ligne de temps, ses propriétés. */
const PLAYED = /@keyframes\s+dive-|\banimation[\w-]*\s*:[^;{}]*\bdive-|\b(?:animation-timeline|animation-range|view-timeline|timeline-scope)\s*:|--dive\b/;
/** Les seules propriétés que le compositeur anime seul. */
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

/** La devise de chaque langue, ligne à ligne (spec #70) : l'accent de l'accroche, coupé à un endroit naturel. */
const MOTTO = { fr: ['de bout', 'en bout'], en: ['end', 'to end'] };

/**
 * Les animations `dive-` de chaque règle, avec leur plage sur la scène en pourcentage `[début, fin]` :
 * la n-ième plage de `animation-range` va à la n-ième animation du raccourci (la liste se répète
 * si elle est plus courte), et le minifieur écrit `contain 0%` sans son pourcentage.
 */
const animations = (styles) =>
	[...styles.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^;{}]*\bdive-[^{}]*)\}/g)].map(([, selector, body]) => {
		const names = body.match(/\banimation\s*:([^;}]*)/)[1].split(',').map((one) => one.match(/\bdive-[\w-]+/)?.[0]);
		const ranges = (body.match(/\banimation-range\s*:([^;}]*)/)?.[1] ?? '').split(',').map((one) => {
			const m = one.trim().match(/^contain(?:\s+([\d.]+)%)?\s+contain\s+([\d.]+)%$/);
			return m ? [Number(m[1] ?? 0), Number(m[2])] : [0, 100];
		});
		return { selector, played: names.map((name, i) => ({ name, range: ranges[i % ranges.length] })).filter(({ name }) => name) };
	});

/** L'élément de la scène : celui qui s'épingle, l'en-tête et le héros dedans. */
const sceneOf = (html) => elementAt(html, html.search(/<div class="dive-scene\b/));

/** Le segment de mode de la barre d'état : le premier segment, dont la Lunette fait COMMAND. */
const modeOf = (footer) => elementAt(footer, footer.search(/<span class="seg mode state\b/));

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

	test(`${locale} : la devise sur le bleu est l’accent de l’accroche, en deux lignes, décorative`, () => {
		const scene = sceneOf(html) ?? '';
		const opening = tags(scene, 'div').find((tag) => /\bclass="dive-motto\b/.test(tag));
		assert.ok(opening, 'devise absente de la scène');
		assert.equal(attr(opening, 'aria-hidden'), 'true');
		const motto = elementAt(scene, scene.indexOf(opening));
		const lines = [...motto.matchAll(/<span class="dive-line\b[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
		assert.deepEqual(lines, ['-- INSERT --', ...MOTTO[locale]]);
		const emphasis = text(elements(html, 'p').find((p) => /\bclass="lede\b/.test(p)).match(/<em\b[^>]*>([\s\S]*?)<\/em>/)[1]);
		assert.equal(MOTTO[locale].join(' '), emphasis, 'devise différente de l’accent de l’accroche');
	});

	test(`${locale} : en mouvement réduit ou sans prise en charge, la devise reste cachée`, () => {
		for (const outside of [withoutBlocks(styles, MOTION), withoutBlocks(styles, SUPPORTED)]) {
			const hidden = [...outside.matchAll(/([^{}]*)\{display:none\}/g)].flatMap(([, selector]) => selector.split(','));
			assert.ok(hidden.some((selector) => /^\.dive-motto\b/.test(selector.trim())), 'devise visible');
		}
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

	// Plus haut que l'écran (téléphone, portable de moins de ~1 000 px de haut), le héros remonte d'abord
	// jusqu'à montrer son bas : d'après sa propre hauteur et le plus petit écran, sans script, et jamais
	// vers le bas, si bien qu'un héros qui tient ne bouge pas.
	test(`${locale} : le héros plus haut que l’écran remonte jusqu’à son bas avant que le texte ne s’efface`, () => {
		const keyframes = new Map(blocks(styles, /@keyframes\s+dive-[\w-]+/).map((block) => [block.match(/@keyframes\s+([\w-]+)/)[1], block]));
		const rising = [...keyframes].filter(([, block]) => /\btranslate:\s*0(?:px)?\s+min\(0(?:px)?,[^;}]*\b100svh\b[^;}]*\b100%/.test(block)).map(([name]) => name);
		assert.ok(rising.length > 0, 'aucune @keyframes ne remonte le héros d’après sa hauteur');
		const rules = animations(styles).filter(({ selector }) => /\.dive-hero\b/.test(selector));
		const rise = rules.flatMap((rule) => rule.played.filter(({ name }) => rising.includes(name)).map((played) => ({ ...played, selector: rule.selector })));
		assert.ok(rise.length > 0, 'le héros ne remonte pas');
		const end = Math.max(...rise.map(({ range }) => range[1]));
		const fades = rules.flatMap(({ selector, played }) => played.filter(({ name }) => /\bopacity:/.test(keyframes.get(name) ?? '')).map((p) => ({ ...p, selector })));
		assert.ok(fades.length > 0, 'aucun effacement du héros');
		for (const { selector, name, range } of fades) assert.ok(range[0] >= end, `${selector.trim()} : ${name} commence à ${range[0]} %, avant la fin de la remontée (${end} %)`);
	});

	// Le passage NORMAL → INSERT est décoratif (spec #68) : rien ne l'annonce, et un lecteur d'écran lit
	// le mode tel qu'il est hors de la scène.
	test(`${locale} : le segment de mode de la barre porte NORMAL, INSERT et COMMAND, sans région live`, () => {
		const [footer] = elements(html, 'footer');
		const segment = modeOf(footer ?? '');
		assert.ok(segment, 'segment de mode absent');
		for (const mode of ['NORMAL', 'INSERT', 'COMMAND']) assert.ok(text(segment).includes(mode), `${mode} absent`);
		for (const tag of tags(segment, 'span')) {
			assert.equal(attr(tag, 'aria-live'), undefined, tag);
			assert.equal(attr(tag, 'role'), undefined, tag);
		}
		const insert = tags(segment, 'span').find((tag) => text(elementAt(segment, segment.indexOf(tag))) === 'INSERT');
		assert.equal(attr(insert ?? '', 'aria-hidden'), 'true', 'INSERT lu par les lecteurs d’écran');
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

	// Zoomé pendant le repli du bleu, Projets porte l'aperçu A3 : plus de 1 400 tracés SVG. Sans couche
	// à lui, Chrome les redessinait à chaque image à l'échelle du moment : 48 images par seconde au lieu
	// de 120 sur un écran dense (ADR 0009).
	test(`${locale} : Projets, zoomé pendant la scène, a sa propre couche`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([selector, , body]) => /\.projects\b/.test(selector) && /\banimation\s*:[^;{}]*\bdive-/.test(body));
		assert.ok(rules.length > 0, 'Projets n’est pas animé par la scène');
		for (const [, selector, body] of rules) assert.match(body, /\bwill-change\s*:[^;{}]*\btransform\b/, selector.trim());
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

	// Une condition plus large que celle de la CSS laisserait un navigateur sans scène ni repli ; plus
	// étroite, elle ferait télécharger le repli à un navigateur qui joue déjà la scène.
	test(`${locale} : le repli est demandé sous la condition même de la CSS de la scène`, () => {
		const condition = styles.match(new RegExp(`${SUPPORTED.source}[^{]*`))?.[0].replace(/^@supports\s*/, '');
		assert.ok(condition, 'condition de la scène absente');
		const tested = [...moduleGraph(moduleOf(html)).code.matchAll(/CSS\.supports\(\s*(["'`])(.*?)\1\s*\)/g)].map((m) => m[2]);
		const bare = (text) => text.replace(/\s+/g, '');
		assert.deepEqual(tested.map(bare), [bare(condition)]);
	});

	// Le repli prend toutes les animations de la scène par leur préfixe, sans liste à tenir, la CSS
	// restant leur seule source ; il reste de quelques centaines d'octets sur le réseau (Brotli qualité
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

// Le repli réécrit la CSS de la scène pour la jouer sans ligne de temps ; le reste de la page, même une
// animation de durée `auto` ou une autre `@supports` sur les lignes de temps, n'est pas à lui.
test('le repli ne réécrit que la CSS de la Plongée', async () => {
	const scene = /@supports[^{]*--dive/;
	const foreign = '@supports (animation-timeline:view()){.x{animation:auto x linear;animation-timeline:scroll()}}.y{animation:auto y;animation-range:0 1px}';
	const page = elements(readHome(), 'style').map((style) => ({ textContent: foreign + style.replace(/^<style\b[^>]*>|<\/style>$/gi, '') + foreign }));
	const before = page.map(({ textContent }) => textContent);
	assert.equal(before.filter((styles) => scene.test(styles)).length, 1, 'CSS de la scène introuvable');
	// Juste assez de navigateur pour que le repli s'exécute : pas d'animation à régler, lecteur en haut.
	const box = { style: {}, offsetTop: 0, offsetHeight: 0, getBoundingClientRect: () => ({ top: 1 }) };
	Object.assign(globalThis, {
		scrollY: 0,
		scrollTo() {},
		addEventListener() {},
		requestAnimationFrame: () => 1,
		getComputedStyle: () => ({ scrollMarginTop: '0px', animationName: '', getPropertyValue: () => '' }),
		CSSAnimation: class {},
		document: {
			documentElement: { clientHeight: 0 },
			querySelector: () => box,
			querySelectorAll: (selector) => (selector === 'style' ? page : []),
			getAnimations: () => [],
		},
	});
	await import(new URL(`../dist${fallbacksOf(readHome())[0]}`, import.meta.url).href);
	for (const [i, { textContent }] of page.entries()) {
		assert.equal(withoutBlocks(textContent, scene), withoutBlocks(before[i], scene), 'CSS hors de la Plongée réécrite');
		for (const block of blocks(textContent, scene)) assert.doesNotMatch(block, /\banimation-timeline\s*:/, 'scène toujours sur une ligne de temps');
	}
});

test('les fiches restent sans Plongée', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const html = readFiche(slug, locale);
			assert.equal(sceneOf(html), undefined, `${locale} ${slug} : scène`);
			const [footer] = elements(html, 'footer');
			assert.doesNotMatch(text(modeOf(footer ?? '') ?? ''), /INSERT/, `${locale} ${slug} : INSERT dans la barre`);
			assert.doesNotMatch(css(html), PLAYED, `${locale} ${slug} : CSS de la Plongée`);
		}
	}
});
