/**
 * Paints the globe's frames (`globe.ts`) into a 2D canvas: the line work, the shading of the sphere
 * clipped to the gores, the flat tint, the Besançon point.
 *
 * Without the DOM: it takes a context (of a page canvas or an `OffscreenCanvas`), the palette, the
 * pixel ratio, the decoded grain and a way to make its scratch canvases, so that it runs as is in a
 * Worker. A frame that looks like the last one painted is not painted again.
 */
import { trace, type Frame, type Layout, type Palette, type Pen, type Rgb } from './globe';
import { BOIL } from './timing';

/** The 2D context the painter draws with: a page canvas's or an `OffscreenCanvas`'s alike. */
export type Context2D = CanvasCompositing &
	CanvasDrawImage &
	CanvasDrawPath &
	CanvasFillStrokeStyles &
	CanvasPath &
	CanvasPathDrawingStyles &
	CanvasRect &
	CanvasState &
	CanvasTransform & { canvas: { width: number; height: number } };

/**
 * A scratch canvas the painter draws the sphere into: an `OffscreenCanvas`, or a page canvas in a
 * browser that has none (the main-thread path must not depend on it).
 */
export type Surface = CanvasImageSource & {
	width: number;
	height: number;
	getContext(contextId: '2d'): Context2D | null;
};

/** The sphere's light comes from the top left (the mockup's `circle at 36% 30%`). */
const LIGHT = { x: 0.36, y: 0.3 };
/** Radius of a `farthest-corner` gradient from that point, in diameters. */
const LIGHT_REACH = Math.hypot(1 - LIGHT.x, 1 - LIGHT.y);
/**
 * The sphere's shading on the paper drawn for the visit: towards the lit side of its volumes where the
 * light hits, a shade under the paper at the rim. On the day's paper, the mockup's greys.
 */
function shadingOf({ paper, light }: Palette): [number, string][] {
	const toward = (to: Rgb, share: number) => css(paper.map((c, i) => Math.round(c + (to[i] - c) * share)) as Rgb);
	const black: Rgb = [0, 0, 0];
	return [
		[0, toward(light, 0.7)],
		[0.34, toward(black, 0.015)],
		[0.68, toward(black, 0.09)],
		[1, toward(black, 0.17)],
	];
}
/** The grain shows least where the light hits. */
const GRAIN_MASK: [number, string][] = [
	[0, 'rgba(0,0,0,0.1)'],
	[0.42, 'rgba(0,0,0,0.45)'],
	[0.82, 'rgba(0,0,0,1)'],
];

const css = ([red, green, blue]: Rgb) => `rgb(${red},${green},${blue})`;

const MOVE = 0;
const LINE = 1;
const CLOSE = 2;

/** A pen that records a frame's path into an array kept from frame to frame, then replays it. */
class Recorder implements Pen {
	private data = new Float64Array(3 * 1024);
	private length = 0;

	reset() {
		this.length = 0;
	}

	moveTo(x: number, y: number) {
		this.push(MOVE, x, y);
	}

	lineTo(x: number, y: number) {
		this.push(LINE, x, y);
	}

	closePath() {
		this.push(CLOSE, 0, 0);
	}

	/** Makes the recorded path the context's current path. */
	replay(ctx: Context2D) {
		const { data, length } = this;
		ctx.beginPath();
		for (let i = 0; i < length; i += 3) {
			if (data[i] === MOVE) ctx.moveTo(data[i + 1], data[i + 2]);
			else if (data[i] === LINE) ctx.lineTo(data[i + 1], data[i + 2]);
			else ctx.closePath();
		}
	}

	private push(op: number, x: number, y: number) {
		if (this.length + 3 > this.data.length) {
			const grown = new Float64Array(2 * this.data.length);
			grown.set(this.data);
			this.data = grown;
		}
		this.data[this.length++] = op;
		this.data[this.length++] = x;
		this.data[this.length++] = y;
	}
}

