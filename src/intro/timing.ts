/**
 * Tempo of the Intro, in seconds from the start of its timeline: the mockup's "Réelle" speed
 * (04a · Fuseaux, a 12 s loop whose keyframes these are).
 */

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

/** The blue grid fades out over the page; the Intro ends with it. */
export const GRID_FADE = { start: 8.64, duration: 1.2 };

export const END = GRID_FADE.start + GRID_FADE.duration;

/** Skipping the Intro: the veil fades out over the final state. */
export const SKIP_FADE = 0.3;

/** The mockup's reveal curve, `cubic-bezier(.16,1,.3,1)`. */
export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
