// Pont typé vers les fonctions `.mjs` du kit dont les options valent `null` par défaut :
// TypeScript en infère le type `null` et refuserait l'objet qu'on leur passe. Les types sont
// donnés en JSDoc, que TypeScript lit dans les fichiers JavaScript.
import { dotsOf, fillet, ribsOf } from '../../vendor/anatomy/lathe.mjs';
import { tubePieces } from '../../vendor/anatomy/tube.mjs';

/** @typedef {[number, number, number]} Point3 */
/** @typedef {{ o: Point3, a: Point3, u: Point3, v: Point3 }} Frame */
/** @typedef {{ mid: Point3, points: Point3[], radii: number[] }} TubePiece */

/**
 * Tracé arrondi à chaque coude, rayon relevé là où le coude se voit par la tranche.
 * @param {Point3[]} points @param {number} radius @param {object} P @param {number} tube
 * @returns {Point3[]}
 */
export const filletOn = (points, radius, P, tube) => fillet(points, radius, 7, { P, tube });

/**
 * Morceaux d'un tube ou d'un câble, triables en profondeur.
 * @param {Point3[]} points @param {number} radius @param {object} P
 * @param {{ maxLength?: number, spacing?: number, gaps?: [number, number][], rings?: object }} options
 * @returns {TubePiece[]}
 */
export const tubeOf = (points, radius, P, options) => tubePieces(points, radius, P, options);

/**
 * Molette : nervures qui s'estompent vers les bords et finissent sur leurs deux arcs.
 * @param {Frame} F @param {number} s0 @param {number} s1 @param {number} r @param {number} count @param {object} P
 * @returns {{ d: string, alpha: number }[]}
 */
export const knurlOf = (F, s0, s1, r, count, P) => ribsOf(F, s0, s1, r, count, P, { fade: [0.1, 0.55], seams: true });

/**
 * Cercle de vis vu de face.
 * @param {Frame} F @param {number} s @param {number} r @param {number} count @param {object} P @param {number} phase
 * @returns {[number, number][]}
 */
export const boltsOf = (F, s, r, count, P, phase) => dotsOf(F, s, r, count, P, { all: true, phase });
