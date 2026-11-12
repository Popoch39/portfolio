// Derives the Estompage's candidate elevation models from the IGN's LiDAR HD round Besançon (issue #84), in the hero
// map's projection and at whole multiples of its scale: the bare ground, the full surface (ramparts, roofs and trees)
// and the ground with what is built on it but without the trees. Each one is written at four finenesses into
// src/assets/relief/candidates/, 16 bits per pixel, with its extent, resolution and weights in a JSON beside it.
//
// Run it again to refresh or reframe the data: `bun scripts/relief/elevation.mjs`. The raw downloads are kept in
// scripts/relief/cache/ (out of git): delete that folder to ask the IGN again. A run that does not give the committed
// files again fails; `--refresh` accepts the new ones. `--verify` only reads the written files back.
// Requires bun (it reads the hero map's TypeScript) and ImageMagick (to decode the classification's PNG).
// The site's build never runs this script, and never calls the IGN.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { endianness } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { person } from '../../src/data/profile.ts';
import { graticule } from '../../src/hero/map.ts';

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const OUTPUT = join(ROOT, 'src/assets/relief/candidates');

/** One minute of latitude on the hero's map, px: the scale every candidate is a multiple of. */
const LAT_MINUTE = graticule.pitchY;
/** The hero's projection: a minute of longitude narrows with the cosine of the marker's latitude. */
const LON_MINUTE = LAT_MINUTE * Math.cos((person.latitude * Math.PI) / 180);

/**
 * The extent, in the hero map's px east and south of its marker: 400 px a side, about 6.2 km, centred on the
 * Citadelle (44 px east, 58 px south), wide enough to leave the framing open: the loop of the Doubs, Bregille,
 * Chaudanne.
 */
const EXTENT = { west: -156, east: 244, north: -142, south: 258 };
/** Pixels per px of the hero's map: about 7.7, 3.9, 1.9 and 1 m per pixel. Each one halves the next. */
const SCALES = [2, 4, 8, 16];
const FINEST = SCALES.at(-1);

const WMS = 'https://data.geopf.fr/wms-r/wms';
const WFS = 'https://data.geopf.fr/wfs/ows';
const LAYERS = {
	ground: 'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93',
	surface: 'IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93',
};
const CLASSIFICATION = 'IGNF_LIDAR-HD_CLASS';
const TILES_METADATA = 'IGNF_LIDAR-HD_METADONNEE:metadata';
/** The WMS refuses more than 5 010 px a side. */
const REQUEST_SIDE = 4096;

/**
 * The models are native at 0.5 m, their pixels centred on whole half metres (the IGN's own tiles run from x − 0.25
 * to y + 0.25). Asked off that grid, the ground comes back interpolated by the server; asked on it at 1 m, both
 * layers give the exact mean of their four native pixels, which is all the finest candidate (0.96 m) can hold.
 */
const SOURCE_METRE = 1;
const SOURCE_SHIFT = { x: -0.25, y: 0.25 };

/** The classification's pyramid is Web Mercator's: level 17, about 0.81 m on the ground at this latitude. */
const MERCATOR_ORIGIN = 20037508.342789244;
const MASK_RESOLUTION = (2 * MERCATOR_ORIGIN) / 256 / 2 ** 17;
/** What stands on the ground and is not a tree, by its colour on the classification: building, bridge deck, lasting above-ground. */
const BUILT_COLOURS = [0xb41414, 0xf0f000, 0xff00ff];

/**
 * Altitudes read on the LiDAR HD when the spec was written (#83), found again here within `tolerance` metres. Each
 * is the highest (or, for the river, the median) altitude within `radius` metres of the place. The spec's two hills
 * were read below their summits, which stand 8 m higher: hence their tolerance. What stands above the ground is read
 * in the finest file only: coarser, a rampart is averaged with its ditch.
 */
