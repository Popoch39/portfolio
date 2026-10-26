// Façade des modules `.mjs` du kit dont TypeScript infère mal les options (leurs valeurs par défaut
// `null` ou `[]` deviennent les seuls types admis) : tubes à trous, rangées estompées, formes
// tournées de l'audit. Les signatures sont données en JSDoc pour la géométrie, qui reste typée.
import * as A from '../../vendor/anatomy/audit.mjs';
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubePieces } from '../../vendor/anatomy/tube.mjs';

/** @typedef {[number, number, number]} Point3 */
/** @typedef {{ o: number[], a: number[], u: number[], v: number[] }} Frame */

/**
 * Morceaux d'un tube, avec ses trous sous les brides et colliers.
 * @param {Point3[]} points
 * @param {number} radius
 * @param {object} P
 * @param {{ maxLength?: number, gaps?: [number, number][] }} options
 * @returns {{ mid: Point3, points: Point3[], radii: number[], body: string, shine: string, shade: string, edges: string, wide: boolean, rings: { d: string, alpha: number }[] }[]}
 */
export const tubeChunks = (points, radius, P, options) => tubePieces(points, radius, P, options);

/**
 * Cercle de vis sur la face vue, estompé vers les flancs.
 * @param {Frame} F
 * @param {number} s
 * @param {number} r
 * @param {number} count
 * @param {object} P
 * @returns {[number, number, number][]}
 */
export const boltCircle = (F, s, r, count, P) => G.dotsOf(F, s, r, count, P, { fade: [0.04, 0.42] });

/**
 * Stries axiales estompées vers les flancs (dents, moletage).
 * @param {Frame} F
 * @param {number} s0
 * @param {number} s1
 * @param {number} r
 * @param {number} count
 * @param {object} P
 * @returns {{ d: string, alpha: number }[]}
 */
export const fadedRibs = (F, s0, s1, r, count, P) => G.ribsOf(F, s0, s1, r, count, P, { fade: [0.1, 0.55] });

/**
 * Point d'un repère de révolution.
 * @param {Frame} F
 * @param {number} s
 * @param {number} r
 * @param {number} angle
 * @returns {Point3}
 */
export const pointOf = (F, s, r, angle) => G.pointOf(F, s, r, angle);

/**
 * Forme tournée pour l'audit (profil fermé sur l'axe), avec ses métadonnées.
 * @param {Frame} F
 * @param {number[][]} profile
 * @param {{ name: string, owner?: string, seated?: boolean, cut?: object[] }} meta
 * @returns {object}
 */
export const turnedShape = (F, profile, meta) => A.solid(F, profile, meta);
