/**
 * The Intro's globe, drawn off the main thread (ADR 0005): the page transfers its canvas here and
 * sends the timeline's time on each GSAP tick; this Worker paints at its own frame rate, so a busy
 * main thread neither makes the globe stutter nor waits for it. It sends nothing back: an error is
 * its only message, and the page then draws the globe itself.
 */
import { globePainter } from './canvas';
import { frameAt, type Layout, type Palette } from './globe';
import { END } from './timing';

/** What the page tells the Worker. */
export type GlobeMessage =
	| { type: 'init'; canvas: OffscreenCanvas; palette: Palette; layout: Layout; ratio: number }
	/** On every resize, and once the fonts are in. */
	| { type: 'layout'; layout: Layout; ratio: number }
	/** The sphere's grain, once decoded. */
	| { type: 'grain'; noise: ImageBitmap }
	/** The timeline's time (s), and whether it runs on from there (false: skipped, tab hidden). */
	| { type: 'time'; t: number; running: boolean };

/**
 * How far ahead of the last time received the globe may run while the main thread is busy (s). The
 * timeline catches up with real time on its next tick (below GSAP's lag threshold, 500 ms), so the
 * globe stays in step with the page's tweens. Twice the longest task the fluidity budget allows
 * (50 ms): past that, the main thread is not busy but stalled, and the globe waits for it rather
 * than run on alone.
 */
const MAX_LEAD = 0.1;

let painter: ReturnType<typeof globePainter> | undefined;
let layout: Layout;
let base = 0;
let receivedAt = 0;
let running = false;
// The timeline never runs backwards: neither does the globe, even when it has run ahead.
let shown = 0;
let scheduled = false;

addEventListener('message', ({ data }: MessageEvent<GlobeMessage>) => {
	switch (data.type) {
		case 'init': {
			// Without these, the page draws the globe itself: thrown, the error reaches it.
			if (typeof requestAnimationFrame !== 'function') throw new Error('no requestAnimationFrame in this Worker');
			const context = data.canvas.getContext('2d');
			if (!context) throw new Error('no 2D context on the transferred canvas');
			painter = globePainter(context, data.palette, () => new OffscreenCanvas(1, 1));
			layout = data.layout;
			painter.resize(layout.width, layout.height, data.ratio);
			break;
		}
		case 'layout':
			layout = data.layout;
			painter?.resize(layout.width, layout.height, data.ratio);
			break;
		case 'grain':
			painter?.grain(data.noise);
			break;
		case 'time':
			base = data.t;
			running = data.running;
			receivedAt = performance.now();
			break;
	}
	schedule();
});

function schedule() {
	if (scheduled || !painter) return;
	scheduled = true;
	requestAnimationFrame(frame);
}

function frame() {
	scheduled = false;
	const lead = running ? Math.min((performance.now() - receivedAt) / 1000, MAX_LEAD) : 0;
	shown = Math.max(shown, Math.min(base + lead, END));
	painter?.draw(frameAt(shown, layout), layout);
	if (running && shown < END) schedule();
}
