/**
 * The Intro (ADR 0005): a timeline played once under the veil on loading the home page: the globe
 * drawn in a canvas on the timeline's progress (by a Worker where the browser can, `globe.worker.ts`),
 * then the header, the hero and the statusline revealed in the mockup's order. The inline script in the `<head>` decides whether it plays (class
 * on `<html>`); without that class, nothing happens here.
 */
import { gsap, registerOpening, ScrollSmoother } from '../animation/base';
import { globePainter } from './canvas';
import { cubicBezier } from './ease';
import { coordinate, decimal, fitColumns, frameAt, type Layout } from './globe';
import { boilStep } from './grain';
import type { GlobeMessage } from './globe.worker';
import { decodeGrain, newSurface, readPalette } from './inputs';
import {
	BOIL,
	DEAD_TIME,
	END,
	HUD,
	LATE,
	POINT,
	REVEAL,
	REVEAL_EASE,
	RULE,
	SKIP_FADE,
	STATUSLINE,
	TITLE_RISE,
	VEIL_LIFT,
} from './timing';

const reveal = cubicBezier(...REVEAL_EASE);

const PLAYING = 'intro';
/**
 * On `<html>` once the scene has started: the inline script's safety net (`IntroTrigger.astro`) no
 * longer lifts the veil in its place.
 */
const STARTED = 'data-intro-started';
/** On `#intro-over` once the veil has lifted: the grid goes under the statusline (`Intro.astro`). */
const LOWERED = 'lowered';

/** The inputs that scroll the page, and the keys among them. */
const HELD_INPUTS = ['wheel', 'touchmove', 'keydown'] as const;
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']);

/**
 * The globe is drawn at the device's pixel ratio up to this: on a 3× screen, a full-window canvas
 * would cost more than twice the pixels for a sharpness nobody tells apart at reading distance.
 */
const MAX_PIXEL_RATIO = 2;
const pixelRatio = () => Math.min(devicePixelRatio, MAX_PIXEL_RATIO);

