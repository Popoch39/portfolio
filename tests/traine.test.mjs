// La Traîne de la Visite (ADR 0012) : la scène rattrape le défilement au lieu de s'arrêter net avec lui.
// Le module du build est exécuté dans un faux navigateur : le test fait défiler la page et rend les
// images, et lit le décalage de la piste, la seule chose que la Traîne touche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, constants } from 'node:zlib';
import { attr, moduleGraph, readDist, readHome, tags } from './helpers/dist.mjs';

const moduleOf = (html) => attr(tags(html, 'script').find((t) => attr(t, 'type') === 'module') ?? '', 'src') ?? '';
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);
const trailsOf = (html) => onDemand(moduleGraph(moduleOf(html)).code).filter((path) => readDist(path.slice(1)).includes('visit-track'));

const SCREEN = 900;

test('l’accueil demande la Traîne à la demande, en moins de 1 000 octets', () => {
	for (const locale of ['fr', 'en']) {
		const html = readHome(locale);
		const trails = trailsOf(html);
		assert.equal(trails.length, 1, `${locale} : ${trails.join(', ') || 'aucune Traîne'}`);
		assert.ok(!moduleGraph(moduleOf(html)).paths.includes(trails[0]), `${locale} : Traîne chargée avec le module`);
	}
	const weight = brotliCompressSync(readDist(trailsOf(readHome())[0].slice(1)), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;
	assert.ok(weight <= 1000, `Traîne de ${weight} o`);
});

let runs = 0;
/** Exécute la Traîne, la piste affichée ou non (`played`), la section à l'écran ou non. */
async function trail({ played = true } = {}) {
	const listeners = {};
	const frames = [];
	let observed;
	let now = 0;
	const track = { style: { marginTop: '' }, parentElement: {} };
	Object.assign(globalThis, {
		scrollY: 0,
		innerHeight: SCREEN,
		addEventListener: (type, listener) => (listeners[type] ??= []).push(listener),
		requestAnimationFrame: (callback) => frames.push(callback),
		cancelAnimationFrame: () => frames.splice(0),
		getComputedStyle: () => ({ display: played ? 'block' : 'none' }),
		IntersectionObserver: class {
			constructor(callback) {
				observed = (isIntersecting) => callback([{ isIntersecting }]);
			}
			observe() {}
		},
		document: { querySelector: (selector) => (selector === '.visit-track' ? track : null) },
	});
	await import(`${new URL(`../dist${trailsOf(readHome())[0]}`, import.meta.url)}?${++runs}`);
	return {
		near: (isIntersecting = true) => observed(isIntersecting),
		scroll(y) {
			globalThis.scrollY = y;
			listeners.scroll?.forEach((listener) => listener());
		},
		/** Rend `count` images de 16 ms ; rend `true` si une image en demande encore une. */
		frames(count) {
			for (let i = 0; i < count && frames.length; i++) {
				now += 16;
				frames.splice(0).forEach((callback) => callback(now));
			}
			return frames.length > 0;
		},
		offset: () => parseFloat(track.style.marginTop || '0'),
	};
}

test('la piste suit l’avance du défilement, puis revient d’elle-même à sa place une fois le défilement arrêté', async () => {
	const page = await trail();
	page.near();
	page.scroll(200);
	page.frames(1);
	const first = page.offset();
	// Décalée vers le bas de presque toute l'avance : la scène montre encore le défilement d'avant.
	assert.ok(first > 150 && first < 200, `décalage ${first}`);
	// Le défilement arrêté, la scène continue sur sa lancée et rattrape : le décalage décroît sans à-coup.
	let previous = first;
	for (let i = 0; i < 10; i++) {
		page.frames(1);
		assert.ok(page.offset() < previous, `image ${i} : ${page.offset()} après ${previous}`);
		previous = page.offset();
	}
	const more = page.frames(100);
	assert.equal(page.offset(), 0, 'piste pas revenue à sa place');
	assert.equal(more, false, 'images encore demandées une fois rattrapé');
});

test('un saut loin (ancre, Lunette) ne laisse qu’un tiers d’écran de retard', async () => {
	const page = await trail();
	page.near();
	page.scroll(5000);
	page.frames(1);
	assert.ok(page.offset() <= SCREEN / 3 + 0.5, `décalage ${page.offset()}`);
	page.scroll(0);
	page.frames(1);
	assert.ok(page.offset() >= -SCREEN / 3 - 0.5, `décalage ${page.offset()}`);
});

test('loin de la section, ou là où la Visite ne joue pas, la piste reste à sa place', async () => {
	const away = await trail();
	away.scroll(300);
	assert.equal(away.frames(1), false, 'image demandée loin de la section');
	assert.equal(away.offset(), 0);
	// Revenue près de la section, la Traîne part du défilement du moment, pas de celui d'avant.
	away.near();
	away.scroll(310);
	away.frames(1);
	assert.ok(away.offset() <= 10, `décalage ${away.offset()}`);

	const still = await trail({ played: false });
	still.near();
	still.scroll(300);
	assert.equal(still.frames(1), false, 'image demandée sans Visite');
	assert.equal(still.offset(), 0);

	const left = await trail();
	left.near();
	left.scroll(300);
	left.frames(1);
	left.near(false);
	assert.equal(left.offset(), 0, 'piste laissée décalée en quittant la section');
});
