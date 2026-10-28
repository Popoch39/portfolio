// Le Glissé (ADR 0010) : sur tout le site, un cran de molette fait glisser la page avec de l'inertie au
// lieu de la faire sauter, ce qui rend la Plongée continue sous la molette. Le module du build est
// exécuté dans un faux navigateur : les crans y sont des événements, les images passent quand le test
// les rend, et la place de la page se lit dans `scrollY`.
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
registerHooks({
	resolve(specifier, context, next) {
		if (!context.parentURL?.includes('/dist/_astro/')) return next(specifier, context);
		requested.push(specifier.replace(/^\.\//, ''));
		return glideFiles.has(specifier.replace(/^\.\//, '')) ? { url: 'data:text/javascript,', shortCircuit: true } : next(specifier, context);
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
 * Exécute le Glissé dans un faux navigateur, la page en haut, haute de `PAGE` pour un écran de `SCREEN`.
 * `wheel` envoie un cran (un `WheelEvent` de Chromium par défaut) et le rend ; `play` rend des images
 * de `step` millisecondes pendant `ms` et relève `scrollY` après chacune.
 */
async function glide({ reduced = false } = {}) {
	const listeners = {};
	const frames = new Map();
	let id = 0;
	// L'horloge des images court depuis l'ouverture de la page, bien avant le premier cran.
	let now = 12_345;
	Object.assign(globalThis, {
		scrollY: 0,
		innerHeight: SCREEN,
		scrollTo(_, y) {
			globalThis.scrollY = Math.max(0, Math.min(PAGE - SCREEN, y));
			for (const { listener } of listeners.scroll ?? []) listener({ type: 'scroll' });
		},
		addEventListener(type, listener, options) {
			(listeners[type] ??= []).push({ listener, options });
		},
		requestAnimationFrame: (callback) => (frames.set(++id, callback), id),
		cancelAnimationFrame: (frame) => frames.delete(frame),
		matchMedia: (query) => ({ matches: /prefers-reduced-motion/.test(query) ? reduced : false, addEventListener() {} }),
		getComputedStyle: (element) => element.style,
		document: { documentElement: { scrollHeight: PAGE, clientHeight: SCREEN } },
	});
	const [path] = glidesOf(readHome());
	assert.ok(path, 'Glissé introuvable');
	await import(`${new URL(`../dist${path}`, import.meta.url)}?${++runs}`);
	return {
		listeners,
		wheel(init = {}) {
			const event = {
				type: 'wheel',
				timeStamp: now,
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
		play(ms, step = 1000 / 60) {
			const positions = [];
			for (let t = 0; t < ms - 1e-6; t += step) {
				now += step;
				const due = [...frames.values()];
				frames.clear();
				due.forEach((callback) => callback(now));
				positions.push(scrollY);
			}
			return positions;
		},
		/** Un défilement qui ne vient pas du Glissé : clavier, barre de défilement, ancre, Lunette. */
		scroll(y) {
			globalThis.scrollY = y;
			for (const { listener } of listeners.scroll ?? []) listener({ type: 'scroll' });
		},
		pending: () => frames.size,
	};
}

test('un cran de molette fait glisser la page jusqu’à sa cible, en une demi-seconde environ', async () => {
	const page = await glide();
	assert.ok(page.wheel().defaultPrevented, 'cran laissé au saut natif');
	assert.equal(scrollY, 0, 'la page a sauté avant la première image');
	// À 60 images par seconde, chacune rattrape un dixième de l'écart qui reste.
	const positions = page.play(500);
	assert.ok(positions[0] > 0 && positions[0] < 20, `première image à ${positions[0]} px`);
	assert.ok(positions.every((y, i) => i == 0 || y >= positions[i - 1]), 'la page recule');
	assert.ok(positions.at(-1) > 110 && positions.at(-1) < 120, `à 0,5 s, ${positions.at(-1)} px`);
	page.play(1000);
	assert.equal(scrollY, 120, 'cible manquée');
	assert.equal(page.pending(), 0, 'des images demandées une fois la page posée');
});

test('les crans s’ajoutent en route, la page reste dans ses bornes, et le toucher ne dépend pas de la cadence de l’écran', async () => {
	const page = await glide();
	page.wheel();
	page.play(100);
	page.wheel();
	page.play(2000);
	assert.equal(scrollY, 240, 'deux crans');
	page.wheel({ deltaY: -1000 });
	page.play(2000);
	assert.equal(scrollY, 0, 'au-dessus du haut');
	page.wheel({ deltaY: PAGE * 2 });
	page.play(3000);
	assert.equal(scrollY, PAGE - SCREEN, 'au-delà du bas');

	const places = [];
	for (const step of [1000 / 60, 1000 / 120]) {
		const screen = await glide();
		screen.wheel();
		places.push(screen.play(250, step).at(-1));
	}
	assert.ok(Math.abs(places[0] - places[1]) < 1, `à 0,25 s : ${places[0]} px à 60 i/s, ${places[1]} px à 120 i/s`);
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
	assert.equal(page.pending(), 0, 'glissé lancé');
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
	assert.equal(page.pending(), 0, 'glissé lancé');

	const reduced = await glide({ reduced: true });
	assert.equal(reduced.wheel().defaultPrevented, false, 'mouvement réduit');
});

// Le lecteur qui saute ailleurs en plein glissé (Fin, une ancre, `G` dans la Lunette) y reste : le
// glissé ne le ramène pas vers sa cible.
test('un défilement d’ailleurs arrête le glissé en cours', async () => {
	const page = await glide();
	page.wheel();
	page.play(100);
	page.scroll(3000);
	page.play(1000);
	assert.equal(scrollY, 3000, 'ramené vers la cible du cran');
	assert.equal(page.pending(), 0, 'glissé toujours en cours');
	page.wheel();
	page.play(2000);
	assert.equal(scrollY, 3120, 'le cran suivant ne part pas de la nouvelle place');
});

/** Un élément sous le pointeur, avec son style calculé. */
const element = (style, scrollHeight = 100) => ({ nodeType: 1, scrollHeight, clientHeight: 100, style: { overflowY: 'visible', overscrollBehaviorY: 'auto', ...style } });

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
	assert.equal(page.pending(), 0, 'glissé lancé');

	for (const [name, path] of [
		['texte de la page', [element({}), ...root]],
		['bloc rogné', [element({ overflowY: 'clip' }, 400), ...root]],
		['liste qui tient en entier', [element({ overflowY: 'auto' }), ...root]],
	]) {
		assert.ok(page.wheel({ composedPath: () => path }).defaultPrevented, name);
	}
});