const LANDMARKS = [
	{ name: 'Doubs', model: 'ground', longitude: 6.0091, latitude: 47.2172, radius: 15, read: 'median', expected: 234, tolerance: 2 },
	{ name: 'Citadelle', model: 'ground', longitude: 6.0345, latitude: 47.2281, radius: 150, read: 'highest', expected: 372, tolerance: 4 },
	{ name: 'Citadelle', model: 'surface', longitude: 6.0345, latitude: 47.2281, radius: 150, read: 'highest', expected: 388, tolerance: 4, finestOnly: true },
	{ name: 'Citadelle', model: 'built', longitude: 6.0345, latitude: 47.2281, radius: 150, read: 'highest', expected: 388, tolerance: 4, finestOnly: true },
	{ name: 'Chaudanne', model: 'ground', longitude: 6.023, latitude: 47.2271, radius: 150, read: 'highest', expected: 415, tolerance: 10 },
	{ name: 'Bregille', model: 'ground', longitude: 6.0447, latitude: 47.2349, radius: 150, read: 'highest', expected: 441, tolerance: 10 },
];

const DEGREE = Math.PI / 180;
/** GRS80, the ellipsoid of Lambert-93. */
const SEMI_MAJOR = 6378137;
const ECCENTRICITY = 0.0818191910428158;

const fail = (message) => {
	throw new Error(`relief: ${message}`);
};

/** Lambert-93 (EPSG:2154), from the IGN's constants: [easting, northing] in metres. */
function lambert93(longitude, latitude) {
	const sine = Math.sin(latitude * DEGREE);
	const isometric = Math.log(Math.tan(Math.PI / 4 + (latitude * DEGREE) / 2) * ((1 - ECCENTRICITY * sine) / (1 + ECCENTRICITY * sine)) ** (ECCENTRICITY / 2));
	const radius = 11754255.426096 * Math.exp(-0.725607765053267 * isometric);
	const angle = 0.725607765053267 * (longitude - 3) * DEGREE;
	return [700000 + radius * Math.sin(angle), 12655612.049876 - radius * Math.cos(angle)];
}

const mercatorX = (longitude) => SEMI_MAJOR * longitude * DEGREE;
const mercatorY = (latitude) => SEMI_MAJOR * Math.log(Math.tan(Math.PI / 4 + (latitude * DEGREE) / 2));

/** Where a point of the hero's map is, `x` px east and `y` px south of the marker. */
const longitudeAt = (x) => person.longitude + x / LON_MINUTE / 60;
const latitudeAt = (y) => person.latitude - y / LAT_MINUTE / 60;

/** The size of a hero px on the ground at the marker, m: the ellipsoid makes it 0.3 % wider than tall. */
function heroPixelMetres() {
	const curve = 1 - (ECCENTRICITY * Math.sin(person.latitude * DEGREE)) ** 2;
	const alongParallel = (SEMI_MAJOR / Math.sqrt(curve)) * Math.cos(person.latitude * DEGREE);
	const alongMeridian = (SEMI_MAJOR * (1 - ECCENTRICITY ** 2)) / curve ** 1.5;
	return { x: (alongParallel * DEGREE) / 60 / LON_MINUTE, y: (alongMeridian * DEGREE) / 60 / LAT_MINUTE };
}

/** One download, kept: the IGN is asked once, whatever the number of runs. */
async function download(name, url, type) {
	const file = join(CACHE, name);
	if (existsSync(file)) return readFileSync(file);
	mkdirSync(CACHE, { recursive: true });
	console.log(`downloading ${name}`);
	const response = await fetch(url, { headers: { 'User-Agent': 'relief-workshop-script' } });
	const body = Buffer.from(await response.arrayBuffer());
	const received = response.headers.get('content-type') ?? '';
	if (!response.ok || !received.startsWith(type)) fail(`${name}: HTTP ${response.status} (${received}) ${body.subarray(0, 300).toString()}`);
	// Renamed once whole: an interrupted download never passes for a cached one.
	writeFileSync(`${file}.part`, body);
	renameSync(`${file}.part`, file);
	return body;
}

const getMap = (layer, crs, [west, south, east, north], width, height, format) =>
	`${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=${crs}&BBOX=${west},${south},${east},${north}&WIDTH=${width}&HEIGHT=${height}&FORMAT=${encodeURIComponent(format)}`;

/** A grid of `width` × `height` cells from (`west`, `north`), cut into requests the WMS accepts. */
function* requests(width, height) {
	for (let top = 0; top < height; top += REQUEST_SIDE) {
		for (let left = 0; left < width; left += REQUEST_SIDE) {
			yield { left, top, width: Math.min(REQUEST_SIDE, width - left), height: Math.min(REQUEST_SIDE, height - top) };
		}
	}
}

