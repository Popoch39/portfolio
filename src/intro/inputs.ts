/**
 * What the globe's painter (`canvas.ts`) needs from the page, read on the main thread: the palette
 * lives in the CSS, and an SVG noise only decodes where there is a DOM.
 */
import type { Surface } from './canvas';
import type { Palette, Rgb } from './globe';
import { GRAIN_TILE, SPHERE_GRAIN } from './grain';

/** The paper's colours (`--color-*` on `element`), whatever their CSS notation. */
export function readPalette(element: Element): Palette {
	const style = getComputedStyle(element);
	const probe = document.createElement('canvas');
	probe.width = probe.height = 1;
	const context = probe.getContext('2d', { willReadFrequently: true });
	const rgb = (property: string): Rgb => {
		if (!context) return [0, 0, 0];
		context.fillStyle = style.getPropertyValue(property);
		context.fillRect(0, 0, 1, 1);
		const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
		return [red, green, blue];
	};
	return {
		ink: rgb('--color-ink'),
		accent: rgb('--color-accent'),
		paper: rgb('--color-paper'),
		light: rgb('--color-light'),
	};
}

/** The painter's scratch canvas on the main thread: a page canvas where `OffscreenCanvas` is missing. */
export function newSurface(): Surface {
	return typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
}

/**
 * The sphere's grain tile, rasterised at `pixelRatio` (crisp specks once the pattern scales it back),
 * or `null` if it does not load: the sphere then keeps its shading alone.
 */
export function decodeGrain(pixelRatio: number): Promise<ImageBitmap | null> {
	return new Promise((resolve) => {
		const noise = new Image();
		noise.onload = () => {
			const tile = document.createElement('canvas');
			tile.width = tile.height = Math.round(GRAIN_TILE * pixelRatio);
			tile.getContext('2d')?.drawImage(noise, 0, 0, tile.width, tile.height);
			resolve(createImageBitmap(tile));
		};
		noise.onerror = () => resolve(null);
		noise.src = SPHERE_GRAIN;
	});
}
