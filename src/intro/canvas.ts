/**
 * Paints the globe's frames (`globe.ts`) into a 2D canvas at the device pixel ratio: the line
 * work, the shading of the sphere clipped to the gores, the flat tint, the Besançon point.
 */
import { BOIL } from './timing';
import { GRAIN_TILE, SPHERE_GRAIN } from './grain';
import { globe, type Frame, type Layout } from './globe';

const INK = '#111110';
const ACCENT = '#2433ff';
/** The sphere's light comes from the top left (the mockup's `circle at 36% 30%`). */
const LIGHT = { x: 0.36, y: 0.3 };
/** Radius of a `farthest-corner` gradient from that point, in diameters. */
const LIGHT_REACH = Math.hypot(1 - LIGHT.x, 1 - LIGHT.y);
const SHADING: [number, string][] = [
	[0, '#fbfbf8'],
	[0.34, '#ecebe5'],
	[0.68, '#d9d8d1'],
	[1, '#c6c5bd'],
];
/** The grain shows least where the light hits. */
const GRAIN_MASK: [number, number][] = [
	[0, 0.1],
	[0.42, 0.45],
	[0.82, 1],
];

export function globeCanvas(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext('2d');
	// The sphere (shading and grain) is drawn once per grain step into its own bitmap, then scaled.
	const sphere = document.createElement('canvas');
	const grain = document.createElement('canvas');
	let grainPattern: CanvasPattern | null = null;
	let sphereKey = '';
	let ratio = 1;

	// Until the grain has loaded (or if it never does), the sphere has its shading alone.
	const noise = new Image();
	noise.onload = () => {
		// Rasterised at the device's resolution, then scaled back in the pattern: crisp specks.
		const tile = document.createElement('canvas');
		tile.width = tile.height = Math.round(GRAIN_TILE * ratio);
		tile.getContext('2d')?.drawImage(noise, 0, 0, tile.width, tile.height);
		grainPattern = ctx?.createPattern(tile, 'repeat') ?? null;
		sphereKey = '';
	};
	noise.src = SPHERE_GRAIN;

	function paintSphere(radius: number, step: number) {
		const key = `${radius}/${ratio}/${grainPattern ? step : -1}`;
		if (key === sphereKey) return;
		sphereKey = key;
		const size = Math.ceil(2 * radius * ratio);
		for (const c of [sphere, grain]) {
			if (c.width !== size) c.width = c.height = size;
		}
		const s = sphere.getContext('2d');
		const g = grain.getContext('2d');
		if (!s || !g) return;
		const light = (stops: [number, string][], target: CanvasRenderingContext2D) => {
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
		s.fillStyle = light(SHADING, s);
		s.beginPath();
		s.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		s.fill();
		if (!grainPattern) return;
		// The grain boils by jumps, and fades towards the light.
		const [dx, dy] = BOIL.offsets[step];
		grainPattern.setTransform(new DOMMatrix([1, 0, 0, 1, dx * ratio, dy * ratio]));
		g.globalCompositeOperation = 'source-over';
		g.clearRect(0, 0, size, size);
		g.fillStyle = grainPattern;
		g.fillRect(0, 0, size, size);
		g.globalCompositeOperation = 'destination-in';
		g.fillStyle = light(
			GRAIN_MASK.map(([at, alpha]) => [at, `rgba(0,0,0,${alpha})`]),
			g,
		);
		g.fillRect(0, 0, size, size);
		s.globalCompositeOperation = 'source-atop';
		s.drawImage(grain, 0, 0);
		s.globalCompositeOperation = 'source-over';
	}

	return {
		/** Matches the canvas bitmap to its box and the device pixel ratio. */
		resize(width: number, height: number, devicePixelRatio: number) {
			ratio = devicePixelRatio;
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			sphereKey = '';
		},

		/** Paints the frame at `t` (s) and returns it, for the DOM parts (HUD, label). */
		draw(t: number, layout: Layout): Frame {
			const pens = {
				edges: new Path2D(),
				meridians: new Path2D(),
				parallels: new Path2D(),
				fine: new Path2D(),
				gores: new Path2D(),
				rim: new Path2D(),
			};
			const frame = globe(t, layout, pens);
			if (!ctx) return frame;
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			ctx.clearRect(0, 0, layout.width, layout.height);
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';

			// The shading belongs to the globe: it shows only through the gores and fades as they
			// unroll, handing over to the flat tint of the printed gores.
			if (frame.sphere) {
				const { x, y, radius, opacity } = frame.sphere;
				const base = (layout.gridWidth + layout.gutter) / layout.columns;
				paintSphere((6 * base) / Math.PI, Math.floor(t / BOIL.step) % BOIL.offsets.length);
				ctx.save();
				if (!frame.whole) ctx.clip(pens.gores);
				ctx.globalAlpha = opacity;
				ctx.drawImage(sphere, x - radius, y - radius, 2 * radius, 2 * radius);
				ctx.restore();
			}

			const stroke = (path: Path2D, color: string, width: number, opacity: number) => {
				if (opacity <= 0.001) return;
				ctx.globalAlpha = opacity;
				ctx.strokeStyle = color;
				ctx.lineWidth = width;
				ctx.stroke(path);
			};
			const lines = frame.lines;
			if (lines > 0) {
				// One limb while the globe is whole; once it is cut, each gore carries its own stretch of it.
				if (frame.limb && frame.limb.drawn > 0) {
					const limb = new Path2D();
					limb.arc(frame.limb.x, frame.limb.y, frame.limb.radius, 0, 2 * Math.PI * frame.limb.drawn);
					stroke(limb, INK, 1.1, lines);
				}
				stroke(pens.rim, INK, 1.1, lines * frame.rim);
				if (frame.tint > 0.001) {
					ctx.globalAlpha = lines * frame.tint * 0.07;
					ctx.fillStyle = frame.color;
					ctx.fill(pens.gores);
				}
				stroke(pens.parallels, frame.color, 0.7, lines * frame.parallels * 0.5);
				stroke(pens.fine, frame.color, 0.7, lines * frame.fine * 0.3);
				stroke(pens.meridians, frame.color, 0.7, lines * frame.meridians * 0.5);
				stroke(pens.edges, INK, 1.1, lines * frame.edges * 0.8);
			}

			// Besançon, then the block cursor it grows into.
			const { point } = frame;
			if (point.opacity > 0) {
				const cx = point.x + point.w / 2;
				const cy = point.y + point.h / 2;
				if (point.scale > 0) {
					ctx.save();
					ctx.globalAlpha = point.opacity;
					ctx.fillStyle = ACCENT;
					ctx.translate(cx, cy);
					ctx.scale(point.scale, point.scale);
					ctx.beginPath();
					ctx.roundRect(-point.w / 2, -point.h / 2, point.w, point.h, point.radius);
					ctx.fill();
					ctx.restore();
				}
				for (const ripple of point.ripples) {
					if (ripple.opacity <= 0) continue;
					// A 14 px ring with a 1 px border inside its box, scaled as a whole.
					const ring = new Path2D();
					ring.arc(cx, cy, 6.5 * ripple.scale, 0, 2 * Math.PI);
					stroke(ring, ACCENT, ripple.scale, point.opacity * ripple.opacity);
				}
			}
			ctx.globalAlpha = 1;
			return frame;
		},
	};
}
