// Le Glissé (ADR 0010) : sur tout le site, un cran de molette fait glisser la page au lieu de la faire
// sauter, ce qui rend la Plongée continue sous la molette. Le module du build est exécuté dans un faux
// navigateur : les crans y sont des événements, et les défilements lisses qu'il demande au navigateur
// sont relevés ; le test déplace la page lui-même, comme le navigateur en route vers la cible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { PROJECTS, attr, moduleGraph, readDist, readFiche, readHome, tags } from './helpers/dist.mjs';

/** Le script module d'une page, en chemin servi. */
const moduleOf = (html) => attr(tags(html, 'script').find((t) => attr(t, 'type') === 'module') ?? '', 'src') ?? '';
/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);
/** Le Glissé : ce que le module d'une page importe à la demande pour écouter la molette. */
const glidesOf = (html) => onDemand(moduleGraph(moduleOf(html)).code).filter((path) => /["'`]wheel["'`]/.test(readDist(path.slice(1))));

const PAGES = [
	...['fr', 'en'].map((locale) => ({ name: `accueil ${locale}`, html: readHome(locale) })),
	...PROJECTS.flatMap(({ slug }) => ['fr', 'en'].map((locale) => ({ name: `fiche ${slug} ${locale}`, html: readFiche(slug, locale) }))),
];

// Sur toutes les pages, un seul et même Glissé, hors du module de la page : il ne pèse ni sur le
// premier rendu ni sur l'amorce, et reste de quelques centaines d'octets sur le réseau (Brotli qualité
// 4, comme le budget des pages).
test('chaque page demande le même Glissé à la demande, en moins de 1 000 octets', () => {
	const files = new Set();
	for (const { name, html } of PAGES) {
		const glides = glidesOf(html);
		assert.equal(glides.length, 1, `${name} : ${glides.join(', ') || 'aucun Glissé'}`);
		assert.ok(!moduleGraph(moduleOf(html)).paths.includes(glides[0]), `${name} : Glissé chargé avec le module`);
		files.add(glides[0]);
	}
	assert.equal(files.size, 1, [...files].join(', '));
	const weight = brotliCompressSync(readDist([...files][0].slice(1)), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;
	assert.ok(weight <= 1000, `Glissé de ${weight} o`);
});

/** Ce que les modules des pages demandent ; le Glissé, demandé ainsi, n'est pas exécuté. */
const requested = [];
const glideFiles = new Set(PAGES.flatMap(({ html }) => glidesOf(html)).map((path) => path.slice('/_astro/'.length)));
// La Traîne de la Visite (ADR 0012), demandée avec le Glissé sur l'accueil, ne l'est pas non plus : elle
// lirait le document du faux navigateur d'un test suivant.
const trailFiles = new Set(
	onDemand(moduleGraph(moduleOf(readHome())).code)
		.filter((path) => readDist(path.slice(1)).includes('visit-track'))
		.map((path) => path.slice('/_astro/'.length)),
);
registerHooks({
	resolve(specifier, context, next) {
		if (!context.parentURL?.includes('/dist/_astro/')) return next(specifier, context);
		const file = specifier.replace(/^\.\//, '');
		requested.push(file);
		return glideFiles.has(file) || trailFiles.has(file) ? { url: 'data:text/javascript,', shortCircuit: true } : next(specifier, context);
	},
});

let runs = 0;

// Demandé avec la page, le Glissé retarderait sa première image ; il n'a rien à faire avant qu'on fasse
// défiler.
test('le Glissé n’est demandé qu’une fois la première image peinte', async () => {
	for (const { name, html } of [PAGES[0], PAGES.find(({ name }) => name.startsWith('fiche'))]) {
		const frames = [];
		const before = requested.length;
		Object.assign(globalThis, {
			CSS: { supports: () => true },
			matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
			requestAnimationFrame: (callback) => frames.push(callback),
			addEventListener() {},
			document: {
				createElement: () => ({ relList: { supports: () => true } }),
				querySelector: () => null,
				querySelectorAll: () => [],
			},
		});
		const loaded = () => requested.slice(before).some((file) => glideFiles.has(file));
		await import(`${new URL(`../dist${moduleOf(html)}`, import.meta.url)}?${++runs}`);
		await setImmediate();
		assert.equal(loaded(), false, `${name} : demandé avant la première image`);
		// Une image est rendue après ses rappels `requestAnimationFrame` : le Glissé attend la tâche suivante.
		frames.splice(0).forEach((callback) => callback(0));
		await Promise.resolve();
		assert.equal(loaded(), false, `${name} : demandé avant que la première image soit peinte`);
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(loaded(), true, `${name} : jamais demandé`);
	}
});

const PAGE = 10_000;
const SCREEN = 800;
/**
 * Exécute le Glissé dans un faux navigateur, la page à `y`, haute de `PAGE` pour un écran de `SCREEN`.
 * `wheel` envoie un cran (un `WheelEvent` de Chromium par défaut) ; `requests` relève les défilements
 * demandés au navigateur ; `at` pose la page où le navigateur l'a menée, ou un autre défilement.
 */
async function glide({ reduced = false, y = 0 } = {}) {
	const listeners = {};
	const requests = [];
	Object.assign(globalThis, {
		scrollY: y,
		innerHeight: SCREEN,
		// Le navigateur anime le défilement lui-même : la page ne bouge pas à l'appel.
		scrollTo: (options) => requests.push(options),
		addEventListener(type, listener, options) {
			(listeners[type] ??= []).push({ listener, options });
		},
		matchMedia: (query) => ({ matches: /prefers-reduced-motion/.test(query) ? reduced : false, addEventListener() {} }),
		getComputedStyle: (element) => element.style,
		document: { documentElement: { scrollHeight: PAGE, clientHeight: SCREEN } },
	});
	const [path] = glidesOf(readHome());
	assert.ok(path, 'Glissé introuvable');
	await import(`${new URL(`../dist${path}`, import.meta.url)}?${++runs}`);
	return {
		listeners,
		requests,
		wheel(init = {}) {
			const event = {
				type: 'wheel',
				deltaMode: 0,
				deltaX: 0,
				deltaY: 120,
				wheelDeltaY: -120 * Math.sign(init.deltaY ?? 120),
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				defaultPrevented: false,
				composedPath: () => [],
				...init,
				preventDefault() {
					this.defaultPrevented = true;
				},
			};
			for (const { listener } of listeners.wheel ?? []) listener(event);
			return event;
		},
		at(place) {
			globalThis.scrollY = place;
		},
		/** La cible du dernier défilement demandé. */
		target: () => requests.at(-1)?.top,
	};
}

// Le navigateur anime le défilement lisse sur le compositeur, comme celui de la molette : la Plongée,
// qui suit le défilement sur le compositeur, reste dans la même image que lui. Un défilement écrit
// image par image depuis le script lui arrivait parfois une image en retard, et Projets, tenu par une
// translation qui compense le défilement, tremblait (Brave sous Wayland).
test('un cran de molette demande au navigateur un défilement lisse jusqu’à sa cible', async () => {
	const page = await glide();
	// Passif, l'écouteur ne pourrait pas annuler le saut natif : Chromium l'ignorerait.
	assert.deepEqual(
		page.listeners.wheel.map(({ options }) => options?.passive),
		[false],
	);
	assert.ok(page.wheel().defaultPrevented, 'cran laissé au saut natif');
	assert.deepEqual(page.requests, [{ top: 120, behavior: 'smooth' }]);
	assert.equal(page.listeners.scroll, undefined, 'le défilement est suivi par le script');
});

test('les crans s’ajoutent à la cible en route, dans les bornes de la page', async () => {
	const page = await glide();
	page.wheel();
	page.at(50);
	page.wheel();
	assert.equal(page.target(), 240, 'le second cran repart de la page plutôt que de la cible');
	page.at(240);
	page.wheel();
	assert.equal(page.target(), 360, 'cible atteinte');
	page.wheel({ deltaY: -1000, wheelDeltaY: 1200 });
	assert.equal(page.target(), 0, 'au-dessus du haut');
	page.at(0);
	page.wheel({ deltaY: PAGE * 2, wheelDeltaY: -120 });
	assert.equal(page.target(), PAGE - SCREEN, 'au-delà du bas');
});

// Le lecteur qui change de sens, ou qu'un autre défilement a mené au-delà de la cible (Fin, une ancre,
// `G` dans la Lunette), repart d'où il est.
test('en changeant de sens, ou passé la cible, le cran repart de la page', async () => {
	const page = await glide({ y: 1000 });
	page.wheel();
	page.at(1060);
	page.wheel({ deltaY: -120, wheelDeltaY: 120 });
	assert.equal(page.target(), 940, 'demi-tour');
	page.at(3000);
	page.wheel();
	assert.equal(page.target(), 3120, 'passé la cible');
});

// Un pavé tactile envoie déjà un flux continu, avec son élan : le lisser lui ajouterait du retard.
test('le pavé tactile garde son défilement', async () => {
	const page = await glide();
	for (const [name, event] of [
		['Chromium', { deltaY: 7.5, wheelDeltaY: -9 }],
		['Safari et Chrome sur Mac', { deltaY: 40, wheelDeltaY: -120 }],
	]) {
		assert.equal(page.wheel(event).defaultPrevented, false, name);
	}
	assert.deepEqual(page.requests, [], 'glissé lancé');
});

test('le zoom, le défilement horizontal et le mouvement réduit restent au navigateur', async () => {
	const page = await glide();
	for (const [name, event] of [
		['Ctrl : zoom', { ctrlKey: true }],
		['Cmd : zoom', { metaKey: true }],
		['Maj : défilement horizontal', { shiftKey: true }],
		['molette inclinée', { deltaX: 200, deltaY: 120 }],
	]) {
		assert.equal(page.wheel(event).defaultPrevented, false, name);
	}
	assert.deepEqual(page.requests, [], 'glissé lancé');

	const reduced = await glide({ reduced: true });
	assert.equal(reduced.wheel().defaultPrevented, false, 'mouvement réduit');
});

/** Un élément sous le pointeur, avec son style calculé. */
const element = (style, scrollHeight = 100, scrollTop = 0) => ({
	nodeType: 1,
	scrollHeight,
	scrollTop,
	clientHeight: 100,
	style: { overflowY: 'visible', overscrollBehaviorY: 'auto', ...style },
});

// La liste de la Lunette défile en propre ; son voile, qui couvre l'écran, ne laisse pas passer le
// défilement à la page (`overscroll-behavior: contain`). Ni l'une ni l'autre ne doit faire glisser la page.
test('la molette au-dessus de ce qui défile en propre reste au navigateur', async () => {
	const page = await glide();
	const root = [element({}, PAGE), { nodeType: 9 }, {}];
	for (const [name, path] of [
		['liste qui défile', [element({ overflowY: 'auto' }, 400), ...root]],
		['liste à barre de défilement', [element({}), element({ overflowY: 'scroll' }, 400), ...root]],
		['voile qui retient le défilement', [element({}), element({ overflowY: 'hidden', overscrollBehaviorY: 'contain' }), ...root]],
	]) {
		assert.equal(page.wheel({ composedPath: () => path }).defaultPrevented, false, name);
	}
	assert.deepEqual(page.requests, [], 'glissé lancé');

	for (const [name, path] of [
		['texte de la page', [element({}), ...root]],
		['bloc rogné', [element({ overflowY: 'clip' }, 400), ...root]],
		['liste qui tient en entier', [element({ overflowY: 'auto' }), ...root]],
		// En bout de course, la liste passe le cran à la page, qui sauterait.
		['liste en bas de sa course', [element({ overflowY: 'auto' }, 400, 300), ...root]],
	]) {
		assert.ok(page.wheel({ composedPath: () => path }).defaultPrevented, name);
	}
});