const marked = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-intro="${name}"]`);

registerOpening((end, idle) => {
	const root = document.documentElement;
	const parts = introParts();
	if (!root.classList.contains(PLAYING) || !parts) return;
	const { veil, over, canvas, header, rule, marker, place, label, labelText, paper, hud, grain, tick, bar } = parts;
	const texts = [parts.phase, parts.gore, parts.lat, parts.lon, parts.scale];
	let finished = false;

	// The globe lands on the real page: measured now, again once the fonts are in, and on every resize.
	let layout = measure();
	// Daylight's ink, whatever the page's theme: read where the Intro keeps it.
	const palette = readPalette(over);
	// Drawn by a Worker on the transferred canvas where the browser can; here otherwise, or as soon as
	// the Worker fails: a failing Worker is not a failing Intro.
	let drawnOn = canvas;
	let painter: ReturnType<typeof globePainter> | null = null;
	let noise: ImageBitmap | null = null;
	let worker = drawElsewhere();
	if (!worker) drawHere();
	decodeGrain(pixelRatio()).then((decoded) => {
		if (!decoded) return;
		if (finished) {
			decoded.close();
			return;
		}
		noise = decoded;
		// Copied, not transferred: the page keeps it in case it has to draw the globe itself.
		post({ type: 'grain', noise });
		painter?.grain(noise);
	});

	function drawElsewhere() {
		if (!('transferControlToOffscreen' in drawnOn) || typeof Worker !== 'function') return null;
		let drawer: Worker;
		try {
			drawer = new Worker(new URL('./globe.worker.ts', import.meta.url), { type: 'module' });
		} catch (error) {
			// Refused at once (a policy, an unsupported module Worker): the page draws the globe.
			console.warn('Intro: the globe is drawn on the main thread', error);
			return null;
		}
		const offscreen = drawnOn.transferControlToOffscreen();
		drawer.addEventListener('error', fallBack);
		drawer.addEventListener('messageerror', fallBack);
		drawer.postMessage(
			{ type: 'init', canvas: offscreen, palette, layout, ratio: pixelRatio() } satisfies GlobeMessage,
			[offscreen],
		);
		return drawer;
	}
	function drawHere() {
		const context = drawnOn.getContext('2d');
		painter = context && globePainter(context, palette, newSurface);
		painter?.resize(layout.width, layout.height, pixelRatio());
		if (noise) painter?.grain(noise);
	}
	function fallBack() {
		if (finished || !worker) return;
		stopWorker();
		drawHere();
		render();
	}
	/** Stops the Worker and lets go of the canvas it drew on: a fresh one takes its place. */
	function stopWorker() {
		worker?.terminate();
		worker = null;
		const fresh = drawnOn.cloneNode(false);
		if (!(fresh instanceof HTMLCanvasElement)) return;
		drawnOn.replaceWith(fresh);
		drawnOn = fresh;
	}
	function post(message: GlobeMessage) {
		worker?.postMessage(message);
	}
	// A hidden tab stops the timeline's ticks: the globe must not run ahead of it meanwhile.
	const onVisibility = () => {
		if (document.hidden) post({ type: 'time', t: clock.t, running: false });
	};
	document.addEventListener('visibilitychange', onVisibility);

	function measure(): Layout {
		const grid = header.getBoundingClientRect();
		const point = marker.getBoundingClientRect();
		const landing = place.getBoundingClientRect();
		const view = { width: over.clientWidth, height: over.clientHeight };
		const { columns, gutter } = fitColumns(view, {
			width: grid.width,
			gutter: Number.parseFloat(getComputedStyle(header).columnGap) || 0,
		});
		return {
			...view,
			columns,
			gridLeft: grid.left,
			gridWidth: grid.width,
			gutter,
			headerBottom: grid.bottom,
			marker: { x: point.left, y: point.top, w: point.width, h: point.height },
			place: { x: landing.left, y: landing.top },
			labelWidth: label.offsetWidth,
		};
	}
	const relayout = () => {
		if (finished) return;
		layout = measure();
		post({ type: 'layout', layout, ratio: pixelRatio() });
		painter?.resize(layout.width, layout.height, pixelRatio());
		render();
	};
	addEventListener('resize', relayout);
	document.fonts.ready.then(relayout);

	// The HUD's text is the one layout the Intro causes after its start: its figures move on the
	// grain's beat (BOIL.step, about 14 times a second) like an instrument's readout, not every frame,
	// and a line is only rewritten when its value has changed.
	const shown = new Map<HTMLElement, string>();
	let hudStep = -1;
	const write = (node: HTMLElement, text: string) => {
		if (shown.get(node) === text) return;
		shown.set(node, text);
		node.textContent = text;
	};
	let paperStep = -1;
	let scaled = Number.NaN;
	// The scale bar's width at rest, in its CSS.
	const scaleBar = bar.offsetWidth;
	let labelOpacity = Number.NaN;
	let labelX = Number.NaN;
	let labelY = Number.NaN;
	const clock = { t: 0 };
	let skipping = false;
	function render() {
		if (skipping || finished) return;
		const { t } = clock;
		// The grid stays over the page once the veil has lifted, under the statusline that rises later.
		over.classList.toggle(LOWERED, t >= VEIL_LIFT);
		const frame = frameAt(t, layout);
		post({ type: 'time', t, running: true });
		painter?.draw(frame, layout);
		if (frame.label.x !== labelX || frame.label.y !== labelY) {
			labelX = frame.label.x;
			labelY = frame.label.y;
			label.style.transform = `translate(${labelX}px, ${labelY}px)`;
		}
		if (frame.label.opacity !== labelOpacity) {
			labelOpacity = frame.label.opacity;
			label.style.opacity = String(labelOpacity);
		}
		const { phase, gore, lat, lon, goreWidth, gutter } = frame.hud;
		if (boilStep(t) !== hudStep) {
			hudStep = boilStep(t);
			const values = [
				phase,
				`${String(gore + 1).padStart(2, '0')} / 12`,
				coordinate(lat, 'N', 'S'),
				coordinate(lon, 'E', 'O'),
				`fuseau ${decimal(goreWidth)} px · gouttière ${decimal(gutter)} px`,
			];
			texts.forEach((node, i) => write(node, values[i]));
		}
		if (goreWidth !== scaled) {
			scaled = goreWidth;
			tick.style.transform = `translateX(${scaleBar - goreWidth}px)`;
			bar.style.transform = `scaleX(${goreWidth / scaleBar})`;
		}
		const step = boilStep(t + BOIL.paperLead);
		if (step !== paperStep) {
			paperStep = step;
			const [x, y] = BOIL.offsets[step];
			grain.style.transform = `translate(${x}px, ${y}px)`;
		}
	}

	const timeline = gsap.timeline({ onComplete: () => finish() });
	// The globe's clock: the canvas is drawn on the timeline's progress, until the grid has faded.
	timeline.to(clock, { t: END, duration: END, ease: 'none', onUpdate: render }, 0);
	timeline
		.to(hud, { opacity: 1, duration: HUD.in.duration, ease: 'none' }, HUD.in.start)
		.to(hud, { opacity: 0, duration: HUD.out.duration, ease: 'none' }, HUD.out.start)
		.to(labelText, { opacity: 1, duration: POINT.label.duration, ease: 'none' }, POINT.label.start);

	// The hero is painted at its final state under the veil (it is the LCP): the reveals' starting
	// states are only set when the veil lifts, never before.
	const reveals = Object.keys(REVEAL.offsets).flatMap(marked);
	const lines = marked('line');
	const late = marked('late');
	const statusline = marked('statusline');
	timeline
		.set([veil, paper], { autoAlpha: 0 }, VEIL_LIFT)
		.set(reveals, { opacity: 0, y: REVEAL.rise }, VEIL_LIFT)
		.set(lines, { yPercent: TITLE_RISE.from }, VEIL_LIFT)
		.set(late, { opacity: 0 }, VEIL_LIFT)
		.set(statusline, { yPercent: 100 }, VEIL_LIFT);
	timeline.fromTo(
		rule,
		{ scaleX: 0 },
		{ scaleX: 1, duration: RULE.duration, ease: reveal, immediateRender: false },
		RULE.start,
	);
	for (const [name, offset] of Object.entries(REVEAL.offsets)) {
		timeline.to(marked(name), { opacity: 1, y: 0, duration: REVEAL.duration, ease: reveal }, VEIL_LIFT + offset);
	}
	timeline
		.to(lines, { yPercent: 0, duration: TITLE_RISE.duration, stagger: TITLE_RISE.stagger, ease: reveal }, TITLE_RISE.start)
		.to(late, { opacity: 1, duration: LATE.duration, ease: 'none' }, LATE.start)
		.to(statusline, { yPercent: 0, duration: STATUSLINE.duration, ease: reveal }, STATUSLINE.start);
	// Never reached when skipped (`progress(1, true)` fires no callback): the end builds the scenes then.
	timeline.call(idle, undefined, DEAD_TIME);
	render();

	let fade: gsap.core.Timeline | undefined;
	const firstLink = document.querySelector<HTMLElement>('#smooth-content a[href]');

	// A click, a tap or a key skips the Intro: the page jumps to its final state and the Intro's last
	// frame fades out over it. Trying to scroll does not: it is held above, and the Intro plays on.
	const skip = () => {
		if (fade) return;
		stopListening();
		const veilShown = timeline.time() < VEIL_LIFT;
		skipping = true;
		// The globe stops where it stands, and fades out with the grid.
		post({ type: 'time', t: clock.t, running: false });
		timeline.progress(1, true);
		fade = gsap.timeline({ onComplete: finish });
		// Under the veil, the grid is not lowered yet (`render` no longer runs): it stays above the veil
		// while both fade.
		fade.fromTo(
			veilShown ? [veil, paper, over] : [over],
			{ autoAlpha: 1 },
			{ autoAlpha: 0, duration: SKIP_FADE, ease: 'power1.out' },
		);
	};
	// Focus never disappears under the veil: Tab lands on the first link of the page.
	const onKey = (event: KeyboardEvent) => {
		if (event.key === 'Tab') {
			event.preventDefault();
			firstLink?.focus();
		}
		if (!SCROLL_KEYS.has(event.key)) skip();
	};
	// Restored from the back/forward cache halfway through: the visitor wants the page back as left.
	const onCacheRestore = (event: PageTransitionEvent) => {
		if (event.persisted) finish();
	};
	addEventListener('keydown', onKey, true);
	// Not `pointerdown`: a swipe starts with one too, whereas it never ends in a click.
	addEventListener('click', skip, true);
	addEventListener('pageshow', onCacheRestore);
	function stopListening() {
		removeEventListener('keydown', onKey, true);
		removeEventListener('click', skip, true);
	}

	// Ended, skipped or reverted by a change of motion preference: nothing of the Intro survives.
	function finish() {
		if (finished) return;
		finished = true;
		stopListening();
		removeEventListener('pageshow', onCacheRestore);
		removeEventListener('resize', relayout);
		document.removeEventListener('visibilitychange', onVisibility);
		root.classList.remove(PLAYING);
		over.classList.remove(LOWERED);
		for (const type of HELD_INPUTS) removeEventListener(type, holdScroll);
		smoother?.paused(false);
		fade?.revert();
		timeline.revert();
		for (const node of [label, grain, tick, bar]) node.style.removeProperty('transform');
		label.style.removeProperty('opacity');
		if (worker) stopWorker();
		painter?.dispose();
		noise?.close();
		lifted.disconnect();
		root.removeAttribute(STARTED);
		end();
	}
	// The page does not scroll until the Intro has ended, fade included: the inputs that would scroll
	// it are cancelled. Not `overflow: hidden`: the scrollbar would go and come back, and with it the
	// width that `vw` measures (the page gutter). A dragged scrollbar cannot be cancelled: the paused
	// smoother brings the page straight back.
	// Last, with the start signal: a start-up that throws before here leaves the veil to the inline
	// script's safety net, over a page that still scrolls.
	const smoother = ScrollSmoother.get();
	smoother?.paused(true);
	const holdScroll = (event: Event) => {
		if (!(event instanceof KeyboardEvent) || SCROLL_KEYS.has(event.key)) event.preventDefault();
	};
	for (const type of HELD_INPUTS) addEventListener(type, holdScroll, { passive: false });
	// The safety net's belt may lift the veil in the middle of an Intro that no longer moves on (a
	// starved phone): the Intro then gives the page back as if it had ended.
	const lifted = new MutationObserver(() => {
		if (!root.classList.contains(PLAYING)) finish();
	});
	lifted.observe(root, { attributeFilter: ['class'] });
	root.setAttribute(STARTED, '');
	return finish;
});

/** The page and Intro elements the scene works on; `null` when one is missing. */
function introParts() {
	const over = document.getElementById('intro-over');
	const canvas = document.getElementById('intro-grid');
	const header = marked('header')[0];
	const part = (name: string) => over?.querySelector<HTMLElement>(`[data-hud="${name}"]`);
	const parts = {
		veil: document.getElementById('veil'),
		over,
		canvas: canvas instanceof HTMLCanvasElement ? canvas : null,
		header,
		rule: marked('rule')[0],
		// The Besançon marker of the hero's map, and its label.
		marker: document.querySelector<HTMLElement>('.hero-point'),
		place: document.querySelector<HTMLElement>('.hero-place'),
		label: part('label'),
		labelText: part('label')?.firstElementChild,
		paper: part('paper'),
		hud: part('hud'),
		grain: document.querySelector<HTMLElement>('#grain > *'),
		tick: part('tick'),
		bar: part('bar'),
		phase: part('phase'),
		gore: part('gore'),
		lat: part('lat'),
		lon: part('lon'),
		scale: part('scale'),
	};
	return allPresent(parts) ? parts : null;
}

function allPresent<T extends object>(parts: T): parts is { [K in keyof T]: NonNullable<T[K]> } {
	return Object.values(parts).every(Boolean);
}
