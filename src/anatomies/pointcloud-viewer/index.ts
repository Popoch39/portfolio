// Anatomie de pointcloud-viewer : un scanner laser sur trépied relit `sample.laz` et dépose son
// nuage en spirale sur quatre dalles d'orthophoto. Fiche de concept : `concept.md`.
import type { Anatomy, Piece } from '../contract.ts';
import { renderRest, type Pieces } from './geometry.ts';
import { releve, SHA } from './model.ts';

const carte: Piece = {
	id: 'carte',
	name: 'Carte LAS/LAZ',
	role: 'Le fichier choisi. Un .las ou un .laz part au bake dans un Worker, un .bin déjà cuit s’ouvre sur place.',
	code: { path: 'src/hooks/use-bake.ts', lines: [78, 87] },
};
const boitier: Piece = {
	id: 'boitier',
	name: 'Boîtier scellé',
	role: 'Le Web Worker : il lit les octets du fichier, initialise le WebAssembly une seule fois, remonte la progression et rend le PCBK par transfert, sans copie.',
	code: { path: 'src/workers/bake-worker.ts', lines: [13, 37] },
};
const miroir: Piece = {
	id: 'miroir',
	name: 'Tambour du miroir',
	role: 'Le bake Rust compilé en WebAssembly : il parcourt les points du LAS/LAZ, les recentre sur le minimum par axe pour qu’ils restent précis en f32, puis écrit l’en-tête de 72 octets et les blocs planaires.',
	code: { path: 'webassembly/src/lib.rs', lines: [48, 132] },
	master: true,
};
const disque: Piece = {
	id: 'disque',
	name: 'Disque PCBK',
	role: 'Le format maison : vérifie le magic et la version, puis pose des vues TypedArray sur le buffer, sans rien décoder.',
	code: { path: 'src/lib/baked-pointcloud.ts', lines: [41, 91] },
};
const borne: Piece = {
	id: 'borne',
	name: 'Borne d’angle',
	role: 'L’ancre : seul le World Offset est reprojeté (proj4 vers WGS84, puis Mercator), et tout le nuage se place autour de lui.',
	code: { path: 'src/lib/map-anchor.ts', lines: [22, 46] },
};
const nuage: Piece = {
	id: 'nuage',
	name: 'Nuage de points',
	role: 'Le calque three.js sur le contexte WebGL de MapLibre : positions envoyées telles quelles, matrices composées en doubles à chaque image.',
	code: { path: 'src/lib/pointcloud-layer.ts', lines: [25, 121] },
};
const roue: Piece = {
	id: 'roue',
	name: 'Roue de filtres',
	role: 'Le mode de couleur (RGB, intensité, classification, altitude) : un uniform change, la géométrie reste.',
	code: { path: 'src/lib/pointcloud-shaders.ts', lines: [127, 156] },
};

export const PIECES: Pieces = { carte, boitier, miroir, disque, borne, nuage, roue };

export const anatomy: Anatomy = {
	content: {
		slug: 'pointcloud-viewer',
		sha: SHA,
		machine: 'Scanner laser sur trépied',
		lede: {
			before: 'Un nuage LiDAR lu en Rust compilé en WebAssembly, puis posé sur la carte par three.js : tout se passe dans le ',
			emphasis: 'navigateur',
			after: '.',
		},
		title: 'Un tour de tête, 628 points',
		consignes: {
			pointer: 'Visez le terrain : la tête tourne vers le pointeur · clic sur la roue : couleur',
			touch: 'Touchez le terrain : la tête tourne jusqu’au point · toucher la roue : couleur',
		},
		releve: releve.rest,
		caption:
			'Le scanner relit sample.laz, le fichier d’essai du dépôt : 100 000 points en spirale autour d’une station du 6ᵉ arrondissement, en Lambert-93. Chaque tour de tête lit 628 points. Le miroir, c’est-à-dire le bake Rust compilé en WebAssembly dans un Web Worker, recentre chaque point sur la borne d’angle, le minimum du nuage, pour qu’il reste précis en f32. Le disque reçoit alors le PCBK : 72 octets d’en-tête au moyeu, puis 18 octets par point, en quatre secteurs, un par bloc. Le bake fini, three.js pose tout le nuage d’un coup sur le fond IGN, et la roue en change les couleurs sans toucher à la géométrie. Un point dessiné en représente 40, et l’instrument n’est pas à l’échelle du terrain.',
		label:
			'Scanner laser sur un trépied haut et fin, planté sur quatre dalles d’orthophoto. Sa tête tourne et son miroir, en bleu, dépose une spirale de points qui se relève vers le bord du terrain ; la tête vise le pointeur, et un point du terrain touché l’attire. Une borne marque l’angle du nuage, un jalon l’angle opposé, et un disque gravé en quatre secteurs, posé sur un support fixé à une jambe, reçoit le fichier cuit. Flèches pour tourner la tête d’un huitième de tour, C pour changer de couleur.',
		pieces: [carte, boitier, miroir, disque, borne, nuage, roue],
		seo: {
			title: 'pointcloud-viewer · nuages LiDAR en Rust, WebAssembly et three.js',
			description:
				'Un scanner sur trépied explique pointcloud-viewer : un .laz lu en Rust compilé en WebAssembly dans un Web Worker, puis rendu en three.js sur la carte IGN.',
		},
	},
	renderRest: () => renderRest(PIECES),
};
