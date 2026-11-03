/**
 * Geometry of the Intro's globe (mockup 04a · Fuseaux, its `draw(t)` ported as is), without the DOM:
 * given a time and the measured page, it traces the line work into pens and returns everything
 * else the canvas needs to paint the frame.
 *
 * Twelve gores of 30°. The globe's equator is twelve column pitches round, so neighbouring gore
 * centres already lie one pitch apart: narrowing every gore to a column width opens the gutters,
 * and stretching the latitudes × 2 sets the 15° parallels one pitch apart as well.
 */
import { clamp01, cubicBezier, cubicInOut, expoOut, phase, smoothstep } from './ease';
import { CUT, GLOBE_APPEAR, GRID_FADE, POINT, STRAIGHTEN, TURN, UNROLL } from './timing';

const D2R = Math.PI / 180;
/** Besançon. */
export const LON = 6.0241;
export const LAT = 47.2378;
/** Latitudes stretch by this much once the lenses are straight. */
const STRETCH = 2;
/** The parallel that settles on the header rule. */
const TOP_PARALLEL = 60;
/** Where the globe faces before it turns to Besançon. */
const START = { lon: -40, lat: 8 };
const INK = [17, 17, 16];
const ACCENT = [36, 51, 255];
/** The point's size before it grows into the cursor, px. */
const POINT_SIZE = 14;
/** Where the label sits from the point's centre, px: right of it, or under it. */
const LABEL_OFFSET = { x: 20, y: -10, below: 16 };

const limbEase = cubicBezier(0.65, 0, 0.35, 1);
const popEase = cubicBezier(0.34, 1.56, 0.64, 1);

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** The page the globe lands on, measured in the window (px). */
export interface Layout {
	width: number;
	height: number;
	/** The strips land on this many columns of the page grid. */
	columns: number;
	/** Content box of the page grid. */
	gridLeft: number;
	gridWidth: number;
	gutter: number;
	/** Bottom edge of the header: its 1 px rule is the last row above it. */
	headerBottom: number;
	/** The title's block cursor, which the point becomes. */
	cursor: Box;
	/** The header coordinates, where the label lands; `null` when they are hidden (phones). */
	meta: { x: number; y: number } | null;
	/** Width of the Besançon label. */
	labelWidth: number;
}

/** Column counts tried for the strips, in order: on desktop, then below this width. */
const COLUMN_CHOICES = { desktop: [12, 6, 4], narrow: [4, 6, 12] };
export const NARROW_BELOW = 861;
/** The globe's diameter fits in this share of the window's height. */
const GLOBE_HEIGHT = 0.8;
/** A gutter takes at most this share of a pitch: the grid's own (24 px) at 1280 px and above. */
const GUTTER_SHARE = 0.24;
/** The unrolled lenses run from pole to pole: half the equator, π/2 diameters tall. */
const LENS_SPAN = Math.PI / 2;
/** The lenses fit in this share of the window's height. */
const LENS_HEIGHT = 0.85;

/**
 * How many strips the page width holds, and the gutter between them: the first column count whose
 * globe (twelve pitches round) and unrolled lenses fit in the window's height, or the smallest
 * globe when none does (its lenses are then flattened, see `globe`).
 */
export function fitColumns(
	window: { width: number; height: number },
	grid: { width: number; gutter: number },
): { columns: number; gutter: number } {
	const choices = window.width < NARROW_BELOW ? COLUMN_CHOICES.narrow : COLUMN_CHOICES.desktop;
	const fits = (columns: number) => {
		let pitch = (grid.width + grid.gutter) / columns;
		let gutter = grid.gutter;
		// A small pitch keeps the grid's proportion between strip and gutter.
		if (gutter > GUTTER_SHARE * pitch) {
			pitch = grid.width / (columns - GUTTER_SHARE);
			gutter = GUTTER_SHARE * pitch;
		}
		return { columns, gutter, diameter: (12 * pitch) / Math.PI };
	};
	const tried = choices.map(fits);
	const chosen =
		tried.find(
			({ diameter }) =>
				diameter <= GLOBE_HEIGHT * window.height && LENS_SPAN * diameter <= LENS_HEIGHT * window.height,
		) ??
		tried.reduce((small, next) => (next.diameter < small.diameter ? next : small));
	return { columns: chosen.columns, gutter: chosen.gutter };
}

