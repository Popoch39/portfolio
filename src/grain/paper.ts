/**
 * The paper grain: SVG `feTurbulence` noise as a data URI, tiled (`stitchTiles` makes the tile seamless).
 * Rasterised once by the browser, no request. It lies over every page (`Grain.astro`).
 */

/** Side of the noise tile, px. */
const TILE = 256;

/** Black specks on the paper. */
export const PAPER_GRAIN = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
		`<filter id="n" x="0" y="0" width="100%" height="100%">` +
		`<feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="31" stitchTiles="stitch"/>` +
		`<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.6 0 0 0 -1.75"/></filter>` +
		`<rect width="100%" height="100%" filter="url(#n)"/></svg>`,
)}`;