/** The corners of the extent, and the middles of its sides: Lambert-93 bends its parallels. */
function outline() {
	const points = [];
	for (const x of [EXTENT.west, (EXTENT.west + EXTENT.east) / 2, EXTENT.east]) {
		for (const y of [EXTENT.north, (EXTENT.north + EXTENT.south) / 2, EXTENT.south]) points.push([longitudeAt(x), latitudeAt(y)]);
	}
	return points;
}

/** A layer at 1 m in Lambert-93, on the IGN's own grid, over the whole extent and a margin for the interpolation. */
async function source(model) {
	const corners = outline().map(([longitude, latitude]) => lambert93(longitude, latitude));
	const margin = 4;
	const snap = (value, shift, round) => round(value - shift) + shift;
	const west = snap(Math.min(...corners.map(([x]) => x)) - margin, SOURCE_SHIFT.x, Math.floor);
	const east = snap(Math.max(...corners.map(([x]) => x)) + margin, SOURCE_SHIFT.x, Math.ceil);
	const south = snap(Math.min(...corners.map(([, y]) => y)) - margin, SOURCE_SHIFT.y, Math.floor);
	const north = snap(Math.max(...corners.map(([, y]) => y)) + margin, SOURCE_SHIFT.y, Math.ceil);
	const [width, height] = [(east - west) / SOURCE_METRE, (north - south) / SOURCE_METRE];
	const altitudes = new Float32Array(width * height);
	for (const part of requests(width, height)) {
		const box = [west + part.left, north - part.top - part.height, west + part.left + part.width, north - part.top];
		const name = `${model}-${box.join('_')}.bil`;
		const body = await download(name, getMap(LAYERS[model], 'EPSG:2154', box, part.width, part.height, 'image/x-bil;bits=32'), 'image/x-bil');
		if (body.length !== part.width * part.height * 4) fail(`${name}: ${body.length} bytes for ${part.width}×${part.height} px`);
		const view = new DataView(body.buffer, body.byteOffset, body.length);
		for (let row = 0; row < part.height; row++) {
			for (let column = 0; column < part.width; column++) {
				const altitude = view.getFloat32((row * part.width + column) * 4, true);
				// A hole in the coverage comes back as a no-data value far below any ground.
				if (!(altitude > -100 && altitude < 5000)) fail(`${name}: no altitude at ${column},${row} (${altitude})`);
				altitudes[(part.top + row) * width + part.left + column] = altitude;
			}
		}
	}
	return { altitudes, width, height, west, north };
}

/** The finest candidate's grid, read in a source by bilinear interpolation. */
function project({ altitudes, width, west, north }) {
	const [columns, rows] = [(EXTENT.east - EXTENT.west) * FINEST, (EXTENT.south - EXTENT.north) * FINEST];
	const model = new Float32Array(columns * rows);
	for (let row = 0; row < rows; row++) {
		const latitude = latitudeAt(EXTENT.north + (row + 0.5) / FINEST);
		for (let column = 0; column < columns; column++) {
			const [x, y] = lambert93(longitudeAt(EXTENT.west + (column + 0.5) / FINEST), latitude);
			const [u, v] = [(x - west) / SOURCE_METRE - 0.5, (north - y) / SOURCE_METRE - 0.5];
			const [left, top] = [Math.floor(u), Math.floor(v)];
			const [a, b] = [u - left, v - top];
			const at = top * width + left;
			model[row * columns + column] =
				(altitudes[at] * (1 - a) + altitudes[at + 1] * a) * (1 - b) + (altitudes[at + width] * (1 - a) + altitudes[at + width + 1] * a) * b;
		}
	}
	return { model, columns, rows };
}

