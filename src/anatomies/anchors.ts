// Ancrages des notes sur la figure au repos, relevés par `pnpm ancres` (`scripts/ancres.mjs`) dans
// `src/anatomies/<slug>/anchors.json`, dans les unités de la figure. Lu au build seulement.

/** Un point de la figure, en unités. */
export type Point = readonly [x: number, y: number];

export interface PieceAnchors {
	/** Les boîtes de la pièce (x, y, largeur, hauteur) : une par endroit où elle se trouve. */
	boxes: readonly (readonly [number, number, number, number])[];
	/** Son premier point visible en venant du haut, du bas, de la gauche et de la droite. */
	top: Point;
	bottom: Point;
	left: Point;
	right: Point;
	/** Le point visible le plus proche de son centre. */
	center: Point;
}

export interface Anchors {
	/** Empreinte de la figure mesurée (`figurePrint`) : le relevé ne vaut que pour elle. */
	print: string;
	width: number;
	height: number;
	pieces: Record<string, PieceAnchors>;
}

/**
 * Empreinte du corps de la figure au repos (FNV-1a sur 32 bits, deux passes) : change dès qu'un trait
 * de la figure change. Sans dépendance, elle se calcule pareil sous Node et au build.
 */
export function figurePrint(body: string) {
	const pass = (seed: number) => {
		let hash = seed;
		for (let i = 0; i < body.length; i++) hash = Math.imul(hash ^ body.charCodeAt(i), 0x01000193);
		return (hash >>> 0).toString(16).padStart(8, '0');
	};
	return pass(0x811c9dc5) + pass(0x050c5d1f);
}
