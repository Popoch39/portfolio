/**
 * A pick in the Nuancier (03 · Nuancier, ADR 0009). The new paper spreads over the page from the strip
 * that was picked, in a circle ringed with the accent; meanwhile the strip rises, its book shuts on its
 * rivet and fans out again with that strip at the front. The other book stays as it is.
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
/** The last pick's strip, not yet at the front of its book. */
let pending: (() => void) | undefined;

fan?.addEventListener('change', (event) => {
	const input = event.target;
	if (!(input instanceof HTMLInputElement)) return;
	const slot = input.closest<HTMLElement>('[data-slot]');
	const book = input.closest<HTMLElement>('[data-book]');
	if (!slot || !book) return;
	pick(book, slot, input.value);
});

function pick(book: HTMLElement, slot: HTMLElement, bg: string) {
	timers.forEach(clearTimeout);
	timers = [];
	ringAnimation?.cancel();
	// A pick in the other book would leave the last one's strip behind: it goes to the front at once.
	pending?.();
	for (const launched of fan?.querySelectorAll<HTMLElement>('[data-launch]') ?? []) delete launched.dataset.launch;

	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (still || !document.startViewTransition) {
		applyBg(bg);
		toFront(book, slot);
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
	pending = () => {
		pending = undefined;
		toFront(book, slot);
		delete book.dataset.phase;
	};
	timers.push(
		setTimeout(() => {
			delete slot.dataset.launch;
			book.dataset.phase = 'closed';
		}, SHUT_AT),
		setTimeout(() => pending?.(), SHUT_AT + SHUTTING),
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

/** The picked strip goes to the front of its book; the others keep their order behind it. */
function toFront(book: HTMLElement, slot: HTMLElement) {
	const slots = [...book.querySelectorAll<HTMLElement>('[data-slot]')].sort(
		(a, b) => Number(a.dataset.slot) - Number(b.dataset.slot),
	);
	[...slots.filter((other) => other !== slot), slot].forEach((each, index) => {
		each.dataset.slot = String(index);
	});
}
