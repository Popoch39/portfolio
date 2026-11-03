/** The Intro's curves, as plain functions of a progress in [0, 1]: usable by GSAP and by the globe alike. */
import type { Phase } from './timing';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Progress through a phase at time `t`, clamped to [0, 1]. */
export const phase = (t: number, { start, duration }: Phase) =>
	clamp01((t - start) / duration);

/** The mockup's geometry curve (cubic in-out, GSAP's `power2.inOut`). */
export const cubicInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** GSAP's `expo.out`. */
export const expoOut = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));

/** Hermite step between `a` and `b`, like GLSL's `smoothstep`. */
export function smoothstep(a: number, b: number, x: number) {
	const u = clamp01((x - a) / (b - a));
	return u * u * (3 - 2 * u);
}

/**
 * A CSS `cubic-bezier()` as an ease: finds the curve parameter whose x is the progress
 * (Newton's method), then returns its y. Written out rather than CustomEase, which would add
 * about 4 KB gzip to the home page for a few curves.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
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
