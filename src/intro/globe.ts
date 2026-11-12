/**
 * Geometry of the Intro's globe (mockup 04a · Fuseaux, its `draw(t)` ported as is), without the DOM:
 * given a time and the measured page, `frameAt` places the globe and everything the page shows of it
 * (cheap: the DOM parts need it on every frame), then `trace` draws its line work into pens.
 *
 * Twelve gores of 30°. The globe's equator is twelve column pitches round, so neighbouring gore
 * centres already lie one pitch apart: narrowing every gore to a column width opens the gutters,
 * and stretching the latitudes × 2 sets the 15° parallels one pitch apart as well.
 *
 * The tracing runs on every frame with thousands of points: they live in typed arrays allocated once,
 * so that a frame leaves nothing for the garbage collector.
 */
import { clamp01, cubicBezier, cubicInOut, expoOut, phase, smoothstep } from './ease';
import { boilStep } from './grain';
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
/** The point's size before it takes the marker's, px. */
const POINT_SIZE = 14;
/** Where the label sits from the point's centre, px: right of it, or under it. */
const LABEL_OFFSET = { x: 20, y: -10, below: 16 };

const limbEase = cubicBezier(0.65, 0, 0.35, 1);
const popEase = cubicBezier(0.34, 1.56, 0.64, 1);

export type Rgb = [red: number, green: number, blue: number];

/**
 * The paper's colours, read once from its CSS: the line work turns from ink to accent, the sphere is
 * shaded from the lit side of the paper's volumes to a shade under the paper.
 */
export interface Palette {
	ink: Rgb;
	accent: Rgb;
	paper: Rgb;
	light: Rgb;
}

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
	/** The Besançon marker of the hero's map, which the point becomes. */
	marker: Box;
	/** The marker's label on the map, where the label lands. */
	place: { x: number; y: number };
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
 * globe when none does (its lenses are then flattened, see `frameAt`).
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

/** The subset of `CanvasPath` the geometry draws with. */
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

/** How the globe stands at a time, in the window: what its line work is traced from. */
export interface Pose {
	/** Radius of the whole globe, px. */
	R: number;
	/**
	 * The gores unroll as Aplat's map does, glued to a sphere of radius R/a whose angles are × a: 1 while
	 * the globe is round, 0 once flat.
	 */
	a: number;
	/** The flat lenses land straight, without the sphere: projected as a plate carrée. */
	straight: boolean;
	sphereRadius: number;
	/** Vertical squeeze of the latitudes while they close up (a phone on its side), 1 elsewhere. */
	closeUp: number;
	latitudeStretch: number;
	/** Centre of the projection in the window. */
	Cx: number;
	Cy: number;
	sinTilt: number;
	cosTilt: number;
	/** Centre of the projection on the globe, degrees. */
	lam0: number;
	phi0: number;
	/** Share of its 30° each gore keeps: 1 whole, a column's width once cut. */
	goreShare: number;
	straightened: number;
	/** The latitudes sampled: once flat, only those that can reach the frame. */
	lo: number;
	hi: number;
	/** Gore outlines are traced (the tint, the clip of the shading). */
	rings: boolean;
	/** Opacity of the 5° parallels. */
	fine: number;
}

export interface Frame {
	pose: Pose;
	/** Shading of the sphere: a disc to paint clipped to `gores` (to the whole frame when `whole`). */
	sphere: { x: number; y: number; radius: number; opacity: number; boil: number } | null;
	/** The globe is not cut yet. */
	whole: boolean;
	/** The single limb of the whole globe, drawn round from 3 o'clock up to `drawn` (0 to 1). */
	limb: { x: number; y: number; radius: number; drawn: number } | null;
	/** Opacity of all the line work. */
	lines: number;
	/** The parallels, meridians and tint turn from ink (0) to accent (1). */
	accent: number;
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
	/** The HUD's readouts, as numbers: the page formats them at its own pace. */
	hud: { phase: string; gore: number; lat: number; lon: number; goreWidth: number; gutter: number };
}

/** Points of the globe projected in the window, in columns allocated once; `facing` > 0 on the near side. */
class Points {
	readonly x: Float64Array;
	readonly y: Float64Array;
	readonly facing: Float64Array;
	readonly lon: Float64Array;
	readonly lat: Float64Array;
	constructor(size: number) {
		this.x = new Float64Array(size);
		this.y = new Float64Array(size);
		this.facing = new Float64Array(size);
		this.lon = new Float64Array(size);
		this.lat = new Float64Array(size);
	}
}