/** Everything that tells two frames apart on the canvas, given the same layout and grain. */
function fingerprint(frame: Frame, grain: boolean, into: Float64Array) {
	const { pose, sphere, limb, point } = frame;
	let i = 0;
	into[i++] = pose.lam0;
	into[i++] = pose.phi0;
	into[i++] = pose.goreShare;
	into[i++] = pose.a;
	into[i++] = pose.straightened;
	into[i++] = frame.lines;
	into[i++] = frame.accent;
	into[i++] = frame.parallels;
	into[i++] = frame.fine;
	into[i++] = frame.meridians;
	into[i++] = frame.edges;
	into[i++] = frame.tint;
	into[i++] = frame.rim;
	into[i++] = limb ? limb.drawn : -1;
	into[i++] = sphere ? sphere.opacity : 0;
	// The grain only boils on a sphere that shows.
	into[i++] = sphere && sphere.opacity > 0 && grain ? sphere.boil : -1;
	into[i++] = point.x;
	into[i++] = point.y;
	into[i++] = point.w;
	into[i++] = point.h;
	into[i++] = point.radius;
	into[i++] = point.scale;
	into[i++] = point.opacity;
	for (const ripple of point.ripples) {
		into[i++] = ripple.scale;
		into[i++] = ripple.opacity;
	}
	return i;
}

