/**
 * The Intro's grain: SVG `feTurbulence` noise as data URIs, tiled (`stitchTiles` makes the tile
 * seamless). Rasterised once by the browser, no request.
 */

/** Side of a noise tile, px. */
export const GRAIN_TILE = 256;

const noise = (frequency: number, seed: number, color: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN_TILE}" height="${GRAIN_TILE}">` +
			`<filter id="n" x="0" y="0" width="100%" height="100%">` +
			`<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
			`<feColorMatrix values="${color}"/></filter>` +
			`<rect width="100%" height="100%" filter="url(#n)"/></svg>`,
	)}`;

/** Black specks on the paper. */
export const PAPER_GRAIN = noise(0.82, 31, '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.6 0 0 0 -1.75');

/** Denser, warmer specks on the sphere. */
export const SPHERE_GRAIN = noise(0.9, 13, '0 0 0 0 .07 0 0 0 0 .07 0 0 0 0 .06 4.4 0 0 0 -2.05');