/** Samples along a gore edge or a central meridian while curved, and along a parallel. */
const SAMPLES = 40;
const PARALLEL_SAMPLES = 6;
/** The parallels every 5° from 85° S to 85° N. */
const PARALLELS = 35;
/** A gore's outline: its left edge going north, then its right edge going south. */
const outline = new Points(2 * (SAMPLES + 1));
const meridian = new Points(SAMPLES + 1);
const parallel = new Points(PARALLEL_SAMPLES + 1);
/** Where lines meet the limb: a line's way in and out, and a ring's first way in. */
const crossings = new Points(3);
const ENTRY = 0;
const EXIT = 1;
const FIRST = 2;
const city = new Points(1);
const edgeLat = new Float64Array(SAMPLES + 1);
const edgeHalf = new Float64Array(SAMPLES + 1);
const majorLat = new Float64Array(PARALLELS);
const majorHalf = new Float64Array(PARALLELS);
const minorLat = new Float64Array(PARALLELS);
const minorHalf = new Float64Array(PARALLELS);

const PHASES = {
	projection: 'projection orthographique · EPSG:4326',
	cut: 'découpe · 12 fuseaux de 30°',
	unroll: 'développement · fuseaux sinusoïdaux',
	straighten: 'redressement · 1 fuseau = 1 colonne',
};