/** The subset of `CanvasPath` the geometry draws with (a `Path2D` fits). */
export interface Pen {
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	closePath(): void;
}

export interface Pens {
	/** Gore boundaries. */
	edges: Pen;
	/** Central meridian of each gore. */
	meridians: Pen;
	/** Parallels every 15°. */
	parallels: Pen;
	/** Parallels every 5°, once the stretch has spaced them out. */
	fine: Pen;
	/** Outline of every gore, closed by arcs of the limb: the tint, and the clip of the shading. */
	gores: Pen;
	/** Those arcs of the limb alone: each cut gore's own rim. */
	rim: Pen;
}

export interface Frame {
	/** Shading of the sphere: a disc to paint clipped to `gores` (to the whole frame when `whole`). */
	sphere: { x: number; y: number; radius: number; opacity: number } | null;
	/** The globe is not cut yet. */
	whole: boolean;
	/** The single limb of the whole globe, drawn round from 3 o'clock up to `drawn` (0 to 1). */
	limb: { x: number; y: number; radius: number; drawn: number } | null;
	/** Opacity of all the line work. */
	lines: number;
	/** Colour of the parallels, meridians and tint: ink, then accent. */
	color: string;
	parallels: number;
	fine: number;
	meridians: number;
	edges: number;
	tint: number;
	rim: number;
	/** The Besançon point: a rounded box scaled by `scale` about its centre, and its ripples. */
	point: {
		x: number;
		y: number;
		w: number;
		h: number;
		radius: number;
		scale: number;
		opacity: number;
		ripples: { scale: number; opacity: number }[];
	};
	/** Top-left corner of the label, and its opacity once it has faded in. */
	label: { x: number; y: number; opacity: number };
	hud: { phase: string; gore: string; lat: string; lon: string; goreWidth: number; gutter: number };
}

type Point = [x: number, y: number, facing: number, lon: number, lat: number];

