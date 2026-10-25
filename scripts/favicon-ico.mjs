// Produit public/favicon.ico (16, 32 et 48 px) à partir des rectangles de
// public/favicon.svg, sans dépendance : le favicon n'est fait que de rectangles pleins,
// qu'on rastérise par couverture de pixel et qu'on encode en BMP 32 bits dans le .ico.
// Lancé à la main (`pnpm favicon:ico`) quand le SVG change ; le .ico est versionné.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48];
const svgPath = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));
const icoPath = fileURLToPath(new URL('../public/favicon.ico', import.meta.url));

const svg = readFileSync(svgPath, 'utf8');
const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
if (!viewBox || viewBox[2] !== viewBox[3]) throw new Error('favicon.svg : viewBox carré attendu.');
const num = (tag, name) => Number(tag.match(new RegExp(`\\s${name}="([^"]+)"`))?.[1] ?? 0);
const rects = (svg.match(/<rect\b[^>]*>/g) ?? []).map((tag) => ({
	x: num(tag, 'x') - viewBox[0],
	y: num(tag, 'y') - viewBox[1],
	w: num(tag, 'width'),
	h: num(tag, 'height'),
	rgb: tag.match(/fill="#([0-9a-f]{6})"/i)?.[1].match(/../g)?.map((c) => parseInt(c, 16)) ?? [0, 0, 0],
}));
if (rects.length === 0 || svg.match(/<(?!svg|rect|\/svg)[a-z]/i)) {
	throw new Error('favicon.svg : ce script ne sait rastériser que des <rect> pleins.');
}

/** Pixels BGRA, lignes de bas en haut (ordre BMP). */
function rasterize(size) {
	const scale = size / viewBox[2];
	const pixels = Buffer.alloc(size * size * 4);
	for (const r of rects) {
		const [x0, y0, x1, y1] = [r.x * scale, r.y * scale, (r.x + r.w) * scale, (r.y + r.h) * scale];
		for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
			for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
				// Part du pixel couverte par le rectangle : bords nets aux tailles entières, lissés sinon.
				const cover = (Math.min(px + 1, x1) - Math.max(px, x0)) * (Math.min(py + 1, y1) - Math.max(py, y0));
				const i = ((size - 1 - py) * size + px) * 4;
				pixels[i] = r.rgb[2];
				pixels[i + 1] = r.rgb[1];
				pixels[i + 2] = r.rgb[0];
				pixels[i + 3] = Math.max(pixels[i + 3], Math.round(cover * 255));
			}
		}
	}
	return pixels;
}

function bmp(size) {
	const header = Buffer.alloc(40);
	header.writeUInt32LE(40, 0);
	header.writeInt32LE(size, 4);
	// Hauteur doublée : le .ico empile l'image couleur et son masque 1 bit.
	header.writeInt32LE(size * 2, 8);
	header.writeUInt16LE(1, 12);
	header.writeUInt16LE(32, 14);
	// Masque entièrement transparent-neutre : la couche alpha fait foi.
	const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
	return Buffer.concat([header, rasterize(size), mask]);
}

const images = SIZES.map(bmp);
const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach((image, i) => {
	const entry = 6 + i * 16;
	dir[entry] = SIZES[i];
	dir[entry + 1] = SIZES[i];
	dir.writeUInt16LE(1, entry + 4);
	dir.writeUInt16LE(32, entry + 6);
	dir.writeUInt32LE(image.length, entry + 8);
	dir.writeUInt32LE(offset, entry + 12);
	offset += image.length;
});

writeFileSync(icoPath, Buffer.concat([dir, ...images]));
console.log(`Favicon .ico écrit : ${icoPath}`);