/** Where the globe and the Besançon point stand at `t` (s) on the measured page. */
export function frameAt(t: number, layout: Layout): Frame {
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
	const goreShare = 1 - (1 - narrow) * cubicInOut(phase(t, CUT));
	// 3. The gores unroll as Aplat's map does, glued to a sphere of radius R/a whose angles are × a, but
	//    each keeps its true width along every parallel, so it lands as a sinusoidal lens.
	const unrolled = cubicInOut(phase(t, UNROLL));
	const a = 1 - unrolled;
	const closeUp = 1 - (1 - flatLatitudes) * unrolled;
	// 4. The lenses straighten into strips while the latitudes stretch: both poles leave the frame and
	//    the 60° parallel settles on the header rule.
	const straightened = cubicInOut(phase(t, STRAIGHTEN));
	const latitudeStretch = flatLatitudes + (STRETCH - flatLatitudes) * straightened;
	const Cx = cx0 + (cx1 - cx0) * unrolled;
	const Cy = cy0 + (cy1 - cy0) * unrolled + (cy2 - cy1) * straightened;
	const straight = a <= 0.001;

	// Once flat, only the latitudes that can reach the frame are sampled.
	let lo = -90;
	let hi = 90;
	if (straight) {
		const s = R * latitudeStretch * D2R;
		lo = Math.max(-90, LAT - (height + 20 - Cy) / s);
		hi = Math.min(90, LAT + (Cy + 20) / s);
	}
	const shade = 1 - smoothstep(0, 0.35, unrolled);
	const rimOpacity = 1 - smoothstep(0, 0.2, unrolled);
	const tint = smoothstep(0.15, 0.6, unrolled);
	const whole = goreShare >= 0.9999;
	const pose: Pose = {
		R,
		a,
		straight,
		sphereRadius: straight ? 0 : R / a,
		closeUp,
		latitudeStretch,
		Cx,
		Cy,
		sinTilt: Math.sin(a * phi0 * D2R),
		cosTilt: Math.cos(a * phi0 * D2R),
		lam0,
		phi0,
		goreShare,
		straightened,
		lo,
		hi,
		rings: (!whole && shade > 0.001) || tint > 0.001,
		// The 5° parallels come in once the stretch has spaced them out.
		fine: straight ? smoothstep(22, 32, R * latitudeStretch * 5 * D2R) : 0,
	};

	// The grid fades out over the page: parallels first, then the strips.
	const parallelsFade = 1 - phase(t, { start: GRID_FADE.start, duration: GRID_FADE.parallels });
	const meridiansFade =
		1 -
		phase(t, {
			start: GRID_FADE.start + GRID_FADE.meridiansDelay,
			duration: GRID_FADE.duration - GRID_FADE.meridiansDelay,
		});

	// Besançon rides on its gore, then lands on the hero's map as its marker.
	// The centre of Besançon's gore (0°–30° E), seen from the centre of the projection.
	let cityGore = 15 - lam0;
	if (cityGore > 180) cityGore -= 360;
	project(pose, cityGore + ((LON - 15) * half(pose, LAT)) / 15, LAT, city, 0);
	const facing = city.facing[0] > 0;
	const cityX = facing ? city.x[0] : Cx;
	const cityY = facing ? city.y[0] : Cy;
	const { marker, place } = layout;
	const moved = cubicInOut(phase(t, POINT.move));
	const grown = expoOut(phase(t, POINT.grow));
	const pointX = cityX + (marker.x + marker.w / 2 - cityX) * moved;
	const pointY = cityY + (marker.y + marker.h / 2 - cityY) * moved;
	const pointW = POINT_SIZE + (marker.w - POINT_SIZE) * grown;
	const pointH = POINT_SIZE + (marker.h - POINT_SIZE) * grown;
	const handOver = 1 - phase(t, POINT.handOver);
	// The label reads right of the point; where the grid ends too soon for it, under the point.
	const room = layout.gridLeft + layout.gridWidth - layout.labelWidth;
	const besideX = cityX + LABEL_OFFSET.x <= room;
	const asideX = besideX ? cityX + LABEL_OFFSET.x : Math.max(layout.gridLeft, room);
	const asideY = besideX ? cityY + LABEL_OFFSET.y : cityY + LABEL_OFFSET.below;

	let phaseName = PHASES.projection;
	if (t >= STRAIGHTEN.start) phaseName = PHASES.straighten;
	else if (t >= UNROLL.start) phaseName = PHASES.unroll;
	else if (t >= CUT.start) phaseName = PHASES.cut;
	// A gore's width at the equator: one column pitch on the globe, one column once the gutters are open.
	const goreWidth = pitch * goreShare;

	return {
		pose,
		sphere:
			shade > 0.001
				? {
						x: Cx,
						y: Cy,
						radius: R / Math.max(a, 0.001),
						opacity: shade * phase(t, GLOBE_APPEAR.sphere),
						// Which jump of its grain shows.
						boil: boilStep(t),
					}
				: null,
		whole,
		limb: whole ? { x: Cx, y: Cy, radius: R, drawn: limbEase(phase(t, GLOBE_APPEAR.limb)) } : null,
		lines: phase(t, GLOBE_APPEAR.lines),
		// Ink to accent as the strips straighten: the gores become the layout grid.
		accent: smoothstep(0.4, 1, straightened),
		parallels: parallelsFade,
		fine: parallelsFade * pose.fine,
		// The central meridians step back: the strip edges are the columns, the parallels the rhythm.
		meridians: meridiansFade * (1 - 0.6 * straightened),
		edges: meridiansFade,
		tint: parallelsFade * tint,
		rim: whole ? 0 : rimOpacity,
		point: {
			x: pointX - pointW / 2,
			y: pointY - pointH / 2,
			w: pointW,
			h: pointH,
			radius: (POINT_SIZE / 2) * (1 - grown),
			scale: t < POINT.appear.start ? 0 : popEase(phase(t, POINT.appear)),
			opacity: handOver,
			ripples: POINT.ripples.map((keys) => ripple(t, keys)),
		},
		label: {
			x: asideX + (place.x - asideX) * moved,
			y: asideY + (place.y - asideY) * moved,
			opacity: handOver,
		},
		hud: {
			phase: phaseName,
			// The gore under the centre of the projection, counted from 180° W.
			gore: Math.max(0, Math.min(11, Math.floor((lam0 + 180) / 30))),
			lat: phi0,
			lon: lam0,
			goreWidth,
			gutter: pitch - goreWidth,
		},
	};
}

