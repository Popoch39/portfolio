// Le Glissé (ADR 0013) : sur tout le site, un cran de molette lance un glissé amorti au lieu de faire
// sauter la page, ce qui rend la Plongée continue sous la molette. Le module du build est exécuté dans un
// faux navigateur : les crans y sont des événements, les images `requestAnimationFrame` avancent sur une
// horloge factice, et la page est relevée à chaque image.
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
 * `wheel` envoie un cran (un `WheelEvent` de Chromium par défaut) à l'instant de l'horloge ; `run` fait
 * passer des images et rend la page à chacune ; `at` pose la page ailleurs, comme un autre défilement.
 * `snap` arrondit la page au pixel, comme Chromium sur un écran à densité 1.
 */
async function glide({ reduced = false, y = 0, snap = false } = {}) {
	const listeners = {};
	const requests = [];
	const frames = [];
	let now = 1000;
	Object.assign(globalThis, {
		scrollY: y,
		innerHeight: SCREEN,
		// Un défilement lisse serait animé par le navigateur, la page ne bougerait pas à l'appel.
		scrollTo(options) {
			requests.push(options);
			if (options.behavior == 'instant') globalThis.scrollY = snap ? Math.round(options.top) : options.top;
		},
		requestAnimationFrame: (callback) => frames.push(callback),
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
				timeStamp: now,
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
		/**
		 * Fait passer `ms` millisecondes d'images à `hz` : les rappels demandés pour une image la
		 * reçoivent à son heure. Rend la page à chaque image, avec l'heure écoulée.
		 */
		run(ms, hz = 60) {
			const pages = [];
			const start = now;
			for (let n = 1; n <= Math.round((ms * hz) / 1000); n++) {
				now = start + (n * 1000) / hz;
				for (const callback of frames.splice(0)) callback(now);
				pages.push({ at: now - start, y: scrollY });
			}
			return pages;
		},
		/** Les images demandées et pas encore rendues. */
		pending: () => frames.length,
	};
}

/** L'heure de la première image où la page est à `y`, et y reste. */
const arrival = (pages, y) => pages[pages.findLastIndex((page) => page.y != y) + 1]?.at ?? Infinity;

// L'élan « marqué » choisi par Louis : une traîne d'environ une seconde, amortie, qui ne dépasse jamais
// la cible. Amortie sur le temps écoulé plutôt que par image, elle dure pareil sur tous les écrans.
test('un cran amène la page à sa cible sans la dépasser, en une seconde environ, à 60 comme à 120 Hz', async () => {
	const trails = {};
	for (const hz of [60, 120, 144]) {
		const page = await glide();
		// Passif, l'écouteur ne pourrait pas annuler le saut natif : Chromium l'ignorerait.
		assert.deepEqual(
			page.listeners.wheel.map(({ options }) => options?.passive),
			[false],
		);
		assert.ok(page.wheel().defaultPrevented, `${hz} Hz : cran laissé au saut natif`);
		assert.equal(scrollY, 0, `${hz} Hz : la page saute à l'appel`);
		const pages = page.run(2000, hz);
		for (const [i, { y }] of pages.entries()) {
			assert.ok(y <= 120, `${hz} Hz : cible dépassée (${y})`);
			assert.ok(y >= (pages[i - 1]?.y ?? 0), `${hz} Hz : la page recule`);
		}
		assert.equal(pages.at(-1).y, 120, `${hz} Hz : cible manquée`);
		const time = arrival(pages, 120);
		assert.ok(time >= 700 && time <= 1200, `${hz} Hz : arrivée en ${time} ms`);
		assert.ok(page.requests.every(({ behavior }) => behavior == 'instant'), `${hz} Hz : défilement laissé au navigateur`);
		trails[hz] = { pages, time };
	}
	// Un dixième de l'écart à la première image à 60 Hz : l'élan part tout de suite.
	assert.ok(Math.abs(trails[60].pages[0].y - 12) < 1, `première image à ${trails[60].pages[0].y}`);
	for (const hz of [120, 144]) {
		assert.ok(Math.abs(trails[hz].time - trails[60].time) <= 1000 / 60, `${hz} Hz : arrivée en ${trails[hz].time} ms contre ${trails[60].time}`);
		for (const { at, y } of trails[60].pages) {
			const same = trails[hz].pages.find((page) => Math.abs(page.at - at) < 1e-6);
			if (same) assert.ok(Math.abs(same.y - y) <= 0.5, `${hz} Hz : ${same.y} contre ${y} à ${at} ms`);
		}
	}
});

// Chromium arrondit la page au pixel sur un écran à densité 1 : l'écart n'est pas pris pour un défilement
// venu d'ailleurs, et la page arrive quand même.
test('arrondie au pixel par le navigateur, la page arrive à sa cible', async () => {
	const page = await glide({ snap: true });
	page.wheel();
	const pages = page.run(2000);
	assert.equal(pages.at(-1).y, 120);
	assert.ok(arrival(pages, 120) <= 1200, `arrivée en ${arrival(pages, 120)} ms`);
});

// Les crans enchaînés prolongent le même élan : la page accélère au lieu de repartir de l'arrêt.
test('les crans enchaînés s’ajoutent à la cible sans repartir de l’arrêt, dans les bornes de la page', async () => {
	const page = await glide();
	page.wheel();
	const before = page.run(200);
	page.wheel();
	const after = page.run(2000);
	const last = before.at(-1).y - before.at(-2).y;
	assert.ok(after[0].y - before.at(-1).y > last, `pas de ${after[0].y - before.at(-1).y} px après le cran contre ${last} avant`);
	assert.equal(after.at(-1).y, 240, 'second cran perdu');

	page.wheel({ deltaY: -1000, wheelDeltaY: 1200 });
	assert.equal(page.run(3000).at(-1).y, 0, 'au-dessus du haut');
	page.wheel({ deltaY: PAGE * 2, wheelDeltaY: -120 });
	const bottom = page.run(4000);
	assert.equal(bottom.at(-1).y, PAGE - SCREEN, 'au-delà du bas');
	assert.ok(bottom.every(({ y }) => y <= PAGE - SCREEN), 'sous le bas de la page');
});

// Le lecteur qui change de sens repart d'où est la page, sans finir l'élan dans l'autre sens.
test('en changeant de sens, le cran repart de la page', async () => {
	const page = await glide({ y: 1000 });
	page.wheel();
	const down = page.run(100).at(-1).y;
	page.wheel({ deltaY: -120, wheelDeltaY: 120 });
	const up = page.run(2000);
	assert.ok(up[0].y < down, `la page descend encore (${up[0].y} après ${down})`);
	assert.equal(up.at(-1).y, down - 120);
});

// Le clavier, une ancre, la Lunette ou la barre de défilement mènent la page ailleurs pendant le glissé :
// il s'arrête là, et le cran suivant repart d'où ils l'ont menée.
test('un défilement venu d’ailleurs arrête le glissé, et le cran suivant repart de la page', async () => {
	const page = await glide();
	page.wheel();
	page.run(100);
	page.at(3000);
	assert.ok(page.run(1000).every(({ y }) => y == 3000), 'le glissé ramène la page');
	assert.equal(page.pending(), 0, 'images demandées après l’arrêt');
	page.wheel();
	assert.equal(page.run(2000).at(-1).y, 3120);
});

// Au repos, le Glissé ne coûte rien : ni image demandée, ni écouteur de défilement.
test('le glissé ne demande d’images qu’entre un cran et l’arrivée', async () => {
	const page = await glide();
	assert.equal(page.pending(), 0, 'images demandées au chargement');
	assert.equal(page.listeners.scroll, undefined, 'le défilement est suivi par le script');
	page.wheel();
	page.wheel();
	assert.equal(page.pending(), 1, 'une image par cran');
	page.run(2000);
	assert.equal(page.pending(), 0, 'images demandées à l’arrivée');
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
	assert.deepEqual([page.requests, page.pending()], [[], 0], 'glissé lancé');
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
	assert.deepEqual([page.requests, page.pending()], [[], 0], 'glissé lancé');

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
	assert.deepEqual([page.requests, page.pending()], [[], 0], 'glissé lancé');

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
