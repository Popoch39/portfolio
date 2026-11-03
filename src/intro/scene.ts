/**
 * The Intro (ADR 0005): a timeline played once under the veil on loading the home page: the globe
 * drawn in a canvas on the timeline's progress, then the header, the hero and the statusline
 * revealed in the mockup's order. The inline script in the `<head>` decides whether it plays (class
 * on `<html>`); without that class, nothing happens here.
 */
import { gsap, registerScene, ScrollSmoother } from '../animation/base';
import { globeCanvas, readPalette } from './canvas';
import { cubicBezier } from './ease';
import { decimal, fitColumns, type Layout } from './globe';
import { boilStep } from './grain';
import {
	BOIL,
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
/** On `#intro-over` once the veil has lifted: the grid goes under the statusline (`Intro.astro`). */
const LOWERED = 'lowered';

/** The inputs that scroll the page, and the keys among them. */
const HELD_INPUTS = ['wheel', 'touchmove', 'keydown'] as const;
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']);

const marked = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-intro="${name}"]`);

registerScene(() => {
	const root = document.documentElement;
	const parts = introParts();
	if (!root.classList.contains(PLAYING) || !parts) return;
	const { veil, over, canvas, header, cursor, meta, label, labelText, paper, hud, grain, tick, bar } = parts;
	const texts = [parts.phase, parts.gore, parts.lat, parts.lon, parts.scale];
	let finished = false;

	// The page does not scroll until the Intro has ended, fade included: the inputs that would scroll
	// it are cancelled. Not `overflow: hidden`: the scrollbar would go and come back, and with it the
	// width that `vw` measures (the page gutter). A dragged scrollbar cannot be cancelled: the paused
	// smoother brings the page straight back.
	const smoother = ScrollSmoother.get();
	smoother?.paused(true);
	const holdScroll = (event: Event) => {
		if (!(event instanceof KeyboardEvent) || SCROLL_KEYS.has(event.key)) event.preventDefault();
	};
	for (const type of HELD_INPUTS) addEventListener(type, holdScroll, { passive: false });

	// The globe lands on the real page: measured now, again once the fonts are in, and on every resize.
	const painter = globeCanvas(canvas, readPalette(root));
	let layout = measure();
	function measure(): Layout {
		const grid = header.getBoundingClientRect();
		const point = cursor.getBoundingClientRect();
		// The title line may be rising: the cursor is aimed at its resting place.
		const line = cursor.closest<HTMLElement>('[data-intro="line"]');
		const rising = line ? new DOMMatrixReadOnly(getComputedStyle(line).transform).m42 : 0;
		const coordinates = meta.getBoundingClientRect();
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
			cursor: { x: point.left, y: point.top - rising, w: point.width, h: point.height },
			// Hidden on phones: no box.
			meta: coordinates.width ? { x: coordinates.left, y: coordinates.top } : null,
			labelWidth: label.offsetWidth,
		};
	}
	const relayout = () => {
		if (finished) return;
		layout = measure();
		painter.resize(layout.width, layout.height, devicePixelRatio);
		render();
	};
	painter.resize(layout.width, layout.height, devicePixelRatio);
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
	const clock = { t: 0 };
	let skipping = false;
	function render() {
		if (skipping || finished) return;
		const { t } = clock;
		// The grid stays over the page once the veil has lifted, under the statusline that rises later.
		over.classList.toggle(LOWERED, t >= VEIL_LIFT);
		const frame = painter.draw(t, layout);
		label.style.transform = `translate(${frame.label.x}px, ${frame.label.y}px)`;
		if (frame.label.opacity !== labelOpacity) {
			labelOpacity = frame.label.opacity;
			label.style.opacity = String(labelOpacity);
		}
		const { phase, gore, lat, lon, goreWidth, gutter } = frame.hud;
		if (boilStep(t) !== hudStep) {
			hudStep = boilStep(t);
			const values = [phase, gore, lat, lon, `fuseau ${decimal(goreWidth)} px · gouttière ${decimal(gutter)} px`];
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
	// The rule is a pseudo-element: it scales through a custom property of the header.
	timeline.fromTo(
		header,
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
		.to(statusline, { yPercent: 0, duration: STATUSLINE.duration, ease: reveal }, STATUSLINE.start);
	render();

	let fade: gsap.core.Timeline | undefined;
	const firstLink = document.querySelector<HTMLElement>('#smooth-content a[href]');

	// Any gesture skips the Intro: the page jumps to its final state and the Intro's last frame
	// fades out over it.
	const skip = () => {
		if (fade) return;
		stopListening();
		const veilShown = timeline.time() < VEIL_LIFT;
		skipping = true;
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
	function finish() {
		if (finished) return;
		finished = true;
		stopListening();
		removeEventListener('pageshow', onCacheRestore);
		removeEventListener('resize', relayout);
		root.classList.remove(PLAYING);
		over.classList.remove(LOWERED);
		for (const type of HELD_INPUTS) removeEventListener(type, holdScroll);
		smoother?.paused(false);
		fade?.revert();
		timeline.revert();
		for (const node of [label, grain, tick, bar]) node.style.removeProperty('transform');
		label.style.removeProperty('opacity');
		// Releases the bitmap.
		canvas.width = canvas.height = 0;
	}
	return finish;
});

/** The page and Intro elements the scene works on; `null` when one is missing. */
function introParts() {
	const over = document.getElementById('intro-over');
	const canvas = document.getElementById('intro-grid');
	const header = marked('rule')[0];
	const part = (name: string) => over?.querySelector<HTMLElement>(`[data-hud="${name}"]`);
	const parts = {
		veil: document.getElementById('veil'),
		over,
		canvas: canvas instanceof HTMLCanvasElement ? canvas : null,
		header,
		cursor: document.querySelector<HTMLElement>('h1 .cursor'),
		meta: header?.querySelector<HTMLElement>('[data-intro="late"]'),
		label: part('label'),
		labelText: part('label')?.firstElementChild,
		paper: part('paper'),
		hud: part('hud'),
		grain: over?.querySelector<HTMLElement>('.grain'),
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
