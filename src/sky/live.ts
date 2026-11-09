/**
 * The sky as time passes and as the visitor picks `:set bg=` (ADR 0008). The inline script in the
 * `<head>` has painted it once (`SkyTrigger.astro`); this module keeps it true.
 *
 * - The page's theme turns at sunrise and sunset: one timer to the next of them, set again on every paint,
 *   and a paint whenever the tab comes back (a hidden tab's timers run late).
 * - The hero's line creeps west a few pixels a minute: a registered scene, ticking only while the map
 *   is on screen and once the Intro has ended, so that nothing runs that nobody sees.
 * - A new `:set bg=` turns the page over in a view transition, while the hero's night slides.
 */
import { openingEnded, registerScene } from '../animation/base';
import { watchOffScreen } from '../animation/offscreen';
import { paintSky, skyPlace } from './sky';

const root = document.documentElement;
const map = document.querySelector<HTMLElement>('.hero-map');
const line = map?.querySelector<HTMLElement>('.sky') ?? root;
const MINUTE = 60_000;

let turn: ReturnType<typeof setTimeout> | undefined;
function paint() {
	clearTimeout(turn);
	turn = setTimeout(paint, paintSky(root, new Date(), skyPlace, line));
}
paint();
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) paint();
});
addEventListener('pageshow', (event) => {
	if (event.persisted) paint();
});

const choices = document.querySelector<HTMLElement>('[data-bg-switch]');
choices?.addEventListener('change', (event) => {
	const choice = event.target;
	if (!(choice instanceof HTMLInputElement)) return;
	const auto = choice.value === 'auto';
	// Storage throws when the browser blocks site data: the choice then lasts for this visit only.
	try {
		if (auto) localStorage.removeItem('bg');
		else localStorage.setItem('bg', choice.value);
	} catch {}
	turnOver(() => {
		if (auto) delete root.dataset.bg;
		else root.dataset.bg = choice.value;
		paint();
	});
});

/**
 * The whole page restyled at once would be a cut: a view transition fades the old page into the new one,
 * a snapshot over a live page, on the GPU. Its own duration rides on a class (`global.css`).
 */
function turnOver(update: () => void) {
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (still || !document.startViewTransition) {
		update();
		return;
	}
	root.classList.add('sky-turning');
	document.startViewTransition(update).finished.finally(() => root.classList.remove('sky-turning'));
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
