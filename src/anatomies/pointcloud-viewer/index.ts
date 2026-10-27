// Anatomie de pointcloud-viewer : un scanner laser sur trépied relit `sample.laz` et dépose son
// nuage en spirale sur quatre dalles d'orthophoto. Fiche de concept : `concept.md`.
import { localize } from '../../lib/i18n.ts';
import type { Anatomy, Piece } from '../contract.ts';
import { renderRest, type Pieces } from './geometry.ts';
import { releveOf, SHA } from './model.ts';

const carte: Piece = {
	id: 'carte',
	name: { fr: 'Carte LAS/LAZ', en: 'LAS/LAZ card' },
	role: {
		fr: 'Le fichier choisi. Un .las ou un .laz part au bake dans un Worker, un .bin déjà cuit s’ouvre sur place.',
		en: 'The chosen file. A .las or .laz goes off to be baked in a Worker; a .bin already baked opens on the spot.',
	},
	code: { path: 'src/hooks/use-bake.ts', lines: [78, 87] },
};
const boitier: Piece = {
	id: 'boitier',
	name: { fr: 'Boîtier scellé', en: 'Sealed housing' },
	role: {
		fr: 'Le Web Worker : il lit les octets du fichier, initialise le WebAssembly une seule fois, remonte la progression et rend le PCBK par transfert, sans copie.',
		en: 'The Web Worker: it reads the file’s bytes, initialises WebAssembly only once, reports progress and hands back the PCBK by transfer, without a copy.',
	},
	code: { path: 'src/workers/bake-worker.ts', lines: [13, 37] },
};
const miroir: Piece = {
	id: 'miroir',
	name: { fr: 'Tambour du miroir', en: 'Mirror drum' },
	role: {
		fr: 'Le bake Rust compilé en WebAssembly : il parcourt les points du LAS/LAZ, les recentre sur le minimum par axe pour qu’ils restent précis en f32, puis écrit l’en-tête de 72 octets et les blocs planaires.',
		en: 'The Rust bake compiled to WebAssembly: it walks through the points of the LAS/LAZ, re-centres them on the minimum of each axis so they stay precise in f32, then writes the 72-byte header and the planar blocks.',
	},
	code: { path: 'webassembly/src/lib.rs', lines: [48, 132] },
	master: true,
};
const disque: Piece = {
	id: 'disque',
	name: { fr: 'Disque PCBK', en: 'PCBK disc' },
	role: {
		fr: 'Le format maison : vérifie le magic et la version, puis pose des vues TypedArray sur le buffer, sans rien décoder.',
		en: 'The in-house format: checks the magic and the version, then lays TypedArray views over the buffer, decoding nothing.',
	},
	code: { path: 'src/lib/baked-pointcloud.ts', lines: [41, 91] },
};
const borne: Piece = {
	id: 'borne',
	name: { fr: 'Borne d’angle', en: 'Corner marker' },
	role: {
		fr: 'L’ancre : seul le World Offset est reprojeté (proj4 vers WGS84, puis Mercator), et tout le nuage se place autour de lui.',
		en: 'The anchor: only the World Offset is reprojected (proj4 to WGS84, then Mercator), and the whole cloud is placed around it.',
	},
	code: { path: 'src/lib/map-anchor.ts', lines: [22, 46] },
};
const nuage: Piece = {
	id: 'nuage',
	name: { fr: 'Nuage de points', en: 'Point cloud' },
	role: {
		fr: 'Le calque three.js sur le contexte WebGL de MapLibre : positions envoyées telles quelles, matrices composées en doubles à chaque image.',
		en: 'The three.js layer on MapLibre’s WebGL context: positions sent as they are, matrices composed in doubles on every frame.',
	},
	code: { path: 'src/lib/pointcloud-layer.ts', lines: [25, 121] },
};
const roue: Piece = {
	id: 'roue',
	name: { fr: 'Roue de filtres', en: 'Filter wheel' },
	role: {
		fr: 'Le mode de couleur (RGB, intensité, classification, altitude) : un uniform change, la géométrie reste.',
		en: 'The colour mode (RGB, intensity, classification, altitude): one uniform changes, the geometry stays.',
	},
	code: { path: 'src/lib/pointcloud-shaders.ts', lines: [127, 156] },
};

export const PIECES: Pieces = { carte, boitier, miroir, disque, borne, nuage, roue };

