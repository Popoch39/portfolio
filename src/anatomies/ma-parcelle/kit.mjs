// Passerelle typée vers quelques fonctions du kit dont TypeScript infère mal les options depuis
// leur JavaScript (une valeur par défaut `null` ou `false` fige le type de l'option). Les types
// sont ceux que documente `references/kit.md` du skill `anatomy`.
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubePieces } from '../../vendor/anatomy/tube.mjs';

/**
 * Rainures axiales qui s'estompent vers le bord apparent (`ribsOf` avec `fade`), arcs de bord
 * compris si `seams` le demande : de quoi nourrir `fadedSvg`.
 * @param {{ o: number[], a: number[], u: number[], v: number[] }} F
 * @param {number} s0
 * @param {number} s1
 * @param {number} r
 * @param {number} count
 * @param {{ origin: [number, number], scale: number, azimuth?: number, elevation?: number }} P
 * @param {{ fade?: [number, number], seams?: boolean | 'first' | 'last', phase?: number }} [options]
 * @returns {{ d: string, alpha: number }[]}
 */
export const fadedRibs = (F, s0, s1, r, count, P, { fade = [0.1, 0.55], seams = false, phase = 0 } = {}) =>
	G.ribsOf(F, s0, s1, r, count, P, { fade, seams, phase });

/**
 * Rainures axiales nettes, sur la seule face tournée vers le lecteur.
 * @param {{ o: number[], a: number[], u: number[], v: number[] }} F
 * @param {number} s0
 * @param {number} s1
 * @param {number} r
 * @param {number} count
 * @param {{ origin: [number, number], scale: number, azimuth?: number, elevation?: number }} P
 * @param {{ least?: number, phase?: number }} [options]
 * @returns {string}
 */
export const ribLines = (F, s0, s1, r, count, P, { least = 0.12, phase = 0 } = {}) => String(G.ribsOf(F, s0, s1, r, count, P, { least, phase }));

/**
 * Les tronçons d'un câble (`tubePieces`), avec des bouts fermés au choix.
 * @param {number[][]} points
 * @param {number} radius
 * @param {{ origin: [number, number], scale: number, azimuth?: number, elevation?: number }} P
 * @param {{ maxLength?: number, spacing?: number, caps?: boolean | [boolean, boolean] }} [options]
 * @returns {object[]}
 */
export const cablePieces = (points, radius, P, options = {}) => tubePieces(points, radius, P, options);
