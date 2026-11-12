/**
 * A pick in the Nuancier (03 · Nuancier, ADR 0009). The new paper spreads over the page from the strip
 * that was picked, in a circle ringed with the accent; meanwhile the strip rises and the book shuts on its
 * rivet with that strip at the front. Under a mouse that is still over it, it fans out again.
 *
 * A tap opens the shut book (`data-open`), and a tap on the paper in force or anywhere else shuts it; a
 * mouse opens it by coming over it, the keyboard by focusing a strip (`Nuancier.astro`).
 *
 * The reveal is a view transition: the old page is a snapshot, the new one is live under a `clip-path`
 * circle that grows to the farthest corner of the window. The whole page restyles once, inside the
 * transition's update, and never again during it. The ring is a page element scaled from nothing with
 * the circle, so its edge rides just inside the new paper. The fan is lifted out of the snapshots
 * (`view-transition-name`, `global.css`) so that its strips move live above the reveal.
 *
 * A pick during a reveal skips it to its end and starts its own from there. Under reduced motion, or
 * without view transitions, the paper changes at once and the strips take their places without moving.
 */
import { applyBg } from './live';

const DURATION = 900;
const EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
/** When the book shuts, then how long it takes to (`Nuancier.astro`'s slots' transition). */
const SHUT_AT = Math.round(DURATION * 0.6);
const SHUTTING = 440;

const root = document.documentElement;
const fan = document.querySelector<HTMLElement>('[data-nuancier]');
const ring = document.querySelector<HTMLElement>('[data-nuancier-ring]');

let timers: ReturnType<typeof setTimeout>[] = [];
let ringAnimation: Animation | undefined;
let current: ViewTransition | undefined;

fan?.addEventListener('change', (event) => {
	const input = event.target;
	if (!(input instanceof HTMLInputElement)) return;
	const slot = input.closest<HTMLElement>('[data-slot]');
	if (!slot) return;
	pick(fan, slot, input.value);
});

fan?.addEventListener('pointerdown', (event) => {
	if (event.pointerType === 'mouse') return;
	if (!('open' in fan.dataset)) {
		fan.dataset.open = '';
		return;
	}
	const input = event.target instanceof Element ? event.target.closest('label')?.querySelector('input') : null;
	if (input?.checked) delete fan.dataset.open;
});

document.addEventListener('pointerdown', (event) => {
	if (fan && 'open' in fan.dataset && !(event.target instanceof Node && fan.contains(event.target))) {
		delete fan.dataset.open;
	}
});

function pick(fan: HTMLElement, slot: HTMLElement, bg: string) {
	timers.forEach(clearTimeout);
	timers = [];
	ringAnimation?.cancel();
	for (const launched of fan.querySelectorAll<HTMLElement>('[data-launch]')) delete launched.dataset.launch;
	delete fan.dataset.phase;

	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (still || !document.startViewTransition) {
		applyBg(bg);
		toFront(fan, slot);
		delete fan.dataset.open;
		return;
	}

	// The circle starts on the strip and ends past the farthest corner of the window.
	const strip = slot.firstElementChild?.getBoundingClientRect() ?? slot.getBoundingClientRect();
	const x = strip.left + strip.width / 2;
	const y = strip.top + strip.height / 2;
	const w = innerWidth;
	const h = innerHeight;
	const r = Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 4;
	ring?.style.setProperty('--x', `${x.toFixed(1)}px`);
	ring?.style.setProperty('--y', `${y.toFixed(1)}px`);
	ring?.style.setProperty('--r', `${r}px`);

	slot.dataset.launch = '';
	timers.push(
		setTimeout(() => {
			delete slot.dataset.launch;
			fan.dataset.phase = 'closed';
		}, SHUT_AT),
		setTimeout(() => {
			toFront(fan, slot);
			delete fan.dataset.phase;
			delete fan.dataset.open;
		}, SHUT_AT + SHUTTING),
	);

	root.classList.add('paper-turning');
	const transition = document.startViewTransition(() => applyBg(bg));
	current = transition;
	const at = ` at ${x.toFixed(1)}px ${y.toFixed(1)}px`;
	transition.ready.then(
		() => {
			root.animate(
				{ clipPath: [`circle(0px${at})`, `circle(${r}px${at})`] },
				{ duration: DURATION, easing: EASE, pseudoElement: '::view-transition-new(root)' },
			);
			ringAnimation = ring?.animate(
				[
					{ transform: 'scale(0)', opacity: 0 },
					{ opacity: 1, offset: 0.06 },
					{ opacity: 1, offset: 0.78 },
					{ transform: 'scale(1)', opacity: 0 },
				],
				{ duration: DURATION, easing: EASE },
			);
		},
		// Skipped by a newer pick before it could start: the newer one plays the reveal, from here.
		() => ringAnimation?.cancel(),
	);
	transition.finished.finally(() => {
		if (current === transition) root.classList.remove('paper-turning');
	});
}

/** The picked strip goes to the front of the book; the others keep their order behind it. */
function toFront(fan: HTMLElement, slot: HTMLElement) {
	const slots = [...fan.querySelectorAll<HTMLElement>('[data-slot]')].sort(
		(a, b) => Number(a.dataset.slot) - Number(b.dataset.slot),
	);
	[...slots.filter((other) => other !== slot), slot].forEach((each, index) => {
		each.dataset.slot = String(index);
	});
}
