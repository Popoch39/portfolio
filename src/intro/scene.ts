/**
 * The Intro (ADR 0005): a timeline played once under the veil on loading the home page, then the
 * header, the hero and the statusline revealed in the mockup's order. The inline script in the
 * `<head>` decides whether it plays (class on `<html>`); without that class, nothing happens here.
 */
import { gsap, registerScene, ScrollSmoother } from '../animation/base';
import { END, LATE, REVEAL, REVEAL_EASE, RULE, SKIP_FADE, STATUSLINE, TITLE_RISE, VEIL_LIFT } from './timing';

const reveal = cubicBezier(...REVEAL_EASE);

const PLAYING = 'intro';

const marked = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-intro="${name}"]`);

registerScene(() => {
	const root = document.documentElement;
	const veil = document.getElementById('veil');
	if (!root.classList.contains(PLAYING) || !veil) return;

	// Native scrolling and smoothing alike: the paused smoother swallows wheel, touch and scroll.
	const smoother = ScrollSmoother.get();
	smoother?.paused(true);

	const timeline = gsap.timeline({ onComplete: () => finish() });
	// The hero is painted at its final state under the veil (it is the LCP): the reveals' starting
	// states are only set when the veil lifts, never before.
	const reveals = Object.keys(REVEAL.offsets).flatMap(marked);
	const lines = marked('line');
	const late = marked('late');
	const statusline = marked('statusline');
	timeline
		.set(veil, { autoAlpha: 0 }, VEIL_LIFT)
		.set(reveals, { opacity: 0, y: REVEAL.rise }, VEIL_LIFT)
		.set(lines, { yPercent: TITLE_RISE.from }, VEIL_LIFT)
		.set(late, { opacity: 0 }, VEIL_LIFT)
		.set(statusline, { yPercent: 100 }, VEIL_LIFT);
	// The rule is a pseudo-element: it scales through a custom property of the header.
	timeline.fromTo(
		marked('rule'),
		{ '--rule-scale': 0 },
		{ '--rule-scale': 1, duration: RULE.duration, ease: reveal, immediateRender: false },
		RULE.start,
	);
	for (const [name, offset] of Object.entries(REVEAL.offsets)) {
		timeline.to(marked(name), { opacity: 1, y: 0, duration: REVEAL.duration, ease: reveal }, VEIL_LIFT + offset);
	}
	timeline
		.to(lines, { yPercent: 0, duration: TITLE_RISE.duration, stagger: TITLE_RISE.stagger, ease: reveal }, TITLE_RISE.start)
		.to(late, { opacity: 1, duration: LATE.duration, ease: 'none' }, LATE.start)
		.to(statusline, { yPercent: 0, duration: STATUSLINE.duration, ease: reveal }, STATUSLINE.start)
		// The canvas layer (grid fading out over the page) lasts until here.
		.call(() => {}, [], END);

	let fade: gsap.core.Tween | undefined;
	const firstLink = document.querySelector<HTMLElement>('#smooth-content a[href]');

	// Any gesture skips the Intro: the page jumps to its final state and the veil fades out over it.
	const skip = () => {
		if (fade) return;
		stopListening();
		const veilShown = timeline.time() < VEIL_LIFT;
		timeline.progress(1, true);
		fade = gsap.fromTo(
			veil,
			{ autoAlpha: veilShown ? 1 : 0 },
			{ autoAlpha: 0, duration: SKIP_FADE, ease: 'power1.out', onComplete: finish },
		);
	};
	// Focus never disappears under the veil: Tab lands on the first link of the page.
	const onKey = (event: KeyboardEvent) => {
		if (event.key === 'Tab') {
			event.preventDefault();
			firstLink?.focus();
		}
		skip();
	};
	// Restored from the back/forward cache halfway through: the visitor wants the page back as left.
	const onCacheRestore = (event: PageTransitionEvent) => {
		if (event.persisted) finish();
	};
	addEventListener('keydown', onKey, true);
	addEventListener('pointerdown', skip, true);
	addEventListener('wheel', skip, { capture: true, passive: true });
	addEventListener('pageshow', onCacheRestore);
	function stopListening() {
		removeEventListener('keydown', onKey, true);
		removeEventListener('pointerdown', skip, true);
		removeEventListener('wheel', skip, { capture: true });
	}

	// Ended, skipped or reverted by a change of motion preference: nothing of the Intro survives.
	let finished = false;
	function finish() {
		if (finished) return;
		finished = true;
		stopListening();
		removeEventListener('pageshow', onCacheRestore);
		root.classList.remove(PLAYING);
		smoother?.paused(false);
		fade?.revert();
		timeline.revert();
	}
	return finish;
});

/**
 * A CSS `cubic-bezier()` as a GSAP ease: finds the curve parameter whose x is the progress
 * (Newton's method), then returns its y. Written out rather than CustomEase, which would add
 * about 4 KB gzip to the home page for this one curve.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
	const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
	const slope = (a: number, b: number, t: number) =>
		3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
	return (progress: number) => {
		let t = progress;
		for (let i = 0; i < 8; i++) {
			const s = slope(x1, x2, t);
			if (Math.abs(s) < 1e-6) break;
			t = Math.min(1, Math.max(0, t - (at(x1, x2, t) - progress) / s));
		}
		return at(y1, y2, t);
	};
}