/** On the finest grid, 1 where the LiDAR's classification saw something built. */
async function builtMask(columns, rows) {
	const snap = (value, round) => round(value / MASK_RESOLUTION) * MASK_RESOLUTION;
	const west = snap(mercatorX(longitudeAt(EXTENT.west)), Math.floor);
	const east = snap(mercatorX(longitudeAt(EXTENT.east)), Math.ceil);
	const south = snap(mercatorY(latitudeAt(EXTENT.south)), Math.floor);
	const north = snap(mercatorY(latitudeAt(EXTENT.north)), Math.ceil);
	const [width, height] = [Math.round((east - west) / MASK_RESOLUTION), Math.round((north - south) / MASK_RESOLUTION)];
	const built = new Uint8Array(width * height);
	for (const part of requests(width, height)) {
		const box = [west + part.left * MASK_RESOLUTION, north - (part.top + part.height) * MASK_RESOLUTION, west + (part.left + part.width) * MASK_RESOLUTION, north - part.top * MASK_RESOLUTION];
		const name = `classification-${part.left}_${part.top}_${part.width}_${part.height}.png`;
		await download(name, getMap(CLASSIFICATION, 'EPSG:3857', box, part.width, part.height, 'image/png'), 'image/png');
		const pixels = execFileSync('magick', [join(CACHE, name), '-depth', '8', 'rgba:-'], { maxBuffer: part.width * part.height * 4 + 1024 });
		if (pixels.length !== part.width * part.height * 4) fail(`${name}: decoded to ${pixels.length} bytes`);
		for (let row = 0; row < part.height; row++) {
			for (let column = 0; column < part.width; column++) {
				const at = (row * part.width + column) * 4;
				const colour = (pixels[at] << 16) | (pixels[at + 1] << 8) | pixels[at + 2];
				if (pixels[at + 3] === 255 && BUILT_COLOURS.includes(colour)) built[(part.top + row) * width + part.left + column] = 1;
			}
		}
	}
	const mask = new Uint8Array(columns * rows);
	const sourceColumns = Int32Array.from({ length: columns }, (_, column) => Math.floor((mercatorX(longitudeAt(EXTENT.west + (column + 0.5) / FINEST)) - west) / MASK_RESOLUTION));
	for (let row = 0; row < rows; row++) {
		const sourceRow = Math.floor((north - mercatorY(latitudeAt(EXTENT.north + (row + 0.5) / FINEST))) / MASK_RESOLUTION);
		for (let column = 0; column < columns; column++) mask[row * columns + column] = built[sourceRow * width + sourceColumns[column]];
	}
	return mask;
}

/** Half the fineness: each pixel is the mean of four. */
function halve({ model, columns, rows }) {
	const [halfColumns, halfRows] = [columns / 2, rows / 2];
	const half = new Float32Array(halfColumns * halfRows);
	for (let row = 0; row < halfRows; row++) {
		for (let column = 0; column < halfColumns; column++) {
			const at = 2 * row * columns + 2 * column;
			half[row * halfColumns + column] = (model[at] + model[at + 1] + model[at + columns] + model[at + columns + 1]) / 4;
		}
	}
	return { model: half, columns: halfColumns, rows: halfRows };
}

