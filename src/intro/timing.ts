/**
 * Tempo of the Intro, in seconds from the start of its timeline: the mockup's "Réelle" speed
 * (04a · Fuseaux, a 12 s loop whose keyframes these are).
 */

/** The globe fades in (shading, line work) while its limb is drawn round. */
export const GLOBE_APPEAR = {
	sphere: { start: 0.36, duration: 0.72 },
	lines: { start: 0.396, duration: 0.684 },
	limb: { start: 0.3, duration: 0.78 },
};

/** The globe turns to Besançon. */
export const TURN = { start: 0.4, duration: 2.8 };

/** It is cut into 12 gores of 30°. */
export const CUT = { start: 3.25, duration: 0.9 };

/** The gores unroll into sinusoidal lenses. */
export const UNROLL = { start: 3.95, duration: 1.4 };

/** The lenses straighten into strips, the columns of the page, while ink turns to accent. */
export const STRAIGHTEN = { start: 5.55, duration: 0.95 };

/** The HUD over the paper fades in, then out just before the veil lifts. */
export const HUD = { in: { start: 0.3, duration: 0.3 }, out: { start: 6.4, duration: 0.3 } };

/**
 * The Besançon point: it pops (`appear`), sends two pairs of ripples (`[time, opacity, scale]`
 * keyframes, linear in between), runs to the title cursor (`move`), grows to its size (`grow`),
 * then hands over to the real cursor (`handOver`). Its label fades in with `label`.
 */
export const POINT = {
	appear: { start: 3, duration: 0.3 },
	ripples: [
		[
			[3.12, 0, 1],
			[3.168, 0.7, 1],
			[3.96, 0, 5],
			[3.972, 0, 1],
			[4.32, 0.7, 1],
			[5.16, 0, 5],
		],
		[
			[3.48, 0, 1],
			[3.528, 0.5, 1],
			[4.44, 0, 7],
			[4.452, 0, 1],
			[4.8, 0.5, 1],
			[5.76, 0, 7],
		],
	] as [number, number, number][][],
	label: { start: 3.18, duration: 0.24 },
	move: { start: 6.9, duration: 0.7 },
	grow: { start: 7.35, duration: 0.45 },
	handOver: { start: 7.8, duration: 0.15 },
};

/**
 * The paper and sphere grain boils: one jump through `offsets` (px) every `step` seconds, the
 * paper's `paperLead` seconds ahead so that the two never jump together.
 */
export const BOIL = {
	step: 0.07,
	paperLead: 0.31,
	offsets: [
		[0, 0],
		[-47, 23],
		[31, -58],
		[-88, -17],
		[64, 71],
		[-23, 94],
		[97, -36],
		[-71, 49],
	] as [number, number][],
};

/** The veil gives way to the page in a single frame; the reveals start from there. */
export const VEIL_LIFT = 6.7;

/** The header rule is drawn from left to right. */
export const RULE = { start: 6.6, duration: 0.7 };

/** Header and hero elements fade in while rising by `rise` px, each with its offset from `VEIL_LIFT`. */
export const REVEAL = {
	duration: 0.62,
	rise: 12,
	offsets: {
		name: 0,
		role: 0.072,
		status: 0.072,
		nav: 0.144,
		lede: 0.36,
		facts: 0.48,
		actions: 0.6,
	},
} as const;

/** The two title lines rise out of their clipping wrapper, the second one `stagger` later. */
export const TITLE_RISE = { start: 6.8, duration: 0.7, stagger: 0.144, from: 104 };

/** The coordinates in the header and the title cursor appear, once the point has become the cursor. */
export const LATE = { start: 7.8, duration: 0.1 };

/** The statusline rises from below the window. */
export const STATUSLINE = { start: 8.2, duration: 0.5 };

/**
 * The blue grid fades out over the page; the Intro ends with it. The parallels go first (over
 * `parallels` s), the strip edges and meridians `meridiansDelay` s later, until the end.
 */
export const GRID_FADE = { start: 8.64, duration: 1.2, parallels: 0.84, meridiansDelay: 0.24 };

export const END = GRID_FADE.start + GRID_FADE.duration;

/** Skipping the Intro: the veil fades out over the final state. */
export const SKIP_FADE = 0.3;

/** The mockup's reveal curve, `cubic-bezier(.16,1,.3,1)`. */
export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
