// Redraws src/assets/moka/screw.webp, the screwing's strip (ADR 0007): the generator first, then its 37 views of the
// collector, one every 10° of the turn, rasterized in Chromium and stacked top to bottom into one WebP.
// Run it again when the moka changes: `node scripts/moka/strip.mjs` (or `bun`).
// Requires the Playwright browsers (`bunx playwright install chromium`) and ImageMagick.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, '..', '..');
const OUTPUT = join(ROOT, 'src/assets/moka/screw.webp');

execFileSync(process.execPath, [join(HERE, 'build.mjs')], { stdio: 'inherit' });
const moka = JSON.parse(readFileSync(join(ROOT, 'src/assets/moka/moka.json'), 'utf8'));
const [frameWidth, frameHeight] = moka.size;
const { views, w, h } = moka.screw;
// The views' box, in frame pixels, as the generator cropped them.
const [boxWidth, boxHeight] = [Math.round((w * frameWidth) / 100), Math.round((h * frameHeight) / 100)];

// Twice the board's desktop figure (444px for the 600px frame), rounded to 1.5 pixels per frame pixel so that every
// view is a whole number of pixels: a step of the strip is then exactly one view.
const PIXELS_PER_FRAME_PIXEL = 1.5;
const [viewWidth, viewHeight] = [boxWidth * PIXELS_PER_FRAME_PIXEL, boxHeight * PIXELS_PER_FRAME_PIXEL];
if (!Number.isInteger(viewWidth) || !Number.isInteger(viewHeight)) throw new Error(`strip: a view of ${viewWidth}×${viewHeight}px`);
/*
 * The hairlines keep their width in CSS pixels of the image's layout box, whatever the transform around it. On the
 * page the layers are laid out at the close-up's size (`fitAtOne.scale` times the figure) and the camera scales them
 * down: the views are laid out the same way, then scaled to the strip's density, so that their lines are as thin as
 * the collector's layer they take over from.
 */
const layoutWidth = boxWidth * 0.74 * moka.fitAtOne.scale;
const toStrip = viewWidth / layoutWidth;

const tmp = mkdtempSync(join(tmpdir(), 'screw-'));
try {
	// A file page: about:blank may not load file: images.
	const page = join(tmp, 'view.html');
	writeFileSync(
		page,
		`<!doctype html><style>html, body { margin: 0; background: transparent; } img { display: block; width: ${layoutWidth}px; transform: scale(${toStrip}); transform-origin: 0 0; }</style><img alt="">`,
	);
	const browser = await chromium.launch();
	const tab = await browser.newPage({ viewport: { width: viewWidth, height: viewHeight } });
	await tab.goto(pathToFileURL(page).href);
	const shots = [];
	for (let i = 0; i < views; i++) {
		const source = pathToFileURL(join(HERE, 'out', `screw-${i}.svg`)).href;
		await tab.locator('img').evaluate((img, src) => {
			img.src = src;
			return img.decode();
		}, source);
		const shot = join(tmp, `${String(i).padStart(2, '0')}.png`);
		await tab.screenshot({ path: shot, omitBackground: true, clip: { x: 0, y: 0, width: viewWidth, height: viewHeight } });
		shots.push(shot);
	}
	await browser.close();
	// Lossy colours over a lossless alpha: the edges of the piece stay clean over the layers beneath.
	execFileSync('magick', [...shots, '-append', '-strip', '-quality', '75', '-define', 'webp:method=6', '-define', 'webp:use-sharp-yuv=true', '-define', 'webp:alpha-quality=100', OUTPUT]);
	const [width, height] = execFileSync('magick', ['identify', '-format', '%w %h', OUTPUT], { encoding: 'utf8' }).split(' ').map(Number);
	if (height !== views * viewHeight || height > 16383) throw new Error(`strip: ${width}×${height}px`);
	console.log(`wrote ${OUTPUT}: ${views} views of ${viewWidth}×${viewHeight}px, ${width}×${height}px, ${(statSync(OUTPUT).size / 1024).toFixed(0)} KB`);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