/** The acquisition and edition dates of the IGN's 1 km tiles under the extent, for the credit. */
async function dataset() {
	const corners = outline().map(([longitude, latitude]) => lambert93(longitude, latitude));
	const box = [Math.min(...corners.map(([x]) => x)), Math.min(...corners.map(([, y]) => y)), Math.max(...corners.map(([x]) => x)), Math.max(...corners.map(([, y]) => y))].map(Math.round);
	const url = `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${TILES_METADATA}&OUTPUTFORMAT=application/json&COUNT=1000&SRSNAME=EPSG:2154&BBOX=${box.join(',')},EPSG:2154`;
	const { features } = JSON.parse((await download(`tiles-${box.join('_')}.json`, url, 'application/json')).toString());
	if (features.length === 0) fail('no LiDAR HD tile under the extent');
	const day = (date) => date.slice(0, 10);
	const sorted = (values) => [...new Set(values)].sort();
	const tiles = features.map((feature) => feature.properties);
	return {
		source: 'IGN – LiDAR HD',
		licence: 'Licence Ouverte 2.0',
		service: WMS,
		layers: { ...LAYERS, built: CLASSIFICATION },
		tiles: tiles.length,
		missions: sorted(tiles.map((tile) => tile.code_mission)),
		acquired: { from: sorted(tiles.map((tile) => day(tile.date_debut_acquisition)))[0], to: sorted(tiles.map((tile) => day(tile.date_fin_acquisition))).at(-1) },
		edited: sorted(tiles.map((tile) => day(tile.date_edition))),
	};
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileName = (model, scale) => `${model}-x${scale}`;

/** Little-endian whatever the machine, as the browser's typed arrays will read it. */
function littleEndian(values) {
	const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
	return endianness() === 'LE' ? bytes : Buffer.from(bytes).swap16();
}

async function build() {
	const pixel = heroPixelMetres();
	const finest = {};
	for (const model of Object.keys(LAYERS)) {
		finest[model] = project(await source(model));
		console.log(`projected ${model}`);
	}
	const { columns, rows } = finest.ground;
	const mask = await builtMask(columns, rows);
	finest.built = { model: finest.ground.model.map((altitude, at) => (mask[at] ? finest.surface.model[at] : altitude)), columns, rows };

	// One range for every candidate: the Estompage swaps one for another without rescaling its altitudes.
	let [lowest, highest] = [Infinity, -Infinity];
	for (const { model } of Object.values(finest)) {
		for (const altitude of model) {
			if (altitude < lowest) lowest = altitude;
			if (altitude > highest) highest = altitude;
		}
	}
	const range = { min: Math.floor(lowest), max: Math.ceil(highest) };

	const files = [];
	for (const [name, finestModel] of Object.entries(finest)) {
		let level = finestModel;
		for (const scale of SCALES.toReversed()) {
			if (scale !== FINEST) level = halve(level);
			const values = new Uint16Array(level.model.length);
			let [low, high] = [Infinity, -Infinity];
			for (let at = 0; at < values.length; at++) {
				const altitude = level.model[at];
				if (altitude < low) low = altitude;
				if (altitude > high) high = altitude;
				values[at] = Math.round(((altitude - range.min) / (range.max - range.min)) * 65535);
			}
			files.push({
				name: fileName(name, scale),
				bytes: littleEndian(values),
				details: {
					model: name,
					scale,
					width: level.columns,
					height: level.rows,
					encoding: 'uint16, little-endian, rows from north to south, columns from west to east',
					altitude: { ...range, formula: 'min + value / 65535 × (max − min), metres (IGN69)', lowest: Math.round(low * 100) / 100, highest: Math.round(high * 100) / 100 },
					extent: { west: longitudeAt(EXTENT.west), east: longitudeAt(EXTENT.east), south: latitudeAt(EXTENT.south), north: latitudeAt(EXTENT.north) },
					projection: 'the hero map’s: north up, a minute of longitude narrowed by the cosine of the marker’s latitude',
					marker: { x: -EXTENT.west * scale, y: -EXTENT.north * scale },
					metresPerPixel: { x: pixel.x / scale, y: pixel.y / scale },
				},
			});
		}
	}

	const indexFile = join(OUTPUT, 'index.json');
	const committed = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')).files : {};
	for (const file of files) file.details.sha256 = sha256(file.bytes);
	const changed = files.filter((file) => committed[file.name] && committed[file.name].sha256 !== file.details.sha256).map((file) => file.name);
	if (changed.length > 0 && !process.argv.includes('--refresh')) fail(`this run does not give the same files again (${changed.join(', ')}): nothing written. --refresh accepts them.`);

	const compress = { gzip: promisify(gzip), brotli: promisify(brotliCompress) };
	await Promise.all(
		files.map(async (file) => {
			// Brotli at its best takes minutes on the finest files: a file already weighed is not weighed again.
			if (committed[file.name]?.sha256 === file.details.sha256) {
				file.details.bytes = committed[file.name].bytes;
				return;
			}
			const [zipped, brotlied] = await Promise.all([
				compress.gzip(file.bytes, { level: 9 }),
				compress.brotli(file.bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: file.bytes.length } }),
			]);
			file.details.bytes = { raw: file.bytes.length, gzip: zipped.length, brotli: brotlied.length };
		}),
	);
	// The hash last, as the files already written list it.
	for (const file of files) {
		const { sha256: hash, ...details } = file.details;
		file.details = { ...details, sha256: hash };
	}

	const index = { dataset: await dataset(), files: Object.fromEntries(files.map((file) => [file.name, file.details])) };
	mkdirSync(OUTPUT, { recursive: true });
	const json = (value) => `${JSON.stringify(value, null, '\t')}\n`;
	for (const file of files) {
		writeFileSync(join(OUTPUT, `${file.name}.u16`), file.bytes);
		writeFileSync(join(OUTPUT, `${file.name}.json`), json(file.details));
	}
	writeFileSync(indexFile, json(index));
}