/** Traces the globe's line work at `pose` into `pens`. */
export function trace(pose: Pose, pens: Pens) {
	const { lo, hi } = pose;
	// Samples along a gore edge, a central meridian and a parallel: one segment once they are straight.
	const edgeSamples = pose.straight && pose.straightened >= 1 ? 1 : SAMPLES;
	const meridianSamples = pose.straight ? 1 : SAMPLES;
	const parallelSamples = pose.straight ? 1 : PARALLEL_SAMPLES;
	for (let j = 0; j <= edgeSamples; j++) {
		const lat = lo + ((hi - lo) * j) / edgeSamples;
		edgeLat[j] = lat;
		edgeHalf[j] = half(pose, lat);
	}
	let majors = 0;
	let minors = 0;
	for (let q = -85; q <= 85; q += 5) {
		if (q < lo || q > hi) continue;
		if (q % 15 === 0) {
			majorLat[majors] = q;
			majorHalf[majors++] = half(pose, q);
		} else if (pose.fine > 0.01) {
			minorLat[minors] = q;
			minorHalf[minors++] = half(pose, q);
		}
	}

	// The left edge from index 0 up, the right edge from the last index down: walked in a row, the outline.
	const count = edgeSamples + 1;
	const last = 2 * count - 1;
	for (let g = 0; g < 12; g++) {
		let l0 = -165 + 30 * g - pose.lam0;
		if (l0 > 180) l0 -= 360;
		else if (l0 <= -180) l0 += 360;
		for (let j = 0; j <= edgeSamples; j++) {
			project(pose, l0 - edgeHalf[j], edgeLat[j], outline, j);
			project(pose, l0 + edgeHalf[j], edgeLat[j], outline, last - j);
		}
		line(pose, pens.edges, outline, 0, count, 1);
		line(pose, pens.edges, outline, last, count, -1);
		// A straightening lens has its tips cut square until they leave the frame.
		if (pose.straight && pose.straightened > 0) {
			if (hi >= 90) seg(pens.edges, outline, edgeSamples, outline, count);
			if (lo <= -90) seg(pens.edges, outline, 0, outline, last);
		}
		for (let j = 0; j <= meridianSamples; j++) {
			project(pose, l0, lo + ((hi - lo) * j) / meridianSamples, meridian, j);
		}
		line(pose, pens.meridians, meridian, 0, meridianSamples + 1, 1);
		for (let k = 0; k < majors; k++) {
			const lat = majorLat[k];
			const hw = majorHalf[k];
			for (let j = 0; j <= parallelSamples; j++) {
				project(pose, l0 - hw + (2 * hw * j) / parallelSamples, lat, parallel, j);
			}
			line(pose, pens.parallels, parallel, 0, parallelSamples + 1, 1);
		}
		for (let k = 0; k < minors; k++) {
			project(pose, l0 - minorHalf[k], minorLat[k], parallel, 0);
			project(pose, l0 + minorHalf[k], minorLat[k], parallel, 1);
			seg(pens.fine, parallel, 0, parallel, 1);
		}
		if (pose.rings) ring(pose, pens, outline, 2 * count);
	}
}

/** Projects (`lon`, `lat`) into point `i` of `to`. */
function project(pose: Pose, lon: number, lat: number, to: Points, i: number) {
	to.lon[i] = lon;
	to.lat[i] = lat;
	if (pose.straight) {
		to.x[i] = pose.Cx + pose.R * lon * D2R;
		to.y[i] = pose.Cy - pose.R * pose.latitudeStretch * (lat - LAT) * D2R;
		to.facing[i] = 1;
		return;
	}
	const L = pose.a * lon * D2R;
	const P = pose.a * lat * D2R;
	const cP = Math.cos(P);
	const sP = Math.sin(P);
	const cL = Math.cos(L);
	to.x[i] = pose.Cx + pose.sphereRadius * cP * Math.sin(L);
	to.y[i] = pose.Cy - pose.sphereRadius * pose.closeUp * (pose.cosTilt * sP - pose.sinTilt * cP * cL);
	to.facing[i] = pose.sinTilt * sP + pose.cosTilt * cP * cL;
}

/**
 * Half-width of a gore along a parallel, in degrees of longitude on the current sphere: its true width
 * while it unrolls (a sinusoidal lens once flat), the full 30° once straightened.
 */
function half({ a, goreShare, straightened }: Pose, lat: number) {
	if (a > 0.9999) return 15 * goreShare;
	return (15 * goreShare * ((1 - straightened) * Math.cos(lat * D2R) + straightened)) / Math.cos(a * lat * D2R);
}

/**
 * Where a line from point `i` of `from` to point `j` of `to` turns behind the sphere, into `slot` of
 * `crossings`: it stops on the limb itself, not at the last sample in front.
 */
