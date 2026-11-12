/**
 * The Traîne's ring (`Trail.astro`): it catches the pointer's point up with a short ease and opens
 * over what answers a click. The point itself is the cursor's image (`global.css`), not moved here.
 * Loaded with the animation base by the layout, in the same script: no request of its own.
 */
import { openingEnded, registerDetail } from './base';

/** A mouse only: a finger has no cursor, and forced colours keep the system's own (as the point does). */
const mouse = matchMedia('(hover: hover) and (pointer: fine) and (forced-colors: none)');
/** What answers a click: where the ring opens (the same list as the point's hand, in `global.css`). */
const LINK = 'a[href], button:enabled, summary, label:not(:has(:disabled)), input:enabled';
/** The time the ring takes to cover about two thirds of what separates it from the point, in ms. */
const EASE = 90;
/** Closer than this, in px, nothing more would show: the ring is put on the point and the loop ends. */
const CAUGHT_UP = 0.25;

const ring = document.querySelector<HTMLElement>('[data-trail]');

// Under the Voile the point stands alone: the Intro keeps the main thread to itself while it moves.
let opened = false;
openingEnded.then(() => {
	opened = true;
});

if (ring)
	registerDetail(({ conditions }) => {
		// Reduced motion: the ring stays on the point, without the ease.
		const eased = conditions?.motionAllowed ?? false;
		let pointerX = 0;
		let pointerY = 0;
		let x = 0;
		let y = 0;
		/** The pointer is in the window, and over what answers a click. */
		let inside = false;
		let overLink = false;
		/** What the ring shows, written only when it changes. */
		let shown = false;
		let open = false;
		let last = 0;
		let frame = 0;

		// Written once per frame, from a move until the ring has caught up; then no frame is asked for:
		// a still pointer, or one that has left the window, costs nothing.
		const draw = (now: number) => {
			frame = 0;
			// A frame can be stamped before the move that asked for it: no step back.
			const elapsed = Math.max(0, now - last);
			last = now;
			// Coming back into the window, the ring is on the point: it does not fly in from where it was left.
			const covered = eased && shown ? 1 - Math.exp(-elapsed / EASE) : 1;
			x += (pointerX - x) * covered;
			y += (pointerY - y) * covered;
			if (Math.abs(pointerX - x) < CAUGHT_UP && Math.abs(pointerY - y) < CAUGHT_UP) {
				x = pointerX;
				y = pointerY;
			} else if (inside) frame = requestAnimationFrame(draw);
			ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			if (shown !== inside) {
				shown = inside;
				ring.hidden = !shown;
			}
			if (open !== overLink) {
				open = overLink;
				ring.toggleAttribute('data-open', open);
			}
		};
		const schedule = () => {
			if (frame) return;
			last = performance.now();
			frame = requestAnimationFrame(draw);
		};

		// The element under the pointer only changes at a `pointerover`: nothing is looked up at each move.
		const over = (event: PointerEvent) => {
			if (!opened || event.pointerType !== 'mouse' || !mouse.matches || !(event.target instanceof Element)) return;
			pointerX = event.clientX;
			pointerY = event.clientY;
			inside = true;
			overLink = event.target.closest(LINK) !== null;
			schedule();
		};
		const moved = (event: PointerEvent) => {
			// The pointer is already over something at its first move, which no `pointerover` has told.
			if (!inside) return over(event);
			if (event.pointerType !== 'mouse') return;
			pointerX = event.clientX;
			pointerY = event.clientY;
			schedule();
		};
		const left = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse' || !inside) return;
			inside = false;
			schedule();
		};

		const root = document.documentElement;
		document.addEventListener('pointermove', moved, { passive: true });
		document.addEventListener('pointerover', over, { passive: true });
		root.addEventListener('pointerleave', left);
		return () => {
			document.removeEventListener('pointermove', moved);
			document.removeEventListener('pointerover', over);
			root.removeEventListener('pointerleave', left);
			cancelAnimationFrame(frame);
			ring.hidden = true;
			ring.removeAttribute('data-open');
			ring.style.removeProperty('transform');
		};
	});
