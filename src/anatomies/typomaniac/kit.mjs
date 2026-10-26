// Frontière typée vers les tours et les tubes du kit (`lathe.mjs`, `tube.mjs`), écrits en JS : leurs
// options par défaut (`null`) se typeraient mal depuis un `.ts`. On ne réexporte que ce que la
// géométrie du banc emploie, avec les types qu'elle leur donne.
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubePieces, tubeSvg } from '../../vendor/anatomy/tube.mjs';

/** @typedef {import('../../vendor/anatomy/iso-kit.ts').Point3} Point3 */
/** @typedef {import('../../vendor/anatomy/iso-kit.ts').Projection} Projection */
/** @typedef {import('../../vendor/anatomy/iso-kit.ts').SolidPaths} SolidPaths */
/** @typedef {{ o: Point3, a: Point3, u: Point3, v: Point3 }} Frame */
/** @typedef {{ points: Point3[], radii: number[], mid: Point3, from: number, to: number }} TubePiece */

/** @type {(o: Point3, a: Point3) => Frame} */
export const frameAlong = (o, a) => G.frameAlong(o, a);
/** @type {(o: Point3, a: Point3, u: Point3, v: Point3) => Frame} */
export const frameOf = (o, a, u, v) => G.frameOf(o, a, u, v);
/** @type {(F: Frame, s: number, r: number, angle: number) => Point3} */
export const pointOf = (F, s, r, angle) => G.pointOf(F, s, r, angle);
/** @type {(F: Frame, s: number, r: number, P: Projection) => string} */
export const circleOf = (F, s, r, P) => G.circleOf(F, s, r, P);
/** @type {(F: Frame, s0: number, s1: number, r: number, count: number, P: Projection, fade: number[]) => { d: string, alpha: number }[]} */
export const ribsOf = (F, s0, s1, r, count, P, fade) => G.ribsOf(F, s0, s1, r, count, P, { fade, seams: true });
/** @type {(profile: number[][], F: Frame, P: Projection, options: { bevel?: number, steps?: number }) => SolidPaths} */
export const solidOf = (profile, F, P, options) => G.solidOf(profile, F, P, options);
/** @type {(centre: Point3, r: number, P: Projection, steps: number) => SolidPaths} */
export const sphereOf = (centre, r, P, steps) => G.sphereOf(centre, r, P, { steps });
/** @type {<T extends number[]>(points: T[]) => T[]} */
export const hullOf = (points) => G.hullOf(points);
/** @type {(P: Projection) => Point3} */
export const viewOf = (P) => G.viewOf(P);
/** @type {(points: Point3[], radius: number, perArc: number, P: Projection, tube: number) => Point3[]} */
export const fillet = (points, radius, perArc, P, tube) => G.fillet(points, radius, perArc, { P, tube });
/** @type {(points: Point3[]) => number} */
export const pathLength = (points) => G.pathLength(points);
/** @type {(points: Point3[], from: number, to: number) => Point3[]} */
export const cut = (points, from, to) => G.cut(points, from, to);
/** @type {(route: Point3[], r: number, P: Projection, options: Record<string, unknown>) => TubePiece[]} */
export const tubes = (route, r, P, options) => tubePieces(route, r, P, options);
/** @type {(piece: TubePiece, tone: string) => string} */
export const tube = (piece, tone) => tubeSvg(piece, { tone });