function cross(pose: Pose, from: Points, i: number, to: Points, j: number, slot: number) {
	const u = from.facing[i] / (from.facing[i] - to.facing[j]);
	project(
		pose,
		from.lon[i] + (to.lon[j] - from.lon[i]) * u,
		from.lat[i] + (to.lat[j] - from.lat[i]) * u,
		crossings,
		slot,
	);
}

function seg(pen: Pen, from: Points, i: number, to: Points, j: number) {
	pen.moveTo(from.x[i], from.y[i]);
	pen.lineTo(to.x[j], to.y[j]);
}

/** The `count` points of `pts` from `start` by `step`, as a line broken where it goes behind the sphere. */
function line(pose: Pose, pen: Pen, pts: Points, start: number, count: number, step: number) {
	const { x, y, facing } = pts;
	for (let n = 0; n < count; n++) {
		const i = start + n * step;
		if (facing[i] <= 0) continue;
		if (n === 0) pen.moveTo(x[i], y[i]);
		else if (facing[i - step] <= 0) {
			cross(pose, pts, i - step, pts, i, ENTRY);
			seg(pen, crossings, ENTRY, pts, i);
		} else pen.lineTo(x[i], y[i]);
		if (n + 1 < count && facing[i + step] <= 0) {
			cross(pose, pts, i, pts, i + step, EXIT);
			pen.lineTo(crossings.x[EXIT], crossings.y[EXIT]);
		}
	}
}

/** The stretch of limb that closes a gore where it turns behind the sphere; it is also that gore's rim. */
function arc(pose: Pose, pens: Pens, from: number, to: number) {
	const { Cx, Cy, closeUp, sphereRadius } = pose;
	const { x, y } = crossings;
	const a1 = Math.atan2((y[from] - Cy) / closeUp, x[from] - Cx);
	let da = Math.atan2((y[to] - Cy) / closeUp, x[to] - Cx) - a1;
	if (da > Math.PI) da -= 2 * Math.PI;
	else if (da < -Math.PI) da += 2 * Math.PI;
	const n = Math.ceil(Math.abs(da) / 0.07);
	pens.rim.moveTo(x[from], y[from]);
	for (let i = 1; i < n; i++) {
		const an = a1 + (da * i) / n;
		const px = Cx + sphereRadius * Math.cos(an);
		const py = Cy + sphereRadius * closeUp * Math.sin(an);
		pens.gores.lineTo(px, py);
		pens.rim.lineTo(px, py);
	}
	pens.rim.lineTo(x[to], y[to]);
}

/** The outline of a gore (its `n` first points), closed by the limb where it turns behind the sphere. */
function ring(pose: Pose, pens: Pens, pts: Points, n: number) {
	const pen = pens.gores;
	const { x, y, facing } = pts;
	let s = -1;
	let vis = 0;
	for (let i = 0; i < n; i++) {
		if (facing[i] <= 0) continue;
		vis++;
		if (s < 0 && facing[(i + n - 1) % n] <= 0) s = i;
	}
	if (!vis) return;
	if (vis === n) {
		pen.moveTo(x[0], y[0]);
		for (let i = 1; i < n; i++) pen.lineTo(x[i], y[i]);
		pen.closePath();
		return;
	}
	let first = false;
	let out = false;
	for (let j = 0; j < n; j++) {
		const i = (s + j) % n;
		if (facing[i] <= 0) continue;
		const prev = (i + n - 1) % n;
		if (facing[prev] <= 0) {
			if (out) {
				cross(pose, pts, prev, pts, i, ENTRY);
				arc(pose, pens, EXIT, ENTRY);
				pen.lineTo(crossings.x[ENTRY], crossings.y[ENTRY]);
			} else {
				cross(pose, pts, prev, pts, i, FIRST);
				first = true;
				pen.moveTo(crossings.x[FIRST], crossings.y[FIRST]);
			}
		}
		pen.lineTo(x[i], y[i]);
		const next = (i + 1) % n;
		if (facing[next] <= 0) {
			cross(pose, pts, i, pts, next, EXIT);
			out = true;
			pen.lineTo(crossings.x[EXIT], crossings.y[EXIT]);
		}
	}
	if (out && first) arc(pose, pens, EXIT, FIRST);
	pen.closePath();
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
export function coordinate(value: number, positive: string, negative: string) {
	return `${decimal(Math.abs(value), 4)}° ${value < 0 ? negative : positive}`;
}

/** French decimal comma, one decimal unless told otherwise. */
export const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