export function globePainter(ctx: Context2D, palette: Palette, newSurface: () => Surface) {
	const ink = css(palette.ink);
	const accent = css(palette.accent);
	const shading = shadingOf(palette);
	// The sphere (shading and grain) is drawn once per grain step into its own bitmap, then scaled.
	const sphere = newSurface();
	const grain = newSurface();
	let grainPattern: CanvasPattern | null = null;
	const sphereKey = { radius: Number.NaN, ratio: Number.NaN, boil: Number.NaN };
	let ratio = 1;
	const pens = {
		edges: new Recorder(),
		meridians: new Recorder(),
		parallels: new Recorder(),
		fine: new Recorder(),
		gores: new Recorder(),
		rim: new Recorder(),
	};
	const recorders = Object.values(pens);
	let painted = new Float64Array(64);
	let next = new Float64Array(64);
	let paintedLength = 0;
	let stale = true;
	let mixed = Number.NaN;
	let mixedColor = ink;

	function paintSphere(radius: number, boil: number) {
		const step = grainPattern ? boil : -1;
		if (sphereKey.radius === radius && sphereKey.ratio === ratio && sphereKey.boil === step) return;
		sphereKey.radius = radius;
		sphereKey.ratio = ratio;
		sphereKey.boil = step;
		const size = Math.ceil(2 * radius * ratio);
		for (const c of [sphere, grain]) {
			if (c.width !== size) c.width = c.height = size;
		}
		const s = sphere.getContext('2d');
		const g = grain.getContext('2d');
		if (!s || !g) return;
		const light = (stops: [number, string][], target: Context2D) => {
			const gradient = target.createRadialGradient(
				LIGHT.x * size,
				LIGHT.y * size,
				0,
				LIGHT.x * size,
				LIGHT.y * size,
				LIGHT_REACH * size,
			);
			for (const [at, color] of stops) gradient.addColorStop(at, color);
			return gradient;
		};
		s.clearRect(0, 0, size, size);
		s.fillStyle = light(shading, s);
		s.beginPath();
		s.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		s.fill();
		if (!grainPattern) return;
		// The grain boils by jumps, and fades towards the light: the pattern follows the context's
		// offset, so the whole tile is filled from the shifted origin.
		const dx = BOIL.offsets[step][0] * ratio;
		const dy = BOIL.offsets[step][1] * ratio;
		g.globalCompositeOperation = 'source-over';
		g.clearRect(0, 0, size, size);
		g.fillStyle = grainPattern;
		g.setTransform(1, 0, 0, 1, dx, dy);
		g.fillRect(-dx, -dy, size, size);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalCompositeOperation = 'destination-in';
		g.fillStyle = light(GRAIN_MASK, g);
		g.fillRect(0, 0, size, size);
		s.globalCompositeOperation = 'source-atop';
		s.drawImage(grain, 0, 0);
		s.globalCompositeOperation = 'source-over';
	}

	/** Colour of the parallels, meridians and tint, ink to accent. */
	function lineColor(toAccent: number) {
		if (toAccent === mixed) return mixedColor;
		mixed = toAccent;
		const mix = (i: number) => Math.round(palette.ink[i] + (palette.accent[i] - palette.ink[i]) * toAccent);
		mixedColor = `rgb(${mix(0)},${mix(1)},${mix(2)})`;
		return mixedColor;
	}

	/** The style of the next stroke; false when it would not show. */
	function pick(color: string, width: number, opacity: number) {
		if (opacity <= 0.001) return false;
		ctx.globalAlpha = opacity;
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		return true;
	}

	function stroke(path: Recorder, color: string, width: number, opacity: number) {
		if (!pick(color, width, opacity)) return;
		path.replay(ctx);
		ctx.stroke();
	}

	/** Whether `frame` differs on the canvas from the last frame painted. */
	function changed(frame: Frame) {
		const length = fingerprint(frame, grainPattern !== null, next);
		let same = !stale && length === paintedLength;
		for (let i = 0; same && i < length; i++) same = next[i] === painted[i];
		const previous = painted;
		painted = next;
		next = previous;
		paintedLength = length;
		stale = false;
		return !same;
	}

	return {
		/** Matches the canvas bitmap to its box at `pixelRatio`: this clears it. */
		resize(width: number, height: number, pixelRatio: number) {
			ratio = pixelRatio;
			ctx.canvas.width = Math.round(width * ratio);
			ctx.canvas.height = Math.round(height * ratio);
			stale = true;
		},

		/** The sphere's grain, decoded at the pixel ratio (`GRAIN_TILE` × ratio square): until then, its shading alone. */
		grain(noise: ImageBitmap) {
			grainPattern = ctx.createPattern(noise, 'repeat');
			sphereKey.boil = Number.NaN;
			stale = true;
		},

		/** Paints `frame` unless the canvas already shows it; true when it painted. */
		draw(frame: Frame, layout: Layout) {
			if (!changed(frame)) return false;
			for (const pen of recorders) pen.reset();
			trace(frame.pose, pens);
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			ctx.clearRect(0, 0, layout.width, layout.height);
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';

			// The shading belongs to the globe: it shows only through the gores and fades as they
			// unroll, handing over to the flat tint of the printed gores.
			if (frame.sphere) {
				const { x, y, radius, opacity, boil } = frame.sphere;
				paintSphere(frame.pose.R, boil);
				ctx.save();
				if (!frame.whole) {
					pens.gores.replay(ctx);
					ctx.clip();
				}
				ctx.globalAlpha = opacity;
				ctx.drawImage(sphere, x - radius, y - radius, 2 * radius, 2 * radius);
				ctx.restore();
			}

			const lines = frame.lines;
			if (lines > 0) {
				const color = lineColor(frame.accent);
				// One limb while the globe is whole; once it is cut, each gore carries its own stretch of it.
				if (frame.limb && frame.limb.drawn > 0 && pick(ink, 1.1, lines)) {
					ctx.beginPath();
					ctx.arc(frame.limb.x, frame.limb.y, frame.limb.radius, 0, 2 * Math.PI * frame.limb.drawn);
					ctx.stroke();
				}
				stroke(pens.rim, ink, 1.1, lines * frame.rim);
				if (frame.tint > 0.001) {
					ctx.globalAlpha = lines * frame.tint * 0.07;
					ctx.fillStyle = color;
					pens.gores.replay(ctx);
					ctx.fill();
				}
				stroke(pens.parallels, color, 0.7, lines * frame.parallels * 0.5);
				stroke(pens.fine, color, 0.7, lines * frame.fine * 0.3);
				stroke(pens.meridians, color, 0.7, lines * frame.meridians * 0.5);
				stroke(pens.edges, ink, 1.1, lines * frame.edges * 0.8);
			}

			// Besançon, then the map's marker it turns into.
			const { point } = frame;
			if (point.opacity > 0) {
				const cx = point.x + point.w / 2;
				const cy = point.y + point.h / 2;
				if (point.scale > 0) {
					ctx.save();
					ctx.globalAlpha = point.opacity;
					ctx.fillStyle = accent;
					ctx.translate(cx, cy);
					ctx.scale(point.scale, point.scale);
					ctx.beginPath();
					ctx.roundRect(-point.w / 2, -point.h / 2, point.w, point.h, point.radius);
					ctx.fill();
					ctx.restore();
				}
				for (const ripple of point.ripples) {
					// A 14 px ring with a 1 px border inside its box, scaled as a whole.
					if (ripple.opacity <= 0 || !pick(accent, ripple.scale, point.opacity * ripple.opacity)) continue;
					ctx.beginPath();
					ctx.arc(cx, cy, 6.5 * ripple.scale, 0, 2 * Math.PI);
					ctx.stroke();
				}
			}
			ctx.globalAlpha = 1;
			return true;
		},

		/** Releases the bitmaps. */
		dispose() {
			ctx.canvas.width = ctx.canvas.height = 0;
			sphere.width = sphere.height = grain.width = grain.height = 0;
			grainPattern = null;
		},
	};
}
