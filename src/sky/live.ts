/**
 * The sky as time passes and as the visitor picks a paper (ADR 0008, ADR 0009). The inline script in
 * the `<head>` has painted it once (`SkyTrigger.astro`); this module keeps it true.
 *
 * - The page's theme turns at sunrise and sunset: one timer to the next of them, set again on every paint,
 *   and a paint whenever the tab comes back (a hidden tab's timers run late).
 * - The hero's line creeps west a few pixels a minute: a registered scene, ticking only while the map
 *   is on screen and once the Intro has ended, so that nothing runs that nobody sees.
 * - A paper picked in the Nuancier is applied here (`applyBg`); its reveal is `nuancier.ts`'s.
 */
import { openingEnded, registerScene } from '../animation/base';
import { watchOffScreen } from '../animation/offscreen';
import { sky } from '../i18n/fr';
import { forPage } from '../i18n/lang';
import { BG_KEY, paintSky, skyPlace } from './sky';

const words = forPage({ fr: sky });
const root = document.documentElement;
const map = document.querySelector<HTMLElement>('.hero-map');
const line = map?.querySelector<HTMLElement>('.sky') ?? root;
const MINUTE = 60_000;

let turn: ReturnType<typeof setTimeout> | undefined;
function paint() {
	clearTimeout(turn);
	const half = root.dataset.skyHalf;
	turn = setTimeout(paint, paintSky(root, new Date(), skyPlace, words, line));
	if (half !== root.dataset.skyHalf) cut();
}

/**
 * At noon and at midnight the night changes sides of the line, and the line jumps across the map:
 * both happen at once, without the slide, for the frames that take them in (`index.astro`).
 */
function cut() {
	if (!map) return;
	map.classList.add('sky-cut');
	requestAnimationFrame(() => requestAnimationFrame(() => map.classList.remove('sky-cut')));
}
paint();
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) paint();
});
addEventListener('pageshow', (event) => {
	if (event.persisted) paint();
});

/**
 * Puts the page on the paper the visitor picked in the Nuancier, for the rest of the visit: the next
 * one draws its own (`SkyTrigger.astro`).
 */
export function applyBg(bg: string) {
	remember(bg);
	if (bg === 'auto') delete root.dataset.bg;
	else root.dataset.bg = bg;
	paint();
}

/**
 * Keeps the choice from page to page; tells whether it could. `auto` is kept too, so that the next
 * draw does not land on it again. Storage throws when the browser blocks site data: the choice then
 * lasts for this page only.
 */
function remember(bg: string) {
	try {
		sessionStorage.setItem(BG_KEY, bg);
		return true;
	} catch {
		return false;
	}
}

registerScene(() => {
	if (!map || line === root) return;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onScreen = false;
	let opened = false;
	let stopped = false;
	// On the minute: the line moves once, by a few pixels, and slides there (`index.astro`).
	const tick = () => {
		paint();
		timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE));
	};
	const follow = () => {
		clearTimeout(timer);
		if (onScreen && opened) tick();
	};
	const stopWatching = watchOffScreen(map, (offScreen) => {
		onScreen = !offScreen;
		follow();
	});
	openingEnded.then(() => {
		if (stopped) return;
		opened = true;
		follow();
	});
	return () => {
		stopped = true;
		clearTimeout(timer);
		stopWatching();
	};
});