export function globe(t: number, layout: Layout, pens: Pens): Frame {
	const { width, height, columns, gutter } = layout;
	const pitch = (layout.gridWidth + gutter) / columns;
	const R = (6 * pitch) / Math.PI;
	const narrow = (pitch - gutter) / pitch;
	const cx0 = width / 2;
	const cy0 = height / 2;
	// Where even the smallest globe's lenses would overrun the window (a phone on its side), the
	// latitudes close up as the gores unroll, then stretch from there: 1 everywhere else.
	const flatLatitudes = Math.min(1, (LENS_HEIGHT * height) / (2 * LENS_SPAN * R));
	// Greenwich falls in the middle gutter, which puts Besançon's gore (0°–30° E) right of it.
	const cx1 = layout.gridLeft + layout.gridWidth / 2 + (pitch * LON) / 30;
	// The flat lenses are centred on the equator, whole from tip to tip, before they straighten.
	const cy1 = cy0 - R * flatLatitudes * LAT * D2R;
	const cy2 = layout.headerBottom - 0.5 + R * STRETCH * (TOP_PARALLEL - LAT) * D2R;

	// 1. The globe turns to Besançon.
	const rot = cubicInOut(phase(t, TURN));
	const lam0 = START.lon + (LON - START.lon) * rot;
	const phi0 = START.lat + (LAT - START.lat) * rot;
	// 2. It is cut along the twelve gore boundaries: each gore narrows about its own central meridian.
	const gam = 1 - (1 - narrow) * cubicInOut(phase(t, CUT));
	// 3. The gores unroll as Aplat's map does, glued to a sphere of radius R/a whose angles are × a, but
	//    each keeps its true width along every parallel, so it lands as a sinusoidal lens.
	const fl = cubicInOut(phase(t, UNROLL));
	const a = 1 - fl;
	const closeUp = 1 - (1 - flatLatitudes) * fl;
	// 4. The lenses straighten into strips while the latitudes stretch: both poles leave the frame and
	//    the 60° parallel settles on the header rule.
	const st = cubicInOut(phase(t, STRAIGHTEN));
	const v = flatLatitudes + (STRETCH - flatLatitudes) * st;
	const Cx = cx0 + (cx1 - cx0) * fl;
	const Cy = cy0 + (cy1 - cy0) * fl + (cy2 - cy1) * st;
	const straight = a <= 0.001;
	const k = straight ? 0 : R / a;
	const sC = Math.sin(a * phi0 * D2R);
	const cC = Math.cos(a * phi0 * D2R);

	// Facing > 0 on the near side of the sphere.
	const proj = (lx: number, phi: number): Point => {
		if (straight) return [Cx + R * lx * D2R, Cy - R * v * (phi - LAT) * D2R, 1, lx, phi];
		const L = a * lx * D2R;
		const P = a * phi * D2R;
		const cP = Math.cos(P);
		const sP = Math.sin(P);
		const cL = Math.cos(L);
		return [Cx + k * cP * Math.sin(L), Cy - k * closeUp * (cC * sP - sC * cP * cL), sC * sP + cC * cP * cL, lx, phi];
	};
	// Where a line turns behind the sphere it stops on the limb itself, not at the last sample in front.
	const cross = (p: Point, q: Point) => {
		const u = p[2] / (p[2] - q[2]);
		return proj(p[3] + (q[3] - p[3]) * u, p[4] + (q[4] - p[4]) * u);
	};
	const seg = (pen: Pen, p: Point, q: Point) => {
		pen.moveTo(p[0], p[1]);
		pen.lineTo(q[0], q[1]);
	};
	const line = (pen: Pen, pts: Point[]) => {
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			if (p[2] <= 0) continue;
			const prev = pts[i - 1];
			if (!prev) pen.moveTo(p[0], p[1]);
			else if (prev[2] <= 0) seg(pen, cross(prev, p), p);
			else pen.lineTo(p[0], p[1]);
			const next = pts[i + 1];
			if (next && next[2] <= 0) {
				const out = cross(p, next);
				pen.lineTo(out[0], out[1]);
			}
		}
	};
	// The stretch of limb that closes a gore where it turns behind the sphere; it is also that gore's rim.
	const arc = (p: Point, q: Point) => {
		const a1 = Math.atan2((p[1] - Cy) / closeUp, p[0] - Cx);
		let da = Math.atan2((q[1] - Cy) / closeUp, q[0] - Cx) - a1;
		if (da > Math.PI) da -= 2 * Math.PI;
		else if (da < -Math.PI) da += 2 * Math.PI;
		const n = Math.ceil(Math.abs(da) / 0.07);
		pens.rim.moveTo(p[0], p[1]);
		for (let i = 1; i < n; i++) {
			const an = a1 + (da * i) / n;
			const x = Cx + k * Math.cos(an);
			const y = Cy + k * closeUp * Math.sin(an);
			pens.gores.lineTo(x, y);
			pens.rim.lineTo(x, y);
		}
		pens.rim.lineTo(q[0], q[1]);
	};
	const ring = (pts: Point[]) => {
		const pen = pens.gores;
		const n = pts.length;
		let s = -1;
		let vis = 0;
		for (let i = 0; i < n; i++) {
			if (pts[i][2] <= 0) continue;
			vis++;
			if (s < 0 && pts[(i + n - 1) % n][2] <= 0) s = i;
		}
		if (!vis) return;
		if (vis === n) {
			pen.moveTo(pts[0][0], pts[0][1]);
			for (let i = 1; i < n; i++) pen.lineTo(pts[i][0], pts[i][1]);
			pen.closePath();
			return;
		}
		let first: Point | null = null;
		let out: Point | null = null;
		for (let j = 0; j < n; j++) {
			const i = (s + j) % n;
			const p = pts[i];
			if (p[2] <= 0) continue;
			const prev = pts[(i + n - 1) % n];
			if (prev[2] <= 0) {
				const e = cross(prev, p);
				if (out) {
					arc(out, e);
					pen.lineTo(e[0], e[1]);
				} else {
					first = e;
					pen.moveTo(e[0], e[1]);
				}
			}
			pen.lineTo(p[0], p[1]);
			const next = pts[(i + 1) % n];
			if (next[2] <= 0) {
				out = cross(p, next);
				pen.lineTo(out[0], out[1]);
			}
		}
		if (out && first) arc(out, first);
		pen.closePath();
	};

	// Once flat, only the latitudes that can reach the frame are sampled.
	let lo = -90;
	let hi = 90;
	if (straight) {
		const s = R * v * D2R;
		lo = Math.max(-90, LAT - (height + 20 - Cy) / s);
		hi = Math.min(90, LAT + (Cy + 20) / s);
	}
	// Half-width of a gore along a parallel, in degrees of longitude on the current sphere: its true
	// width while it unrolls (a sinusoidal lens once flat), the full 30° once straightened.
	const half = (phi: number) => {
		if (a > 0.9999) return 15 * gam;
		return (15 * gam * ((1 - st) * Math.cos(phi * D2R) + st)) / Math.cos(a * phi * D2R);
	};
	const shade = 1 - smoothstep(0, 0.35, fl);
	const rimOpacity = 1 - smoothstep(0, 0.2, fl);
	const tint = smoothstep(0.15, 0.6, fl);
	const whole = gam >= 0.9999;
	const needRing = (!whole && shade > 0.001) || tint > 0.001;
	// The 5° parallels come in once the stretch has spaced them out.
	const fine = straight ? smoothstep(22, 32, R * v * 5 * D2R) : 0;

	const ne = straight && st >= 1 ? 1 : 40;
	const nm = straight ? 1 : 40;
	const np = straight ? 1 : 6;
	const ePhi: number[] = [];
	const eHalf: number[] = [];
	for (let j = 0; j <= ne; j++) {
		const ph = lo + ((hi - lo) * j) / ne;
		ePhi.push(ph);
		eHalf.push(half(ph));
	}
	const major: [number, number][] = [];
	const minor: [number, number][] = [];
	for (let q = -85; q <= 85; q += 5) {
		if (q < lo || q > hi) continue;
		if (q % 15 === 0) major.push([q, half(q)]);
		else if (fine > 0.01) minor.push([q, half(q)]);
	}

	for (let g = 0; g < 12; g++) {
		let l0 = -165 + 30 * g - lam0;
		if (l0 > 180) l0 -= 360;
		else if (l0 <= -180) l0 += 360;
		const lp: Point[] = [];
		const rp: Point[] = [];
		for (let j = 0; j <= ne; j++) {
			lp.push(proj(l0 - eHalf[j], ePhi[j]));
			rp.push(proj(l0 + eHalf[j], ePhi[j]));
		}
		line(pens.edges, lp);
		line(pens.edges, rp);
		// A straightening lens has its tips cut square until they leave the frame.
		if (straight && st > 0) {
			if (hi >= 90) seg(pens.edges, lp[ne], rp[ne]);
			if (lo <= -90) seg(pens.edges, lp[0], rp[0]);
		}
		const mp: Point[] = [];
		for (let j = 0; j <= nm; j++) mp.push(proj(l0, lo + ((hi - lo) * j) / nm));
		line(pens.meridians, mp);
		for (const [ph, hw] of major) {
			const pp: Point[] = [];
			for (let j = 0; j <= np; j++) pp.push(proj(l0 - hw + (2 * hw * j) / np, ph));
			line(pens.parallels, pp);
		}
		for (const [ph, hw] of minor) seg(pens.fine, proj(l0 - hw, ph), proj(l0 + hw, ph));
		if (needRing) ring(lp.concat(rp.slice().reverse()));
	}

	// Ink to accent as the strips straighten: the gores become the layout grid.
	const blue = smoothstep(0.4, 1, st);
	const mix = (i: number) => Math.round(INK[i] + (ACCENT[i] - INK[i]) * blue);

	// The grid fades out over the page: parallels first, then the strips.
	const parallelsFade = 1 - phase(t, { start: GRID_FADE.start, duration: GRID_FADE.parallels });
	const meridiansFade =
		1 -
		phase(t, {
			start: GRID_FADE.start + GRID_FADE.meridiansDelay,
			duration: GRID_FADE.duration - GRID_FADE.meridiansDelay,
		});

	// Besançon rides on its gore, then becomes the block cursor.
	let bl = 15 - lam0;
	if (bl > 180) bl -= 360;
	const here = proj(bl + ((LON - 15) * half(LAT)) / 15, LAT);
	const city = here[2] > 0 ? here : [Cx, Cy];
	const { cursor, meta } = layout;
	const mv = cubicInOut(phase(t, POINT.move));
	const gr = expoOut(phase(t, POINT.grow));
	const dcx = city[0] + (cursor.x + cursor.w / 2 - city[0]) * mv;
	const dcy = city[1] + (cursor.y + cursor.h / 2 - city[1]) * mv;
	const pw = POINT_SIZE + (cursor.w - POINT_SIZE) * gr;
	const ph = POINT_SIZE + (cursor.h - POINT_SIZE) * gr;
	const handOver = 1 - phase(t, POINT.handOver);
	// The label reads right of the point; where the grid ends too soon for it, under the point.
	const room = layout.gridLeft + layout.gridWidth - layout.labelWidth;
	const aside =
		city[0] + LABEL_OFFSET.x <= room
			? [city[0] + LABEL_OFFSET.x, city[1] + LABEL_OFFSET.y]
			: [Math.max(layout.gridLeft, room), city[1] + LABEL_OFFSET.below];

	let phaseName = 'projection orthographique · EPSG:4326';
	if (t >= STRAIGHTEN.start) phaseName = 'redressement · 1 fuseau = 1 colonne';
	else if (t >= UNROLL.start) phaseName = 'développement · fuseaux sinusoïdaux';
	else if (t >= CUT.start) phaseName = 'découpe · 12 fuseaux de 30°';
	// The gore under the centre of the projection, counted from 180° W.
	const gi = Math.max(0, Math.min(11, Math.floor((lam0 + 180) / 30)));
	// A gore's width at the equator: one column pitch on the globe, one column once the gutters are open.
	const goreWidth = pitch * gam;

	return {
		sphere:
			shade > 0.001
				? {
						x: Cx,
						y: Cy,
						radius: R / Math.max(a, 0.001),
						opacity: shade * phase(t, GLOBE_APPEAR.sphere),
					}
				: null,
		whole,
		limb: whole ? { x: Cx, y: Cy, radius: R, drawn: limbEase(phase(t, GLOBE_APPEAR.limb)) } : null,
		lines: phase(t, GLOBE_APPEAR.lines),
		color: `rgb(${mix(0)},${mix(1)},${mix(2)})`,
		parallels: parallelsFade,
		fine: parallelsFade * fine,
		// The central meridians step back: the strip edges are the columns, the parallels the rhythm.
		meridians: meridiansFade * (1 - 0.6 * st),
		edges: meridiansFade,
		tint: parallelsFade * tint,
		rim: whole ? 0 : rimOpacity,
		point: {
			x: dcx - pw / 2,
			y: dcy - ph / 2,
			w: pw,
			h: ph,
			radius: (POINT_SIZE / 2) * (1 - gr),
			scale: t < POINT.appear.start ? 0 : popEase(phase(t, POINT.appear)),
			opacity: handOver,
			ripples: POINT.ripples.map((keys) => ripple(t, keys)),
		},
		label: meta
			? {
					x: aside[0] + (meta.x - aside[0]) * mv,
					y: aside[1] + (meta.y - aside[1]) * mv,
					opacity: handOver,
				}
			: // Nowhere to land: it fades where it stands as the point leaves.
				{
					x: aside[0],
					y: aside[1],
					opacity: 1 - phase(t, { start: POINT.move.start, duration: POINT.handOver.duration }),
				},
		hud: {
			phase: phaseName,
			gore: `${String(gi + 1).padStart(2, '0')} / 12`,
			lat: coordinate(phi0, 'N', 'S'),
			lon: coordinate(lam0, 'E', 'O'),
			goreWidth,
			gutter: pitch - goreWidth,
		},
	};
}

/** Linear between `[time, opacity, scale]` keyframes, held before the first and after the last. */
function ripple(t: number, keys: [number, number, number][]) {
	let i = 0;
	while (i < keys.length && keys[i][0] <= t) i++;
	if (i === 0) return { opacity: keys[0][1], scale: keys[0][2] };
	if (i === keys.length) return { opacity: keys[i - 1][1], scale: keys[i - 1][2] };
	const [t0, o0, s0] = keys[i - 1];
	const [t1, o1, s1] = keys[i];
	const u = clamp01((t - t0) / (t1 - t0));
	return { opacity: o0 + (o1 - o0) * u, scale: s0 + (s1 - s0) * u };
}

/** Four decimals, hemisphere letter. */
function coordinate(value: number, positive: string, negative: string) {
	return `${decimal(Math.abs(value), 4)}° ${value < 0 ? negative : positive}`;
}

/** French decimal comma, one decimal unless told otherwise. */
export const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