export const anatomy: Anatomy = {
	content: {
		slug: 'pointcloud-viewer',
		sha: SHA,
		machine: { fr: 'Scanner laser sur trépied', en: 'Laser scanner on a tripod' },
		lede: {
			before: {
				fr: 'Un nuage LiDAR lu en Rust compilé en WebAssembly, puis posé sur la carte par three.js : tout se passe dans le ',
				en: 'A LiDAR cloud read by Rust compiled to WebAssembly, then laid on the map by three.js: it all happens in the ',
			},
			emphasis: { fr: 'navigateur', en: 'browser' },
			after: { fr: '.', en: '.' },
		},
		title: { fr: 'Un tour de tête, 628 points', en: 'One turn of the head, 628 points' },
		consignes: {
			pointer: {
				fr: 'Visez le terrain : la tête tourne vers le pointeur · clic sur la roue : couleur',
				en: 'Aim at the ground: the head turns towards the pointer · click the wheel: colour',
			},
			touch: {
				fr: 'Touchez le terrain : la tête tourne jusqu’au point · toucher la roue : couleur',
				en: 'Touch the ground: the head turns as far as the point · tap the wheel: colour',
			},
		},
		releve: localize((locale) => releveOf(locale).rest),
		caption: {
			fr: 'Le scanner relit sample.laz, le fichier d’essai du dépôt : 100 000 points en spirale autour d’une station du 6ᵉ arrondissement, en Lambert-93. Chaque tour de tête lit 628 points. Le miroir, c’est-à-dire le bake Rust compilé en WebAssembly dans un Web Worker, recentre chaque point sur la borne d’angle, le minimum du nuage, pour qu’il reste précis en f32. Le disque reçoit alors le PCBK : 72 octets d’en-tête au moyeu, puis 18 octets par point, en quatre secteurs, un par bloc. Le bake fini, three.js pose tout le nuage d’un coup sur le fond IGN, et la roue en change les couleurs sans toucher à la géométrie. Un point dessiné en représente 40, et l’instrument n’est pas à l’échelle du terrain.',
			en: 'The scanner rereads sample.laz, the repository’s test file: 100,000 points in a spiral around a station in Paris’s 6th arrondissement, in Lambert-93. Each turn of the head reads 628 points. The mirror, that is the Rust bake compiled to WebAssembly in a Web Worker, re-centres every point on the corner marker, the cloud’s minimum, so that it stays precise in f32. The disc then receives the PCBK: a 72-byte header at the hub, then 18 bytes per point, in four sectors, one per block. Once the bake is done, three.js lays the whole cloud at once on the IGN base map, and the wheel changes its colours without touching the geometry. Each drawn point stands for 40, and the instrument is not to the scale of the ground.',
		},
		label: {
			fr: 'Scanner laser sur un trépied haut et fin, planté sur quatre dalles d’orthophoto. Sa tête tourne et son miroir, en bleu, dépose une spirale de points qui se relève vers le bord du terrain ; la tête vise le pointeur, et un point du terrain touché l’attire. Une borne marque l’angle du nuage, un jalon l’angle opposé, et un disque gravé en quatre secteurs, posé sur un support fixé à une jambe, reçoit le fichier cuit. Flèches pour tourner la tête d’un huitième de tour, C pour changer de couleur.',
			en: 'Laser scanner on a tall, slender tripod, standing on four orthophoto tiles. Its head turns and its mirror, in blue, lays down a spiral of points that rises towards the edge of the ground; the head aims at the pointer, and a point touched on the ground draws it round. A marker stands at the corner of the cloud, a ranging pole at the opposite corner, and a disc engraved in four sectors, set on a bracket fixed to one leg, receives the baked file. Arrow keys turn the head an eighth of a turn, C changes the colour.',
		},
		pieces: [carte, boitier, miroir, disque, borne, nuage, roue],
		seo: {
			title: {
				fr: 'pointcloud-viewer · nuages LiDAR en Rust, WebAssembly et three.js',
				en: 'pointcloud-viewer · LiDAR clouds in Rust, WebAssembly and three.js',
			},
			description: {
				fr: 'Un scanner sur trépied explique pointcloud-viewer : un .laz lu en Rust compilé en WebAssembly dans un Web Worker, puis rendu en three.js sur la carte IGN.',
				en: 'A scanner on a tripod explains pointcloud-viewer: a .laz read by Rust compiled to WebAssembly in a Web Worker, then rendered with three.js on the IGN map.',
			},
		},
	},
	renderRest: () => renderRest(PIECES),
};