/** Reads the written files back: their size, their hash, and the altitudes of the spec's landmarks. */
function verify() {
	const indexFile = join(OUTPUT, 'index.json');
	if (!existsSync(indexFile)) fail(`nothing to verify: ${indexFile} is missing`);
	const index = JSON.parse(readFileSync(indexFile, 'utf8'));
	const errors = [];
	const readings = [];
	for (const [name, listed] of Object.entries(index.files)) {
		const file = join(OUTPUT, `${name}.u16`);
		if (!existsSync(file)) {
			errors.push(`${name}.u16 is missing`);
			continue;
		}
		const details = JSON.parse(readFileSync(join(OUTPUT, `${name}.json`), 'utf8'));
		const bytes = readFileSync(file);
		if (bytes.length !== details.width * details.height * 2) errors.push(`${name}: ${bytes.length} bytes for ${details.width}×${details.height} px`);
		if (sha256(bytes) !== listed.sha256 || details.sha256 !== listed.sha256) errors.push(`${name}: not the file the index lists`);
		const { min, max } = details.altitude;
		const altitudeAt = (column, row) => min + (bytes.readUInt16LE((row * details.width + column) * 2) / 65535) * (max - min);
		for (const landmark of LANDMARKS.filter((landmark) => landmark.model === details.model && (!landmark.finestOnly || details.scale === FINEST))) {
			const column = ((landmark.longitude - details.extent.west) / (details.extent.east - details.extent.west)) * details.width;
			const row = ((details.extent.north - landmark.latitude) / (details.extent.north - details.extent.south)) * details.height;
			const [reachX, reachY] = [landmark.radius / details.metresPerPixel.x, landmark.radius / details.metresPerPixel.y];
			const around = [];
			for (let y = Math.max(0, Math.ceil(row - reachY)); y <= Math.min(details.height - 1, row + reachY); y++) {
				for (let x = Math.max(0, Math.ceil(column - reachX)); x <= Math.min(details.width - 1, column + reachX); x++) {
					if (((x + 0.5 - column) / reachX) ** 2 + ((y + 0.5 - row) / reachY) ** 2 <= 1) around.push(altitudeAt(x, y));
				}
			}
			around.sort((a, b) => a - b);
			const altitude = landmark.read === 'median' ? around[around.length >> 1] : around.at(-1);
			readings.push({ file: name, landmark: landmark.name, expected: landmark.expected, read: Math.round(altitude * 10) / 10 });
			if (!(Math.abs(altitude - landmark.expected) <= landmark.tolerance)) errors.push(`${name}: ${landmark.name} at ${altitude?.toFixed(1)} m, expected ${landmark.expected} m ± ${landmark.tolerance}`);
		}
	}
	console.table(readings);
	if (errors.length > 0) fail(`verification failed\n  ${errors.join('\n  ')}`);
	return index;
}

/** The weights, as the ticket's table: the transferred weight is what a server compressing with Brotli sends. */
function report(index) {
	const megabytes = (bytes) => (bytes / 1e6).toFixed(2).replace('.', ',');
	const names = { ground: 'Sol nu', surface: 'Surface complète', built: 'Sol + bâti sans les arbres' };
	console.log('| Terrain | Finesse | Dimensions | Brut (Mo) | gzip (Mo) | Brotli (Mo) |');
	console.log('| --- | --- | --- | ---: | ---: | ---: |');
	for (const details of Object.values(index.files)) {
		const metres = ((details.metresPerPixel.x + details.metresPerPixel.y) / 2).toFixed(2).replace('.', ',');
		console.log(`| ${names[details.model]} | ×${details.scale} · ${metres} m/px | ${details.width} × ${details.height} | ${megabytes(details.bytes.raw)} | ${megabytes(details.bytes.gzip)} | ${megabytes(details.bytes.brotli)} |`);
	}
}

if (!process.argv.includes('--verify')) await build();
report(verify());
