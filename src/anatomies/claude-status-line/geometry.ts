// Géométrie au repos de la rampe à cadran. Chaque pièce dessinée devient un élément avec sa forme
// vraie (pour l'audit du kit et l'ordre de peinture, réglé d'après la profondeur mesurée : voir
// `order.mjs`). Elle tourne au build Astro et sous Node (`audit.mjs`).
import {
	cylinder,
	dotsSvg,
	faceTextSvg,
	iso,
	lineOnTop,
	lineSvg,
	pathOf,
	ring as ringOnTop,
	sideMatrix,
	sideSeam,
	slabOf,
	solidSvg,
	translateAlong,
	type Flat,
	type Plan,
	type Point3,
	type SolidStyle,
	type Tone,
} from '../../vendor/anatomy/iso-kit.ts';
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubeSvg } from '../../vendor/anatomy/tube.mjs';
import { boltCircle, fadedRibs, pointOf, tubeChunks, turnedShape } from './kit.mjs';
import * as A from '../../vendor/anatomy/audit.mjs';
import type { Piece } from '../contract.ts';
import { pieces } from './content.ts';
import { bar, cacheLevel, poseAt, REST } from './model.ts';
import * as Lay from './layout.ts';
import {
	bladeSvg,
	CENTRES,
	CROSS_R,
	crankAt,
	CROSS_AT,
	damperOut,
	DRIVER_AT,
	driverAngle,
	drumChars,
	hammerSvg,
	knurlSvg,
	leverSvg,
	leverTip,
	linkAngle,
	linkSvg,
	needleAngle,
	pinionAngle,
	probeCoil,
	RING_INDEX,
	ringTicksSvg,
	rodTravel,
	spokePolygons,
	SPOKES_Y,
	spokesSvg,
	witnessSvg,
} from './parts.ts';

const P = Lay.projection;
const piece = (id: string) => pieces.find((p) => p.id === id) as Piece;

export interface Item {
	name: string;
	piece?: Piece;
	at: Point3;
	bias?: number;
	svg: string;
	// Formes du kit d'audit (`audit.mjs`), en unités du monde.
	shapes: object[];
	route?: string;
	chunk?: number;
}

export interface Route {
	name: string;
	points: Point3[];
	r: number;
	gaps: [number, number][];
	piece?: Piece;
	/** Propriétaire commun aux tronçons d'une même ligne et à ses brides, colliers et coudes. */
	owner?: string;
}

/** Préfixe des identifiants SVG : plusieurs figures coexistent dans l'aperçu de l'accueil. */
export const ID = 'claude-status-line';

const S = (paths: Parameters<typeof solidSvg>[0], style?: SolidStyle) => solidSvg(paths, style);
const L = (d: string, style?: Parameters<typeof lineSvg>[1]) => lineSvg(d, style);
const D = (points: Parameters<typeof dotsSvg>[0], style?: Parameters<typeof dotsSvg>[1]) => dotsSvg(points, style);
const at = (p: Point3) => iso(p, P);
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, meta: object) => A.box([x0, y0, z0], [x1, y1, z1], meta);
const plan = (x0: number, x1: number, y0: number, y1: number, r = 0.6): Plan => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

/** Repère d'un axe selon +y, avec u = +x et v = −z : un point local (u, w) est (x + u, ·, z − w). */
const alongY = (x: number, y: number, z: number) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, -1]);
/** Transformation d'un dessin à plat dans le plan vertical y : coordonnées locales (x, −z). */
const face = (y: number) => sideMatrix([0, y], 0, P, 'left');
/** Arc ou cercle dans un plan de face, en coordonnées locales, angle depuis le haut, sens horaire. */
const polar = (cx: number, cw: number, r: number, deg: number): Flat => [cx + r * Math.sin((deg * Math.PI) / 180), cw - r * Math.cos((deg * Math.PI) / 180)];
const arcPath = (cx: number, cw: number, r: number, from: number, to: number, closed = false) => {
	// Un point tous les 1,2 px environ le long de l'arc, et au moins douze par tour.
	const count = Math.max(Math.ceil(Math.abs(to - from) / 30), Math.ceil((Math.abs(to - from) * Math.PI * r * G.scaleOf(P)) / 180 / 1.2));
	return pathOf(Array.from({ length: count + 1 }, (_, i) => polar(cx, cw, r, from + ((to - from) * i) / count)), closed);
};
const localPath = (points: Flat[], closed = false) => pathOf(points, closed);

// Pièces tournées : des facettes de tons d'environ 6 px à l'écran (les contours, eux, suivent le
// vrai cercle), pour tenir le budget du SVG.
type Frame = ReturnType<typeof G.frameOf>;
const stepsOf = (r: number) => Math.max(10, Math.min(40, Math.ceil((2 * Math.PI * r * G.scaleOf(P)) / 6)));
const disc = (s0: number, s1: number, r: number, F: Frame, _P: unknown, options: object = {}) => G.disc(s0, s1, r, F, P, { steps: stepsOf(r), ...options });
const ringBand = (s0: number, s1: number, rIn: number, rOut: number, F: Frame, _P: unknown, options: object = {}) => G.ringBand(s0, s1, rIn, rOut, F, P, { steps: stepsOf(rOut), ...options });
const solidOf = (profile: number[][], F: Frame, _P: unknown, options: object = {}) => G.solidOf(profile, F, P, { steps: stepsOf(Math.max(...profile.map(([, r]) => r))), ...options });
/** Une bague percée : son remplissage (contour et trou) se peint en pair-impair pour laisser voir à travers. */
const ringSvg = (paths: Parameters<typeof solidSvg>[0], style?: SolidStyle) => S(paths, style).replace('<path class="iso-fill"', '<path class="iso-fill" fill-rule="evenodd"');
const sphereOf = (centre: Point3, r: number, _P: unknown) => G.sphereOf(centre, r, P, { steps: Math.max(16, Math.min(48, stepsOf(r))) });

/**
 * Les éléments de la figure à l'instant simulé `t` (minutes), aiguilles arrivées : la pose au
 * repos pour le site, d'autres poses pour l'audit des pièces mobiles.
 */
export function build(t = REST) {
	const items: Item[] = [];
	const routes: Route[] = [];
	const put = (name: string, id: string | null, center: Point3, svg: string, shapes: object[], extra: Partial<Item> = {}) =>
		items.push({ name, piece: id ? piece(id) : undefined, at: center, svg, shapes, ...extra });
	const rest = poseAt(t);

	// --- Tablette, chant et vis -------------------------------------------------------------------
	const T = Lay.TABLET;
	const tabletScrews: [number, number][] = [
		[T.x + 6, T.y + 8],
		[T.x + 6, -7],
		[T.x + T.w - 6, T.y + 8],
		[T.x + T.w - 6, -7],
	];
	put(
		'stand.tablet',
		null,
		[T.x + T.w / 2, T.y + T.d / 2, -4],
		S(slabOf(T, Lay.TABLET_Z, -Lay.TABLET_Z, P, 4, 0.8), {
			tone: 'lo',
			inner: L(lineOnTop([T.x, -4], [T.x + T.w, -4], 0, P), { tone: 'faint' }),
		}) +
			L(tabletScrews.map(([x, y]) => ringOnTop(x, y, 2.2, 0, P, 18)).join(''), { tone: 'lo' }) +
			D(tabletScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }),
		[A.slab(T, Lay.TABLET_Z, -Lay.TABLET_Z, { name: 'stand.tablet' }, 4)],
		{ bias: -40 },
	);
	put('stand.chant', null, [T.x + T.w / 2, 0.5, -4], S(slabOf(Lay.CHANT, Lay.TABLET_Z, -Lay.TABLET_Z, P, 2, 0.4), { tone: 'mid' }), [A.slab(Lay.CHANT, Lay.TABLET_Z, -Lay.TABLET_Z, { name: 'stand.chant' }, 2)]);

	// --- Brides en C ------------------------------------------------------------------------------
	Lay.CLAMPS.forEach((cx, index) => {
		const owner = `bride-${index}`;
		const meta = (name: string) => ({ name: `${owner}.${name}`, owner });
		const x0 = cx - Lay.CLAMP_W / 2;
		const x1 = cx + Lay.CLAMP_W / 2;
		const spine = plan(x0, x1, Lay.SPINE_Y[0], Lay.SPINE_Y[1], 0.5);
		put(`${owner}.spine`, null, [cx, 2, 0], S(slabOf(spine, Lay.JAW_LOW[0], Lay.RAIL_H - Lay.JAW_LOW[0], P, 2, 0.4), { tone: 'mid' }), [A.slab(spine, Lay.JAW_LOW[0], Lay.RAIL_H - Lay.JAW_LOW[0], meta('spine'), 2)]);
		// La mâchoire du haut, sur la tablette, reste cachée derrière la rampe : elle n'est pas dessinée.
		const jaw = plan(x0, x1, Lay.JAW_Y[0], Lay.JAW_Y[1], 0.8);
		const low = Lay.JAW_LOW;
		put(
			`${owner}.jaw-low`,
			null,
			[cx, -8, (low[0] + low[1]) / 2],
			S(slabOf(jaw, low[0], low[1] - low[0], P, 2, 0.4), { tone: 'mid', inner: L(sideSeam(jaw, (low[0] + low[1]) / 2, P, 2), { tone: 'faint' }) }),
			[A.slab(jaw, low[0], low[1] - low[0], meta('jaw-low'), 2)],
		);
		const sy = Lay.SCREW_Y;
		// Vis de serrage : tige sous la mâchoire, tige au-dessus, patin rotulé contre la tablette.
		const hubTop = Lay.HANDLE_Z + 0.8;
		put(`${owner}.screw-low`, null, [cx, sy, (hubTop + low[0]) / 2], S(cylinder(cx, sy, 1.5, hubTop, low[0] - hubTop, P, 12), { tone: 'mid', crease: 'none' }), [A.cylinder(cx, sy, 1.5, hubTop, low[0] - hubTop, meta('screw-low'))]);
		put(`${owner}.screw-up`, null, [cx, sy, -13], S(cylinder(cx, sy, 1.5, low[1], -10 - low[1], P, 12), { tone: 'mid', crease: 'none' }), [A.cylinder(cx, sy, 1.5, low[1], -10 - low[1], meta('screw-up'))]);
		// Patin rotulé : la rotule sous le patin qui porte contre la tablette.
		put(`${owner}.pad`, null, [cx, sy, -9], S(cylinder(cx, sy, 3.2, -10, 2, P, 16, 0.3), { tone: 'mid' }), [A.cylinder(cx, sy, 3.2, -10, 2, meta('pad'))], { bias: 0.2 });
		// Poignée en T : moyeu sur la tige, deux bras dont le bord se pose sur le moyeu.
		const seat = Math.sqrt(2.2 ** 2 - 1.2 ** 2);
		const arm: [number, number][] = [[0, 1.2], [6.6, 1.2]];
		const hub = A.cylinder(cx, sy, 2.2, Lay.HANDLE_Z - 3.2, 4, meta('hub'));
		for (const side of [-1, 1]) {
			const F = G.frameAlong([cx + side * seat, sy, Lay.HANDLE_Z - 1.2], [side, 0, 0]);
			put(`${owner}.bar${side}`, null, [cx + side * 5, sy, Lay.HANDLE_Z - 1.2], S(disc(0, 6.6, 1.2, F, P), { tone: 'mid' }), [turnedShape(F, arm, { ...meta(`bar${side}`), seated: true, cut: [hub] })]);
		}
		put(`${owner}.hub`, null, [cx, sy, Lay.HANDLE_Z - 1.2], S(cylinder(cx, sy, 2.2, Lay.HANDLE_Z - 3.2, 4, P, 16), { tone: 'mid' }), [hub], { bias: 0.3 });
	});

	// --- Rampe : profilé, rainure en T, embout gauche, goujons ----------------------------------------
	const R = Lay.RAIL;
	const W = Lay.WINDOW;
	const rampe = (name: string) => ({ name: `rampe.${name}`, owner: 'rampe' });
	const tSlot = [9.6, 14.4].map((y) => lineOnTop([R.x, y], [R.x + R.w, y], Lay.RAIL_H, P)).join('');
	put(
		'rampe.profile',
		'rampe',
		[R.x + R.w / 2, R.y + R.d / 2, Lay.RAIL_H / 2],
		S(slabOf(R, 0, Lay.RAIL_H, P, 3, 0.8), { tone: 'mid', inner: L(tSlot, { tone: 'faint' }) }),
		[
			box(R.x, R.y, 0, R.x + R.w, Lay.RECESS, Lay.RAIL_H, rampe('core')),
			box(R.x, Lay.RECESS, 0, W.x0, Lay.FRONT, Lay.RAIL_H, rampe('skin-left')),
			box(W.x1, Lay.RECESS, 0, R.x + R.w, Lay.FRONT, Lay.RAIL_H, rampe('skin-right')),
			box(W.x0, Lay.RECESS, 0, W.x1, Lay.FRONT, W.z0, rampe('skin-low')),
			box(W.x0, Lay.RECESS, W.z1, W.x1, Lay.FRONT, Lay.RAIL_H, rampe('skin-high')),
		],
		{ bias: -6 },
	);
	const cap = Lay.CAP_LEFT;
	const capZ = Lay.CAP_LEFT_Z;
	put(
		'rampe.cap-left',
		'rampe',
		[cap.x + cap.w / 2, cap.y + cap.d / 2, 12],
		S(slabOf(cap, capZ[0], capZ[1] - capZ[0], P, 2, 0.4), { tone: 'mid' }) + D([2.5, 9, 16, 22.5].map((z) => at([cap.x + cap.w / 2, cap.y + cap.d, z])), { size: 0.45 }),
		[A.slab(cap, capZ[0], capZ[1] - capZ[0], rampe('cap-left'), 2)],
	);
	Lay.STUDS.forEach((x) => {
		put(
			'rampe.stud',
			'rampe',
			[x, 12, Lay.RAIL_H + 1.5],
			S(cylinder(x, 12, 2.6, Lay.RAIL_H, 3, P, 18, 0.5), { tone: 'hi', crease: 'lo' }) + D([at([x, 12, Lay.RAIL_H + 3])], { size: 0.5, tone: 'hi' }),
			[A.cylinder(x, 12, 2.6, Lay.RAIL_H, 3, rampe(`stud${x}`))],
		);
	});

	// --- Plaques du modèle et du dossier, étiquette de branche ---------------------------------------
	const plate = (name: string, p: { x0: number; x1: number; z0: number; z1: number }, rules: number[]) => {
		const pl = plan(p.x0, p.x1, Lay.FRONT, Lay.FRONT + 1, 0.6);
		const zMid = (p.z0 + p.z1) / 2;
		const fy = Lay.FRONT + 1;
		const lines = rules
			.map((share, row) => {
				const z = p.z1 - 4.2 - row * 3.4;
				return pathOf([at([p.x0 + 4, fy, z]), at([p.x0 + 4 + (p.x1 - p.x0 - 8) * share, fy, z])]);
			})
			.join('');
		put(
			`rampe.${name}`,
			'rampe',
			[(p.x0 + p.x1) / 2, Lay.FRONT + 0.5, zMid],
			S(slabOf(pl, p.z0, p.z1 - p.z0, P, 2, 0.3), { tone: 'hi', crease: 'lo' }) +
				L(lines, { tone: 'mid', free: true }) +
				D([at([p.x0 + 2, fy, zMid]), at([p.x1 - 2, fy, zMid])], { size: 0.45 }),
			[A.slab(pl, p.z0, p.z1 - p.z0, rampe(name), 2)],
		);
	};
	plate('model', Lay.MODEL_PLATE, [0.7, 0.45]);
	plate('folder', Lay.FOLDER_PLATE, [0.55, 0.8, 0.35]);
	{
		const tag = Lay.TAG;
		const pl = plan(tag.x0, tag.x1, Lay.FRONT, Lay.FRONT + 0.6, 1.2);
		const cx = (tag.x0 + tag.x1) / 2;
		const fy = Lay.FRONT + 0.6;
		// L'anneau relie le bas de la plaque du dossier au trou de l'étiquette.
		const ringTop = Lay.FOLDER_PLATE.z0 + 0.4;
		const ringLow = tag.z1 - 1.4;
		const ring = localPath(Array.from({ length: 32 }, (_, i) => [cx + 1.6 * Math.sin((i / 32) * 2 * Math.PI), -(ringTop + ringLow) / 2 + ((ringTop - ringLow) / 2) * Math.cos((i / 32) * 2 * Math.PI)] as Flat), true);
		put(
			'rampe.tag',
			'rampe',
			[cx, Lay.FRONT + 0.3, (tag.z0 + tag.z1) / 2],
			S(slabOf(pl, tag.z0, tag.z1 - tag.z0, P, 3, 0.2), { tone: 'hi', crease: 'lo' }) +
				`<g transform="${face(fy + 0.2)}">${L(ring, { tone: 'mid' })}</g>` +
				L(pathOf([at([tag.x0 + 2.4, fy, tag.z0 + 3]), at([tag.x1 - 3, fy, tag.z0 + 3])]), { tone: 'mid', free: true }),
			[A.slab(pl, tag.z0, tag.z1 - tag.z0, rampe('tag'), 3), A.box([cx - 1.8, Lay.FRONT, tag.z1], [cx + 1.8, Lay.FRONT + 0.8, Lay.FOLDER_PLATE.z0], rampe('tag-ring'))],
		);
	}

	// --- Fenêtre vitrée : fond, tiges, pignons, vitre et cadre -----------------------------------------
	const clipWindow = `${ID}-window`;
	// Chaque élément vu par la vitre porte sa propre copie de la découpe : l'audit lit chaque élément seul.
	const throughGlass = (name: string, content: string) => `<defs><clipPath id="${clipWindow}-${name}"><path d="${opening}"/></clipPath></defs><g clip-path="url(#${clipWindow}-${name})">${content}</g>`;
	const opening = pathOf([at([W.x0, Lay.FRONT, W.z0]), at([W.x1, Lay.FRONT, W.z0]), at([W.x1, Lay.FRONT, W.z1]), at([W.x0, Lay.FRONT, W.z1])], true);
	{
		const back = pathOf([at([W.x0, Lay.RECESS, W.z0]), at([W.x1, Lay.RECESS, W.z0]), at([W.x1, Lay.RECESS, W.z1]), at([W.x0, Lay.RECESS, W.z1])], true);
		const sill = pathOf([at([W.x0, Lay.RECESS, W.z0]), at([W.x1, Lay.RECESS, W.z0]), at([W.x1, Lay.FRONT, W.z0]), at([W.x0, Lay.FRONT, W.z0])], true);
		const wall = pathOf([at([W.x0, Lay.RECESS, W.z0]), at([W.x0, Lay.RECESS, W.z1]), at([W.x0, Lay.FRONT, W.z1]), at([W.x0, Lay.FRONT, W.z0])], true);
		put(
			'rampe.window-back',
			'rampe',
			[(W.x0 + W.x1) / 2, Lay.RECESS, (W.z0 + W.z1) / 2],
			`<defs><clipPath id="${clipWindow}"><path d="${opening}"/></clipPath></defs><g clip-path="url(#${clipWindow})"><path class="iso-shade" data-shade="1" d="${back}"/><path class="iso-shade" data-shade="3" d="${sill}"/><path class="iso-shade" data-shade="2" d="${wall}"/></g>`,
			// Le fond est enregistré comme une plaque mince posée sur le fond de l'ouverture, en retrait des parois.
			[box(W.x0 + 1, Lay.RECESS, W.z0 + 1, W.x1 - 8, Lay.RECESS + 0.6, W.z1 - 1, rampe('window-back'))],
		);
	}
	// Tiges de pourcentage : une came par case, au pas de 6 (10 % de course), sous le peigne de leur module.
	const rodMeta = (name: string) => ({ name: `rampe.${name}`, owner: 'rampe' });
	Lay.RODS_Z.forEach((z, index) => {
		const key = index === 0 ? 'five' : 'week';
		const travel = rodTravel(index === 0 ? rest.output.five.pct : rest.output.week.pct);
		const F = G.frameAlong([Lay.ROD_X[0], Lay.ROD_Y, z], [1, 0, 0]);
		const length = Lay.ROD_X[1] - Lay.ROD_X[0];
		const firstBlade = Lay.MODULES[index] + Lay.BLADE_FIRST;
		const cams = Array.from({ length: 10 }, (_, k) => firstBlade + 6 * (k + 1) - 9);
		const camPaths = cams.map((x) => {
			const poly: [number, number][] = [
				[-1.4, -Lay.ROD_R + 0.2],
				[1.4, -Lay.ROD_R + 0.2],
				[0.7, -Lay.ROD_R - 1.2],
				[-0.7, -Lay.ROD_R - 1.2],
			];
			// Vue de face, une came est un trapèze sur le dos de la tige : dessinée à plat devant elle.
			const flat = localPath(poly.map(([u, w]) => [x + u, -z + w] as Flat), true);
			return { svg: `<path class="iso-top" d="${flat}"/>${L(flat, { tone: 'hi' })}`, shape: A.prism(alongY(x + travel, Lay.ROD_Y - 0.9, z), poly, 0, 1.8, rodMeta(`cam-${key}-${x}`)) };
		});
		// Crémaillère : dents sur le dessus (5h) ou le dessous (sem), devant le pignon de l'aiguille.
		const pinion = Lay.PINIONS[index];
		const up = pinion.z > z;
		const teeth: string[] = [];
		for (let x = pinion.x - Lay.TRAVEL - 6; x <= pinion.x + 4; x += 2.1) {
			const zz = up ? z + Lay.ROD_R : z - Lay.ROD_R;
			const tip = up ? zz + 0.8 : zz - 0.8;
			teeth.push(pathOf([at([x - 0.5, Lay.ROD_Y + Lay.ROD_R, zz]), at([x - 0.2, Lay.ROD_Y + Lay.ROD_R, tip]), at([x + 0.2, Lay.ROD_Y + Lay.ROD_R, tip]), at([x + 0.5, Lay.ROD_Y + Lay.ROD_R, zz])]));
		}
		put(
			`rampe.rod-${key}`,
			null,
			[(W.x0 + W.x1) / 2, Lay.ROD_Y, z],
			throughGlass(`rod-${key}`, `<g data-csl="rod-${key}"${travel ? ` transform="${translateAlong(P, [travel, 0, 0])}"` : ''}>${S(disc(0, length, Lay.ROD_R, F, P), { tone: 'hi', crease: 'lo' })}<g transform="${face(Lay.ROD_Y + 0.9)}">${camPaths.map((c) => c.svg).join('')}</g>${L(teeth.join(''), { tone: 'mid' })}</g>`),
			// Seule la portion vue par la vitre est enregistrée : le reste court dans le profilé.
			// (moins les bords que les parois de l'ouverture masquent en vue oblique).
			[A.disc(G.frameAlong([0, Lay.ROD_Y, z], [1, 0, 0]), W.x0 + 2, W.x1 - 8, Lay.ROD_R, rodMeta(`rod-${key}`)), ...camPaths.map((c) => c.shape)],
		);
		// Pignon de l'axe des aiguilles, à plat derrière la vitre.
		const teethPath = (() => {
			const count = 12;
			const pts: Flat[] = [];
			for (let i = 0; i < count * 4; i++) {
				const a = (i / (count * 4)) * 360;
				const r = i % 4 === 1 || i % 4 === 2 ? Lay.PINION_R : Lay.PINION_R - 0.7;
				pts.push(polar(pinion.x, -pinion.z, r, a));
			}
			return localPath(pts, true);
		})();
		put(
			`cadran.pinion-${key}`,
			'cadran',
			[pinion.x, Lay.ROD_Y, pinion.z],
			`<g transform="${face(Lay.ROD_Y + 0.4)}"><g data-csl="pinion-${key}" transform="rotate(${round(pinionAngle(index, travel))} ${pinion.x} ${-pinion.z})"><path class="iso-fill" d="${teethPath}"/><path class="iso-shade" data-shade="2" d="${teethPath}"/>${L(teethPath, { tone: 'hi' })}${L(arcPath(pinion.x, -pinion.z, 0.9, 0, 360, true), { tone: 'mid' })}${L(localPath([polar(pinion.x, -pinion.z, 0.9, 0), polar(pinion.x, -pinion.z, Lay.PINION_R - 0.7, 0)]), { tone: 'lo' })}</g></g>`,
			[A.disc(alongY(pinion.x, Lay.ROD_Y - 0.6, pinion.z), 0, 1, Lay.PINION_R, rodMeta(`pinion-${key}`))],
			{ bias: 0.4 },
		);
	});
	{
		// Vitre : deux reflets obliques, puis le cadre et ses joncs qui bouclent aux coins.
		const reflections = [0.18, 0.24, 0.62]
			.map((share) => {
				const x = W.x0 + (W.x1 - W.x0) * share;
				return pathOf([at([x, Lay.FRONT - 0.4, W.z0 - 1]), at([x + 14, Lay.FRONT - 0.4, W.z1 + 1])]);
			})
			.join('');
		const F = (x: number, z: number) => alongY(x, Lay.FRONT, z);
		const bars: { F: ReturnType<typeof F>; poly: [number, number][] }[] = [
			{ F: F(W.x0 - Lay.FRAME, W.z1), poly: [[0, -Lay.FRAME], [W.x1 - W.x0 + 2 * Lay.FRAME, -Lay.FRAME], [W.x1 - W.x0 + 2 * Lay.FRAME, 0], [0, 0]] },
			{ F: F(W.x0 - Lay.FRAME, W.z0), poly: [[0, 0], [W.x1 - W.x0 + 2 * Lay.FRAME, 0], [W.x1 - W.x0 + 2 * Lay.FRAME, Lay.FRAME], [0, Lay.FRAME]] },
			{ F: F(W.x0 - Lay.FRAME, W.z1), poly: [[0, 0], [Lay.FRAME, 0], [Lay.FRAME, W.z1 - W.z0], [0, W.z1 - W.z0]] },
			{ F: F(W.x1, W.z1), poly: [[0, 0], [Lay.FRAME, 0], [Lay.FRAME, W.z1 - W.z0], [0, W.z1 - W.z0]] },
		];
		const beads = pathOf(
			G.hullOf([
				at([W.x0 + 1.2, Lay.FRONT - 0.2, W.z0 + 1.2]),
				at([W.x1 - 1.2, Lay.FRONT - 0.2, W.z0 + 1.2]),
				at([W.x1 - 1.2, Lay.FRONT - 0.2, W.z1 - 1.2]),
				at([W.x0 + 1.2, Lay.FRONT - 0.2, W.z1 - 1.2]),
			]),
			true,
		);
		put(
			'rampe.window-frame',
			'rampe',
			[(W.x0 + W.x1) / 2, Lay.FRONT + 0.5, (W.z0 + W.z1) / 2],
			`${throughGlass('glass', L(reflections, { tone: 'faint' }))}${L(beads, { tone: 'lo' })}${bars.map((b) => S(G.prismOf(b.F, b.poly, 0, 1, P), { tone: 'mid' })).join('')}`,
			bars.map((b, i) => A.prism(b.F, b.poly, 0, 1, rampe(`frame-${i}`))),
		);
	}

	// --- Tête d'aiguillage ----------------------------------------------------------------------------
	const H = Lay.HEAD;
	const [hz0, hz1] = Lay.HEAD_Z;
	const aig = (name: string) => ({ name: `aiguillage.${name}`, owner: 'aiguillage' });
	put(
		'aiguillage.body',
		'aiguillage',
		[H.x + H.w / 2, H.y + H.d / 2, (hz0 + hz1) / 2],
		S(slabOf(H, hz0, hz1 - hz0, P, 4, 0.8), { tone: 'mid', inner: L(sideSeam(H, 6, P, 4), { tone: 'faint' }) }) +
			D(
				[
					[H.x + 3.4, 2.4],
					[H.x + H.w - 3.4, 2.4],
					[H.x + 3.4, 40],
					[H.x + H.w - 3.4, 40],
				].map(([x, z]) => at([x, Lay.HEAD_FRONT, z])),
				{ size: 0.5 },
			),
		[A.slab(H, hz0, hz1 - hz0, aig('body'), 4)],
	);
	{
		const [px, pz] = Lay.PLUG;
		const Fc = alongY(px, Lay.HEAD_FRONT, pz);
		const holes = Lay.DETENTS.map((deg) => G.circleOf(G.frameOf(add(Fc.o, [Math.sin((deg * Math.PI) / 180) * 9.75, 0, Math.cos((deg * Math.PI) / 180) * 9.75]), [0, 1, 0], [1, 0, 0], [0, 0, -1]), 3, 0.7, P, 16)).join('');
		put('aiguillage.collar', 'aiguillage', [px, Lay.HEAD_FRONT + 1.5, pz], S(disc(0, 3, Lay.COLLAR_R, Fc, P), { tone: 'mid', inner: '' }) + L(holes, { tone: 'mid' }), [A.disc(Fc, 0, 3, Lay.COLLAR_R, aig('collar'))]);
		put(
			'aiguillage.plug',
			'aiguillage',
			[px, Lay.HEAD_FRONT + 4.5, pz],
			S(disc(3, 6, Lay.PLUG_R, Fc, P), { tone: 'hi', crease: 'lo' }) + L(G.circleOf(Fc, 6, Lay.PLUG_R - 1.6, P), { tone: 'faint' }),
			[A.disc(Fc, 3, 6, Lay.PLUG_R, aig('plug'))],
		);
		const angle = Lay.DETENTS[rest.lever];
		put('aiguillage.lever', 'aiguillage', [px, Lay.LEVER_Y[0] + 0.8, pz], `<g data-csl="lever">${leverSvg(angle)}</g>`, [A.prism(alongY(px, 0, pz), [[-1.6, 2.2], [1.6, 2.2], [1.1, -Lay.LEVER_LEN], [-1.1, -Lay.LEVER_LEN]].map(([u, w]) => turn2(u, w, angle)), Lay.LEVER_Y[0], Lay.LEVER_Y[1], aig('lever'))], { bias: 0.3 });
		const tip = leverTip(angle);
		put('aiguillage.ball', 'aiguillage', tip, `<g data-csl="lever-ball" transform="${translateAlong(P, sub(tip, leverTip(0)))}">${S(sphereOf(leverTip(0), Lay.BALL_R, P), { tone: 'hi', crease: 'lo' })}</g>`, [A.ball(tip, Lay.BALL_R, aig('ball'))], { bias: 6 });
		put('aiguillage.hub', 'aiguillage', [px, Lay.LEVER_Y[1], pz], S(disc(6, 8.8, 2.6, Fc, P), { tone: 'hi', crease: 'lo' }) + D([at([px, Lay.HEAD_FRONT + 8.8, pz])], { size: 0.5, tone: 'hi' }), [A.disc(Fc, 6, 8.8, 2.6, aig('hub'))], { bias: 0.9 });
		// Bille et ressort de détente, sous le boisseau.
		const Fd = alongY(px, Lay.HEAD_FRONT, pz - Lay.COLLAR_R - 2);
		put('aiguillage.detent', 'aiguillage', [px, Lay.HEAD_FRONT + 2, pz - Lay.COLLAR_R - 2], S(disc(0, 4, 2, Fd, P), { tone: 'mid' }) + L(G.arcOf(Fd, 2, 2, P), { tone: 'faint' }), [A.disc(Fd, 0, 4, 2, aig('detent'))]);
		put('aiguillage.detent-ball', 'aiguillage', [px, Lay.HEAD_FRONT + 4.6, pz - Lay.COLLAR_R - 2], S(sphereOf([px, Lay.HEAD_FRONT + 4.6, pz - Lay.COLLAR_R - 2], 1, P), { tone: 'hi', crease: 'lo' }), [A.ball([px, Lay.HEAD_FRONT + 4.6, pz - Lay.COLLAR_R - 2], 1, aig('detent-ball'))], { bias: 0.2 });
	}
	// Raccord stdin : de derrière la tablette, il monte derrière la tête, passe par deux coudes à boule
	// et descend sur sa bride. Chaque tronçon finit bord sur boule (à √(R² − r²) du centre).
	{
		const r = Lay.STDIN_R;
		const seat = Math.sqrt(Lay.ELBOW_R ** 2 - r ** 2);
		const [e0, e1] = Lay.ELBOWS;
		const owner = 'aiguillage.stdin';
		const legs: { name: string; points: Point3[]; gaps: (total: number) => [number, number][] }[] = [
			{
				name: `${owner}-rise`,
				points: G.fillet([Lay.STDIN_START, [Lay.STDIN_X, e0[1], Lay.STDIN_START[2]], [e0[0], e0[1], e0[2] - seat]], 2.6 * r, 7) as Point3[],
				// Bride sur la traversée, collier sur la montée.
				gaps: (total) => [
					[0, 1.2],
					[total - 18.9, total - 17.1],
				],
			},
			{ name: `${owner}-over`, points: [toward(e0, e1, seat), toward(e1, e0, seat)], gaps: () => [] },
			{ name: `${owner}-drop`, points: [[e1[0], e1[1], e1[2] - seat], Lay.STDIN_PORT], gaps: (total) => [[total - 1.2, total]] },
		];
		for (const leg of legs) {
			const total = G.pathLength(leg.points);
			const gaps = leg.gaps(total);
			routes.push({ name: leg.name, points: leg.points, r, gaps, piece: piece('aiguillage'), owner });
			tubeChunks(leg.points, r, P, { maxLength: 24, gaps }).forEach((chunk, index) => {
				put(`${leg.name}:${index}`, 'aiguillage', chunk.mid, tubeSvg(chunk, { tone: 'mid' }), [A.tube(chunk.points, chunk.radii, { name: leg.name, owner })], { route: leg.name, chunk: index });
			});
		}
		const flangeAt = (points: Point3[], s: number, name: string) => {
			const o = G.pointAlong(points, s) as Point3;
			const F = G.frameAlong(o, G.tangentAlong(points, s));
			put(`${owner}-${name}`, 'aiguillage', o, S(disc(-0.6, 0.6, r + 1.8, F, P), { tone: 'mid' }) + D(boltCircle(F, 0.6, r + 1.1, 4, P), { size: 0.4 }), [A.disc(F, -0.6, 0.6, r + 1.8, { name: `${owner}-${name}`, owner })], { bias: 0.1 });
		};
		const rise = legs[0].points;
		flangeAt(rise, 0.6, 'bulkhead-flange');
		flangeAt(legs[2].points, G.pathLength(legs[2].points) - 0.6, 'flange');
		const collar = G.pathLength(rise) - 18;
		const co = G.pointAlong(rise, collar) as Point3;
		const Fco = G.frameAlong(co, G.tangentAlong(rise, collar));
		put(`${owner}-collar`, 'aiguillage', co, S(disc(-0.9, 0.9, r + 0.9, Fco, P), { tone: 'mid' }), [A.disc(Fco, -0.9, 0.9, r + 0.9, { name: `${owner}-collar`, owner })], { bias: 0.1 });
		Lay.ELBOWS.forEach((e, i) => put(`${owner}-elbow-${i}`, 'aiguillage', e, S(sphereOf(e, Lay.ELBOW_R, P), { tone: 'mid' }), [A.ball(e, Lay.ELBOW_R, { name: `${owner}-elbow-${i}`, owner: `${owner}-elbows` })], { bias: 0.2 }));
		const bulk = plan(Lay.STDIN_X - 6, Lay.STDIN_X + 6, Lay.STDIN_START[1] - 6, Lay.STDIN_START[1], 0.8);
		put('aiguillage.bulkhead', 'aiguillage', [Lay.STDIN_X, Lay.STDIN_START[1] - 3, 3.5], S(slabOf(bulk, 0, 7, P, 2, 0.4), { tone: 'mid' }), [A.slab(bulk, 0, 7, aig('bulkhead'), 2)]);
	}

	// --- Sonde API ------------------------------------------------------------------------------------
	{
		const F = G.frameOf(Lay.PROBE_AXIS, [-1, 0, 0], [0, 1, 0], [0, 0, -1]);
		const pr = Lay.PROBE;
		const sonde = (name: string) => ({ name: `sonde-api.${name}`, owner: 'sonde-api' });
		const point = (s: number): Point3 => pointOf(F, s, 0, 0);
		const out = rest.probe * pr.stroke;
		put('sonde-api.flange', 'sonde-api', point(0.5), S(disc(0, 1, 6.4, F, P), { tone: 'mid' }) + D(boltCircle(F, 0, 5.6, 6, P), { size: 0.4 }), [A.disc(F, 0, 1, 6.4, sonde('flange'))]);
		// Index fixe de la bague : un trait sur le corps, au plus près du lecteur.
		const ia = RING_INDEX * 2 * Math.PI;
		const onHousing = (s: number): Point3 => [Lay.PROBE_AXIS[0] - s, Lay.PROBE_AXIS[1] + 5 * Math.sin(ia), Lay.PROBE_AXIS[2] + 5 * Math.cos(ia)];
		const index = pathOf([at(onHousing(3.4)), at(onHousing(pr.ring[0]))]);
		put('sonde-api.housing', 'sonde-api', point(3.5), S(disc(1, pr.ring[0], 5, F, P), { tone: 'mid', inner: L(G.arcOf(F, 3.4, 5, P), { tone: 'faint' }) }) + L(index, { tone: 'hi' }), [A.disc(F, 1, pr.ring[0], 5, sonde('housing'))]);
		put(
			'sonde-api.ring',
			'sonde-api',
			point(8),
			S(disc(pr.ring[0], pr.ring[1], pr.ringR, F, P), { tone: 'hi', crease: 'lo' }) + `<g data-csl="probe-ring">${ringTicksSvg(rest.ring)}</g>`,
			[A.disc(F, pr.ring[0], pr.ring[1], pr.ringR, sonde('ring'))],
		);
		put('sonde-api.gland', 'sonde-api', point(10.7), S(disc(pr.gland[0], pr.gland[1], 2.2, F, P), { tone: 'mid' }) + L(G.circleOf(F, pr.gland[1], 1.4, P), { tone: 'faint' }), [A.disc(F, pr.gland[0], pr.gland[1], 2.2, sonde('gland'))]);
		const rod = G.rodOut(F, pr.gland[1], pr.tip, pr.rod, P, { stroke: pr.stroke });
		const coilAt = probeCoil(out);
		const clip = `${ID}-probe-rod`;
		// Le plongeur sorti de `out` : tige et tête déplacées, découpe tenue en place au presse-étoupe.
		const moved = out ? ` transform="${translateAlong(P, [-out, 0, 0])}"` : '';
		const held = out ? ` transform="${translateAlong(P, [out, 0, 0])}"` : '';
		const headProfile: [number, number][] = [
			[pr.tip + out, 3.2],
			[pr.tip + out + pr.head - 0.8, 3.2],
			[pr.tip + out + pr.head, 2.4],
		];
		put(
			'sonde-api.plunger',
			'sonde-api',
			point(16),
			// Ressort coupé en deux : moitié arrière, tige, moitié avant.
			`<defs><clipPath id="${clip}"><path data-hold=""${held} d="${rod.clip}"/></clipPath></defs><g data-csl="probe"${moved}><g data-csl="coil-back">${L(coilAt.back, { tone: 'lo' })}</g><g clip-path="url(#${clip})">${S(rod.paths, { tone: 'hi', crease: 'lo' })}</g><g data-csl="coil-front">${L(coilAt.front, { tone: 'mid' })}</g></g>`,
			[A.slide(F, pr.gland[1], pr.tip + out, pr.rod, sonde('rod')), A.ring(F, pr.gland[1], pr.tip + out, pr.coilR - 0.3, pr.coilR + 0.3, sonde('coil'))],
			{ bias: 0.2 },
		);
		put(
			'sonde-api.head',
			'sonde-api',
			point(pr.tip + out + 1.5),
			`<g data-csl="probe-head"${moved}>${S(solidOf(headProfile.map(([s, r]) => [s - out, r]), F, P), { tone: 'hi', crease: 'lo' })}</g>`,
			[turnedShape(F, headProfile, sonde('head'))],
			{ bias: -0.4 },
		);
	}

	// --- Capsule de cache et tampon d'écriture -------------------------------------------------------
	{
		const [cx, cy, cz] = Lay.CAPSULE;
		const F = G.frameOf(Lay.CAPSULE, [0, 0, -1], [1, 0, 0], [0, 1, 0]);
		const cap = (name: string) => ({ name: `capsule-cache.${name}`, owner: 'capsule-cache' });
		const neck = Lay.CAPSULE_NECK;
		const body = neck + Lay.CAPSULE_BODY;
		const threads = [0.7, 1.5, 2.3].map((s) => G.arcOf(F, s, 6, P)).join('');
		put('capsule-cache.neck', 'capsule-cache', [cx, cy, cz - neck / 2], S(disc(0, neck, 6, F, P), { tone: 'mid', inner: L(threads, { tone: 'lo' }) }), [A.disc(F, 0, neck, 6, cap('neck'))]);
		// Fenêtre témoin : le niveau du 5h écrit au cache, dans une lumière bordée sur la face vue.
		put(
			'capsule-cache.body',
			'capsule-cache',
			[cx, cy, cz - (neck + body) / 2],
			S(disc(neck, body, Lay.CAPSULE_R, F, P), { tone: 'hi', crease: 'lo' }) + `<g data-csl="witness">${witnessSvg(cacheLevel(t))}</g>`,
			[A.disc(F, neck, body, Lay.CAPSULE_R, cap('body'))],
		);
		put('capsule-cache.dome', 'capsule-cache', pointOf(F, body + 3, 0, 0), S(sphereOf(pointOf(F, body, 0, 0), Lay.CAPSULE_R, P), { tone: 'hi', crease: 'lo' }), [A.ball(pointOf(F, body, 0, 0), Lay.CAPSULE_R, cap('dome'))], { bias: -6 });
		// Tampon : chape sous la tête, axe, marteau qui frappe la capsule par la droite.
		const [hx, hz] = Lay.HAMMER_PIVOT;
		const bracket = plan(hx - 2, hx + 2, Lay.HAMMER_Y[0] - 1.6, Lay.HAMMER_Y[1] + 1.6, 0.6);
		put('capsule-cache.bracket', 'capsule-cache', [hx, 16, (hz + hz0) / 2], S(slabOf(bracket, hz - 1.6, hz0 - hz + 1.6, P, 2, 0.3), { tone: 'mid' }), [A.slab(bracket, hz - 1.6, hz0 - hz + 1.6, cap('bracket'), 2)], { bias: -0.5 });
		put('capsule-cache.hammer', 'capsule-cache', [hx - 1.5, 16, hz - 5], `<g data-csl="hammer">${hammerSvg(rest.hammer * Lay.HAMMER_SWING)}</g>`, [A.prism(alongY(hx, 0, hz), [[-3.4, -0.9], [0.9, -0.9], [0.9, 9.8], [-3.4, 9.8]], Lay.HAMMER_Y[0], Lay.HAMMER_Y[1], cap('hammer'))]);
		const Fp = alongY(hx, Lay.HAMMER_Y[1], hz);
		put('capsule-cache.pin', 'capsule-cache', [hx, Lay.HAMMER_Y[1] + 1, hz], S(disc(0, 2.2, 0.8, Fp, P), { tone: 'hi', crease: 'lo' }), [A.disc(Fp, 0, 2.2, 0.8, cap('pin'))], { bias: 0.3 });
	}

	// --- Modules 5h et semaine : carters, guides, lames, ressorts, tambours ----------------------------
	Lay.MODULES.forEach((x0, index) => {
		const key = index === 0 ? 'five' : 'week';
		const x1 = x0 + Lay.MODULE_W;
		const [y0, y1] = Lay.MODULE_Y;
		const [z0, z1] = Lay.MODULE_Z;
		const shown = index === 0 ? rest.output.five : rest.output.week;
		const peigne = (name: string) => ({ name: `peignes.${key}-${name}`, owner: `peignes-${key}` });
		const carter = plan(x0, x1, y0, y1, 1.6);
		const dw = { x0: x0 + Lay.DRUM_WINDOW.dx0, x1: x0 + Lay.DRUM_WINDOW.dx0 + Lay.DRUMS * Lay.DRUM_PITCH + 3, z0: Lay.DRUM_WINDOW.z0, z1: Lay.DRUM_WINDOW.z1 };
		const ls = Lay.LABEL_SLOT;
		const slotPlan = plan(x0 + ls.dx0, x0 + ls.dx1, 0, 1, 1.2);
		const slotOutline = pathOf(G.hullOf([at([slotPlan.x, y1, ls.z0]), at([slotPlan.x + slotPlan.w, y1, ls.z0]), at([slotPlan.x + slotPlan.w, y1, ls.z1]), at([slotPlan.x, y1, ls.z1])]), true);
		const card = pathOf([at([slotPlan.x + 3, y1, (ls.z0 + ls.z1) / 2]), at([slotPlan.x + slotPlan.w * (index === 0 ? 0.45 : 0.6), y1, (ls.z0 + ls.z1) / 2])]);
		const recess = y1 - 2;
		put(
			`peignes.${key}-carter`,
			'peignes',
			[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
			S(slabOf(carter, z0, z1 - z0, P, 3, 0.8), { tone: 'mid', inner: L(sideSeam(carter, z0 + 2, P, 3), { tone: 'faint' }) }) +
				`<path class="iso-shade" data-shade="2" d="${slotOutline}"/>` +
				L(slotOutline, { tone: 'lo' }) +
				L(card, { tone: 'mid', free: true }) +
				D([at([x0 + 3, y1, z1 - 3]), at([x1 - 3, y1, z1 - 3]), at([x0 + 3, y1, z0 + 5]), at([x1 - 3, y1, z0 + 5])], { size: 0.45 }),
			[
				box(x0, y0, z0, x1, recess, z1, peigne('core')),
				box(x0, recess, z0, dw.x0, y1, z1, peigne('skin-left')),
				box(dw.x1, recess, z0, x1, y1, z1, peigne('skin-right')),
				box(dw.x0, recess, z0, dw.x1, y1, dw.z0, peigne('skin-low')),
				box(dw.x0, recess, dw.z1, dw.x1, y1, z1, peigne('skin-high')),
			],
			{ bias: -1 },
		);
		// Guides devant et derrière les lames. Le guide avant est fendu au droit de chaque lame, et l'axe
		// de la lame affleure au fond de sa fente.
		const guide = (y: [number, number], name: string, extra = '') => {
			const g = plan(x0 + 2, x1 - 2, y[0], y[1], 0.5);
			put(`peignes.${key}-guide-${name}`, 'peignes', [(x0 + x1) / 2, (y[0] + y[1]) / 2, z1 + Lay.GUIDE_H / 2], S(slabOf(g, z1, Lay.GUIDE_H, P, 2, 0.3), { tone: 'mid' }) + extra, [A.slab(g, z1, Lay.GUIDE_H, peigne(`guide-${name}`), 2)]);
		};
		guide(Lay.GUIDE_BACK, 'back');
		const pinEnds = Array.from({ length: 10 }, (_, k) => x0 + Lay.BLADE_FIRST + k * Lay.BLADE_PITCH);
		const slots = pinEnds.map((px) => arcPath(px, -Lay.PIVOT_Z, 0.75, 90, 270) + localPath([[px - 0.75, -Lay.PIVOT_Z], [px - 0.75, -(z1 + Lay.GUIDE_H - 0.5)], [px + 0.75, -(z1 + Lay.GUIDE_H - 0.5)], [px + 0.75, -Lay.PIVOT_Z]])).join('');
		const pins = pinEnds.map((px) => arcPath(px, -Lay.PIVOT_Z, 0.45, 0, 360, true)).join('');
		guide(Lay.GUIDE_FRONT, 'front', `<g transform="${face(Lay.GUIDE_FRONT[1])}">${L(slots, { tone: 'lo' })}${L(pins, { tone: 'hi' })}</g>`);
		const filled = shown.pct == null ? 0 : bar(shown.pct).filled;
		for (let k = 0; k < 10; k++) {
			const px = x0 + Lay.BLADE_FIRST + k * Lay.BLADE_PITCH;
			const raised = k < filled ? 1 : 0;
			const h = Lay.BLADE_T / 2;
			const rect: [number, number][] = raised ? [[-h, -Lay.BLADE_LEN + h], [h, -Lay.BLADE_LEN + h], [h, h], [-h, h]] : [[-h, -h], [Lay.BLADE_LEN - h, -h], [Lay.BLADE_LEN - h, h], [-h, h]];
			put(
				`peignes.${key}-blade-${k}`,
				'peignes',
				[px + (raised ? 0 : Lay.BLADE_LEN / 2), 13.5, Lay.PIVOT_Z + (raised ? Lay.BLADE_LEN / 2 : 0)],
				// Une lame couchée est entièrement cachée par le guide avant : elle n'est dessinée qu'en se levant.
				`<g data-csl="blade-${key}-${k}">${raised ? bladeSvg(px, Lay.PIVOT_Z, raised) : ''}</g>`,
				[A.prism(alongY(px, 0, Lay.PIVOT_Z), rect, Lay.BLADE_Y[0], Lay.BLADE_Y[1], peigne(`blade-${k}`))],
			);
		}
		// Ressorts de rappel : une rangée sous la lèvre du guide avant, sur une réglette.
		const ledge = plan(x0 + 2, x1 - 2, y1, y1 + 2, 0.4);
		const springZ: [number, number] = [z1 - 4, z1];
		const springs: string[] = [];
		for (let k = 0; k < 10; k++) {
			const sx = x0 + Lay.BLADE_FIRST + k * Lay.BLADE_PITCH + 4;
			springs.push(vcoil(sx, y1 + 1, 0.7, springZ[0], springZ[1], 2.5));
		}
		put(
			`peignes.${key}-springs`,
			'peignes',
			[(x0 + x1) / 2, y1 + 1, z1 - 2],
			S(slabOf(ledge, springZ[0] - 1, 1, P, 2, 0.2), { tone: 'mid' }) + L(springs.join(''), { tone: 'mid' }) + S(slabOf(ledge, springZ[1], 0.8, P, 2, 0.2), { tone: 'mid' }),
			[A.slab(ledge, springZ[0] - 1, 1, peigne('ledge'), 2), A.slab(ledge, springZ[1], 0.8, peigne('lip'), 2), box(ledge.x, ledge.y, springZ[0], ledge.x + ledge.w, ledge.y + ledge.d, springZ[1], peigne('springs'))],
		);

		// Tambours : cinq rouleaux derrière leur fenêtre, chiffres dans le plan de la face.
		const tambour = (name: string) => ({ name: `tambours.${key}-${name}`, owner: `peignes-${key}` });
		const dy = recess + 0.3;
		const corner = (x: number, y: number, z: number) => at([x, y, z]);
		const back = pathOf([corner(dw.x0, dy, dw.z0), corner(dw.x1, dy, dw.z0), corner(dw.x1, dy, dw.z1), corner(dw.x0, dy, dw.z1)], true);
		const sill = pathOf([corner(dw.x0, recess, dw.z0), corner(dw.x1, recess, dw.z0), corner(dw.x1, y1, dw.z0), corner(dw.x0, y1, dw.z0)], true);
		const wall = pathOf([corner(dw.x0, recess, dw.z0), corner(dw.x0, recess, dw.z1), corner(dw.x0, y1, dw.z1), corner(dw.x0, y1, dw.z0)], true);
		const drumOpening = pathOf([corner(dw.x0, y1, dw.z0), corner(dw.x1, y1, dw.z0), corner(dw.x1, y1, dw.z1), corner(dw.x0, y1, dw.z1)], true);
		const clip = `${ID}-drums-${key}`;
		const chars = drumChars(shown.pct == null ? '—' : shown.reset);
		const cw = -(dw.z0 + dw.z1) / 2;
		const drums = chars
			.map((ch, j) => {
				const cx = dw.x0 + 1.5 + Lay.DRUM_PITCH * (j + 0.5);
				return `<g data-csl="drum-${key}-${j}"><text class="iso-face-text" data-tone="hi" x="${cx}" y="${cw + Lay.DRUM_FONT * 0.36}" font-size="${Lay.DRUM_FONT}" text-anchor="middle">${ch}</text><text class="iso-face-text" data-tone="hi" x="${cx}" y="${cw + Lay.DRUM_FONT * 0.36 + 10}" font-size="${Lay.DRUM_FONT}" text-anchor="middle"></text></g>`;
			})
			.join('');
		// Le galbe des rouleaux : une bande d'ombre en haut et une en bas de la fenêtre.
		const galbe = [dw.z1, dw.z0 + 1.6].map((z) => localPath([[dw.x0, -z], [dw.x1, -z], [dw.x1, -z + 1.6], [dw.x0, -z + 1.6]], true)).join('');
		const seps = Array.from({ length: Lay.DRUMS - 1 }, (_, j) => {
			const x = dw.x0 + 1.5 + Lay.DRUM_PITCH * (j + 1);
			return localPath([[x, -dw.z1], [x, -dw.z0]]);
		}).join('');
		put(
			`tambours.${key}`,
			'tambours',
			[(dw.x0 + dw.x1) / 2, dy, (dw.z0 + dw.z1) / 2],
			`<defs><clipPath id="${clip}"><path d="${drumOpening}"/></clipPath></defs><g clip-path="url(#${clip})"><path class="iso-fill" d="${back}"/><path class="iso-shade" data-shade="3" d="${back}"/><g transform="${face(dy)}"><path class="iso-shade" data-shade="2" d="${galbe}"/>${drums}${L(seps, { tone: 'lo' })}</g><path class="iso-shade" data-shade="3" d="${sill}"/><path class="iso-shade" data-shade="1" d="${wall}"/></g>${L(drumOpening, { tone: 'lo' })}`,
			// Les rouleaux bombent hors du fond de la fenêtre ; en retrait des parois qui les masquent de biais.
			[box(dw.x0 + 1, recess, dw.z0 + 1, dw.x1 - 4, recess + 1.2, dw.z1 - 1, tambour('drums'))],
			{ bias: 0.5 },
		);
	});

	// --- Arbre du temps, paliers, pignons des tambours ------------------------------------------------
	{
		const volant = (name: string) => ({ name: `volant.${name}`, owner: 'arbre' });
		const B = Lay.BEARING;
		Lay.BEARINGS.forEach((bx) => {
			const p = plan(bx - B.w / 2, bx + B.w / 2, B.y0, B.y1, 0.6);
			put(`palier-${bx}`, null, [bx, (B.y0 + B.y1) / 2, B.z0 / 2], S(slabOf(p, B.z0, -B.z0, P, 2, 0.4), { tone: 'mid', inner: L(sideSeam(p, B.z0 / 2, P, 2), { tone: 'faint' }) }) + D([at([bx - B.w / 2 + 1.4, B.y1, -1.6]), at([bx + B.w / 2 - 1.4, B.y1, -1.6])], { size: 0.4 }), [A.slab(p, B.z0, -B.z0, { name: `palier-${bx}`, owner: 'arbre' }, 2)]);
		});
		const cuts = [...Lay.BEARINGS.flatMap((bx) => [bx - B.w / 2, bx + B.w / 2]), ...Lay.DRUM_GEARS.flatMap((gx) => [gx, gx + 4])].sort((a, b) => a - b);
		const spans: [number, number][] = [];
		let from = Lay.BEARINGS[0] + B.w / 2;
		for (let i = 2; i < cuts.length; i += 2) {
			spans.push([from, cuts[i]]);
			from = cuts[i + 1];
		}
		spans.push([from, Lay.SHAFT_X[1]]);
		const F = G.frameAlong([0, Lay.SHAFT_Y, Lay.SHAFT_Z], [1, 0, 0]);
		spans.forEach(([s0, s1]) => {
			put(`volant.shaft-${s0}`, 'volant', [(s0 + s1) / 2, Lay.SHAFT_Y, Lay.SHAFT_Z], S(disc(s0, s1, Lay.SHAFT_R, F, P), { tone: 'mid' }), [A.disc(F, s0, s1, Lay.SHAFT_R, volant(`shaft-${s0}`))], { bias: -0.3 });
		});
		Lay.DRUM_GEARS.forEach((gx) => {
			const teeth = fadedRibs(F, gx, gx + 4, 3.4, 28, P);
			put(`tambours.gear-${gx}`, 'tambours', [gx + 2, Lay.SHAFT_Y, Lay.SHAFT_Z], S(disc(gx, gx + 4, 3.4, F, P), { tone: 'mid' }) + fadedLines(teeth, 'lo'), [A.disc(F, gx, gx + 4, 3.4, volant(`gear-${gx}`))]);
		});
	}

	// --- Cadran ------------------------------------------------------------------------------------
	{
		const [dx, dz] = Lay.DIAL;
		const F = alongY(dx, Lay.FRONT, dz);
		const cad = (name: string) => ({ name: `cadran.${name}`, owner: 'cadran' });
		const profile: [number, number][] = [
			[0, Lay.DIAL_R],
			[Lay.DIAL_DEPTH, Lay.DIAL_R],
		];
		put('cadran.housing', 'cadran', [dx, Lay.FRONT + 5, dz], S(solidOf(profile, F, P), { tone: 'hi', crease: 'lo', inner: L(G.arcOf(F, 4.6, Lay.DIAL_R, P), { tone: 'faint' }) }), [turnedShape(F, profile, cad('housing'))], { bias: -2 });
		// Fond du cadran : échelle de 0 à 100 % sur 270°, deux zones de ton, aiguilles.
		const cw = -dz;
		const angleOf = needleAngle;
		const sr = Lay.SCALE_R;
		const scale = arcPath(dx, cw, sr, angleOf(0), angleOf(100));
		const bandOf = (from: number, to: number, tone: Tone) => `<path class="iso-line" data-tone="${tone}" style="stroke-width:1.8" d="${arcPath(dx, cw, sr - 2.2, angleOf(from), angleOf(to))}"/>`;
		const ticks = { zero: '', major: '', minor: '' };
		for (let i = 0; i <= 20; i++) {
			const deg = angleOf(i * 5);
			const inner = i % 2 === 0 ? sr - 4 : sr - 1.8;
			const d = localPath([polar(dx, cw, sr, deg), polar(dx, cw, inner, deg)]);
			if (i === 0) ticks.zero += d;
			else if (i % 2 === 0) ticks.major += d;
			else ticks.minor += d;
		}
		const five = rest.output.five.pct ?? 0;
		const week = rest.output.week.pct ?? 0;
		const needle = (name: string, length: number, pct: number, tone: 'lit' | 'hi', width: number, tail: number, weight: boolean) =>
			`<g data-csl="needle-${name}" transform="rotate(${round(angleOf(pct))} ${dx} ${cw})">${weight ? `<path class="iso-fill" d="${arcPath(dx, cw + tail, 1.9, 0, 360, true)}"/>${L(arcPath(dx, cw + tail, 1.9, 0, 360, true), { tone })}` : ''}<path class="iso-line" data-tone="${tone}" data-free="end" style="stroke-width:${width}" d="${localPath([[dx, cw + tail - (weight ? 1.9 : 0)], [dx, cw - length]])}"/></g>`;
		put(
			'cadran.face',
			'cadran',
			[dx, Lay.DIAL_FACE_Y, dz],
			`<g transform="${face(Lay.DIAL_FACE_Y)}">${bandOf(50, 80, 'mid')}${bandOf(80, 100, 'hi')}${L(scale, { tone: 'mid' })}${L(ticks.minor, { tone: 'lo' })}${L(ticks.major, { tone: 'mid' })}${L(ticks.zero, { tone: 'hi' })}${needle('week', Lay.NEEDLES.short, week, 'hi', 1, 2.6, false)}${needle('five', Lay.NEEDLES.long, five, 'lit', 1.1, Lay.NEEDLES.tail, true)}</g>`,
			[A.disc(F, Lay.DIAL_DEPTH, Lay.DIAL_DEPTH + 0.4, Lay.BEZEL_R[0] - 0.2, cad('face'))],
		);
		put('cadran.hub', 'cadran', [dx, Lay.DIAL_FACE_Y + 1, dz], S(disc(Lay.DIAL_DEPTH, Lay.DIAL_DEPTH + 1.6, 2.2, F, P), { tone: 'hi', crease: 'lo' }) + D([at([dx, Lay.DIAL_FACE_Y + 1.6, dz])], { size: 0.5, tone: 'hi' }), [A.disc(F, Lay.DIAL_DEPTH, Lay.DIAL_DEPTH + 1.6, 2.2, cad('hub'))], { bias: 0.4 });
		const [rIn, rOut] = Lay.BEZEL_R;
		const s1 = Lay.DIAL_DEPTH + Lay.BEZEL_DEPTH;
		const screws = [45, 135, 225, 315].map((deg) => at(pointOf(F, s1, (rIn + rOut) / 2, (deg * Math.PI) / 180)));
		const glare = localPath([...Array.from({ length: 13 }, (_, i) => polar(dx, cw, rIn - 2.6, -62 + (i * 44) / 12)), ...Array.from({ length: 13 }, (_, i) => polar(dx - 1.4, cw + 1.6, rIn - 4.8, -18 - (i * 44) / 12))], true);
		put(
			'cadran.bezel',
			'cadran',
			[dx, Lay.DIAL_FACE_Y + 1.2, dz],
			ringSvg(ringBand(Lay.DIAL_DEPTH, s1, rIn, rOut, F, P, { hole: [s1, rIn] }), { tone: 'hi', crease: 'lo' }) +
				D(screws, { size: 0.5, tone: 'hi' }) +
				`<g transform="${face(s1 + Lay.FRONT - 0.4)}"><path class="iso-shade" data-shade="3" d="${glare}"/>${L(glare, { tone: 'faint' })}</g>`,
			[A.ring(F, Lay.DIAL_DEPTH, s1, rIn, rOut, cad('bezel'))],
			{ bias: 1 },
		);

		// Amortisseur à huile sous le cadran : cylindre, presse-étoupe, tige, chape et bielle.
		const D0 = Lay.DAMPER;
		const Fd = G.frameAlong(D0.o, [-1, 0, 0]);
		const db = Lay.DAMPER_BRACKET;
		put('cadran.damper-bracket', 'cadran', [db.x + db.w / 2, db.y + db.d / 2, -5.25], S(slabOf(db, -10.5, 10.5, P, 2, 0.4), { tone: 'mid' }) + D([at([db.x + 2, db.y + db.d, -1.6]), at([db.x + db.w - 2, db.y + db.d, -1.6])], { size: 0.4 }), [A.slab(db, -10.5, 10.5, cad('damper-bracket'), 2)]);
		put('cadran.damper', 'cadran', pointOf(Fd, D0.body / 2, 0, 0), S(solidOf([[0, D0.r - 0.6], [0.6, D0.r], [D0.body - 0.6, D0.r], [D0.body, D0.r - 0.6]], Fd, P), { tone: 'hi', crease: 'lo', inner: L([6, D0.body - 6].map((s) => G.arcOf(Fd, s, D0.r, P)).join(''), { tone: 'faint' }) }), [turnedShape(Fd, [[0, D0.r - 0.6], [0.6, D0.r], [D0.body - 0.6, D0.r], [D0.body, D0.r - 0.6]], cad('damper'))]);
		put('cadran.damper-gland', 'cadran', pointOf(Fd, D0.body + D0.gland / 2, 0, 0), S(disc(D0.body, D0.body + D0.gland, 2.2, Fd, P), { tone: 'mid' }) + L(G.circleOf(Fd, D0.body + D0.gland, 1.3, P), { tone: 'faint' }), [A.disc(Fd, D0.body, D0.body + D0.gland, 2.2, cad('damper-gland'))], { bias: -0.2 });
		const rodTo = D0.o[0] - Lay.LEVER_PIVOT[0] - 2.5;
		const rod = G.rodOut(Fd, D0.body + D0.gland, rodTo, D0.rod, P, { stroke: D0.stroke });
		const out = damperOut(five);
		const clip = `${ID}-damper-rod`;
		const shift = out ? ` transform="${translateAlong(P, [-out, 0, 0])}"` : '';
		const hold = out ? ` transform="${translateAlong(P, [out, 0, 0])}"` : '';
		const clevis: [number, number][] = [[-2.5, -1.6], [0.6, -1.6], [0.6, 1.6], [-2.5, 1.6]];
		const Fcl = alongY(D0.o[0] - rodTo, D0.o[1] - 2, D0.o[2]);
		put(
			'cadran.damper-rod',
			'cadran',
			pointOf(Fd, (D0.body + rodTo) / 2, 0, 0),
			`<defs><clipPath id="${clip}"><path data-hold=""${hold} d="${rod.clip}"/></clipPath></defs><g data-csl="damper-rod"${shift}><g clip-path="url(#${clip})">${S(rod.paths, { tone: 'hi', crease: 'lo' })}</g>${S(G.prismOf(Fcl, clevis, 0, 4, P), { tone: 'mid' })}</g>`,
			[A.slide(Fd, D0.body + D0.gland, rodTo, D0.rod, cad('damper-rod')), A.prism(Fcl, clevis, 0, 4, cad('clevis'))],
			{ bias: -0.4 },
		);
		const lp = Lay.LEVER_PIVOT;
		const lb = plan(lp[0] - 3, lp[0] + 3, lp[1] - 3, lp[1] - 1, 0.4);
		put('cadran.link-bracket', 'cadran', [lp[0], lp[1] - 2, -2], S(slabOf(lb, -4, 4, P, 2, 0.3), { tone: 'mid' }), [A.slab(lb, -4, 4, cad('link-bracket'), 2)], { bias: -3 });
		const angle = linkAngle(five);
		put('cadran.link', 'cadran', [lp[0], lp[1], lp[2] - 6.5], `<g data-csl="link">${linkSvg(angle)}</g>`, [A.prism(alongY(lp[0], 0, lp[2]), [[-1.1, -0.8], [1.1, -0.8], [0.9, 13.4], [-0.9, 13.4]].map(([u, w]) => turn2(u, w, angle)), lp[1] - 1, lp[1] + 1, cad('link'))], { bias: -2.5 });
	}

	// --- Volant, croix de Malte, embout droit -----------------------------------------------------
	{
		const [wx, wz] = Lay.WHEEL;
		const F = alongY(wx, Lay.FRONT, wz);
		const vol = (name: string) => ({ name: `volant.${name}`, owner: 'volant' });
		const [s0, s1] = Lay.WHEEL_S;
		const [rIn, rOut] = Lay.WHEEL_R;
		put('volant.boss', 'volant', [wx, Lay.FRONT + 2, wz], S(disc(0, s0, 4.2, F, P), { tone: 'mid' }), [A.disc(F, 0, s0, 4.2, vol('boss'))], { bias: -1 });
		// Rayons, moyeu et jante tournent ensemble : un seul élément, peint rayons puis moyeu puis jante.
		const spokes = `<g data-csl="spokes">${spokesSvg(rest.wheel)}</g>`;
		const hub = S(disc(s0, s1 + 1, 3.6, F, P), { tone: 'mid' }) + L(G.circleOf(F, s1 + 1, 2, P), { tone: 'faint' });
		// Jante moletée : le moletage tourne avec le volant (reconstruit à chaque image par le mouvement).
		const phases = `<g data-csl="knurl">${knurlSvg(rest.wheel)}</g>`;
		const notches = { minor: '', major: '' };
		for (let i = 0; i < 60; i++) {
			const deg = i * 6;
			const d = localPath([polar(wx, -wz, rIn + 0.5, deg), polar(wx, -wz, i % 15 === 0 ? rOut - 0.3 : rOut - 1.2, deg)]);
			if (i % 15 === 0) notches.major += d;
			else notches.minor += d;
		}
		const crown = arcPath(wx, -wz, rIn + 0.5, 0, 360, true);
		put(
			'volant.wheel',
			'volant',
			[wx, Lay.FRONT + 6.5, wz],
			spokes +
				hub +
				ringSvg(ringBand(s0, s1, rIn, rOut, F, P, { hole: [s1, rIn] }), { tone: 'mid' }) +
				phases +
				`<g transform="${face(Lay.FRONT + s1)}"><g data-csl="notches" transform="rotate(${round(rest.wheel * 360)} ${wx} ${-wz})">${L(crown, { tone: 'lo' })}${L(notches.minor, { tone: 'lo' })}${L(notches.major, { tone: 'hi' })}</g></g>`,
			[A.ring(F, s0, s1, rIn, rOut, vol('rim')), A.disc(F, s0, s1 + 1, 3.6, vol('hub')), ...spokePolygons(rest.wheel).map((polygon, i) => A.prism(alongY(wx, 0, wz), polygon, SPOKES_Y[0], SPOKES_Y[1], vol(`spoke-${i}`)))],
		);
		// Manivelle : boss posé sur le rayon du haut, poignée tournante.
		const crank = crankAt(rest.wheel);
		const Fk = alongY(wx, Lay.FRONT, wz + Lay.CRANK_R);
		const sb = SPOKES_Y[1] - Lay.FRONT;
		const grip: [number, number][] = [
			[sb + 1.6, 1.5],
			[sb + 2.4, 1.9],
			[sb + 8, 1.9],
			[sb + 8.8, 1.4],
		];
		put(
			'volant.crank',
			'volant',
			[crank[0], Lay.FRONT + sb + 4, crank[2]],
			`<g data-csl="crank" transform="${translateAlong(P, sub(crank, [wx, 0, wz + Lay.CRANK_R]))}">${S(disc(sb, sb + 1.6, 2.2, Fk, P), { tone: 'mid' })}${S(solidOf(grip, Fk, P), { tone: 'hi', crease: 'lo', inner: L([sb + 4, sb + 6].map((s) => G.arcOf(Fk, s, 1.9, P)).join(''), { tone: 'faint' }) })}</g>`,
			[A.disc(Fk, sb, sb + 1.6, 2.2, vol('crank')), turnedShape(Fk, grip, vol('grip'))].map((shape) => A.moved(shape, sub(crank, [wx, 0, wz + Lay.CRANK_R]))),
			{ bias: 2 },
		);

		const Bx = Lay.BOX;
		const [bz0, bz1] = Lay.BOX_Z;
		const [ox, oz] = Lay.PORTHOLE;
		const pr = Lay.PORTHOLE_R;
		const back = Lay.BOX_FRONT - Lay.PORTHOLE_DEPTH;
		const boxMeta = (name: string) => ({ name: `volant.${name}`, owner: 'boite' });
		put(
			'volant.box',
			'volant',
			[Bx.x + Bx.w / 2, Bx.y + Bx.d / 2, (bz0 + bz1) / 2],
			S(slabOf(Bx, bz0, bz1 - bz0, P, 3, 0.8), { tone: 'mid', inner: L(sideSeam(Bx, bz1 - 5, P, 3), { tone: 'faint' }) }) + D([at([Bx.x + 3, Lay.BOX_FRONT, bz0 + 3]), at([Bx.x + Bx.w - 3, Lay.BOX_FRONT, bz0 + 3]), at([Bx.x + 3, Lay.BOX_FRONT, bz1 - 8]), at([Bx.x + Bx.w - 3, Lay.BOX_FRONT, bz1 - 8])], { size: 0.5 }),
			[
				box(Bx.x, Bx.y, bz0, Bx.x + Bx.w, back, bz1, boxMeta('box-core')),
				box(Bx.x, back, bz0, ox - pr, Lay.BOX_FRONT, bz1, boxMeta('box-left')),
				box(ox + pr, back, bz0, Bx.x + Bx.w, Lay.BOX_FRONT, bz1, boxMeta('box-right')),
				box(ox - pr, back, bz0, ox + pr, Lay.BOX_FRONT, oz - pr, boxMeta('box-low')),
				box(ox - pr, back, oz + pr, ox + pr, Lay.BOX_FRONT, bz1, boxMeta('box-high')),
			],
			{ bias: -3 },
		);
		// Hublot : alésage, plaque du fond, croix de Malte et doigt à plat, puis la glace et sa lunette.
		const Fh = alongY(ox, Lay.BOX_FRONT, oz);
		const front = G.circleOf(Fh, 0, pr, P);
		const rear = G.circleOf(Fh, -Lay.PORTHOLE_DEPTH, pr, P);
		const clipFront = `${ID}-porthole`;
		const clipRear = `${ID}-porthole-rear`;
		const cross = genevaCross();
		const driver = genevaDriver();
		const restPose = rest;
		put(
			'volant.geneva',
			'volant',
			[ox, back, oz],
			`<defs><clipPath id="${clipFront}"><path d="${front}"/></clipPath><clipPath id="${clipRear}"><path d="${rear}"/></clipPath></defs><g clip-path="url(#${clipFront})"><path class="iso-shade" data-shade="0" d="${front}"/><g clip-path="url(#${clipRear})"><path class="iso-fill" d="${rear}"/><path class="iso-shade" data-shade="2" d="${rear}"/><g transform="${face(back + 0.2)}">${genevaSvg(cross, driver, restPose.cross, restPose.driver)}</g></g></g>`,
			[A.disc(Fh, -Lay.PORTHOLE_DEPTH, -Lay.PORTHOLE_DEPTH + 0.6, pr - 2.4, boxMeta('porthole-back'))],
		);
		const bezelScrews = [45, 135, 225, 315].map((deg) => at(pointOf(Fh, 1.6, pr + 1.2, (deg * Math.PI) / 180)));
		const glare = localPath([...Array.from({ length: 9 }, (_, i) => polar(ox, -oz, pr - 1.4, -70 + (i * 40) / 8)), ...Array.from({ length: 9 }, (_, i) => polar(ox - 0.8, -oz + 1, pr - 2.6, -30 - (i * 40) / 8))], true);
		put(
			'volant.porthole-bezel',
			'volant',
			[ox, Lay.BOX_FRONT + 0.8, oz],
			`<g transform="${face(Lay.BOX_FRONT + 0.6)}"><path class="iso-shade" data-shade="3" d="${glare}"/>${L(glare, { tone: 'faint' })}</g>` + ringSvg(ringBand(0, 1.6, pr, pr + 2.4, Fh, P, { hole: [1.6, pr] }), { tone: 'mid' }) + D(bezelScrews, { size: 0.45 }),
			[A.ring(Fh, 0, 1.6, pr, pr + 2.4, boxMeta('porthole-bezel'))],
			{ bias: 0.5 },
		);
		// Plaque gravée « v1.0.0 » : la seule inscription du dessin.
		const vp = plan(648, 676, Lay.BOX_FRONT, Lay.BOX_FRONT + 0.8, 0.6);
		put(
			'version-plate',
			null,
			[662, Lay.BOX_FRONT + 0.4, 6.5],
			S(slabOf(vp, 2, 9, P, 2, 0.3), { tone: 'hi', crease: 'lo' }) + faceTextSvg(sideMatrix([662, Lay.BOX_FRONT + 0.8], 4.6, P, 'left'), 'v1.0.0', { size: 4.2, tone: 'mid', anchor: 'middle' }) + D([at([650, Lay.BOX_FRONT + 0.8, 6.5]), at([674, Lay.BOX_FRONT + 0.8, 6.5])], { size: 0.4 }),
			[A.slab(vp, 2, 9, boxMeta('version-plate'), 2)],
		);
		// Index fixe du volant, sur le flanc gauche de la boîte.
		const Fi = alongY(Bx.x, Lay.BOX_FRONT - 4, wz);
		const pointer: [number, number][] = [[-(Bx.x - wx - rOut - 0.7), 0], [0, -1.4], [0, 1.4]];
		put('volant.index', 'volant', [Bx.x - 4, Lay.BOX_FRONT - 3, wz], S(G.prismOf(Fi, pointer, 0, 2, P), { tone: 'mid' }), [A.prism(Fi, pointer, 0, 2, vol('index'))], { bias: 0.4 });
	}

	return { items, routes };
}

// --- Petits outils ------------------------------------------------------------------------------

const round = (value: number) => Math.round(value * 100) / 100;
const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** Le point à `distance` de `from`, vers `to`. */
const toward = (from: Point3, to: Point3, distance: number): Point3 => {
	const d = sub(to, from);
	const k = distance / Math.hypot(d[0], d[1], d[2]);
	return [from[0] + d[0] * k, from[1] + d[1] * k, from[2] + d[2] * k];
};
const turn2 = (u: number, w: number, angle: number): [number, number] => {
	const c = Math.cos((angle * Math.PI) / 180);
	const s = Math.sin((angle * Math.PI) / 180);
	return [u * c - w * s, u * s + w * c];
};

function fadedLines(list: { d: string; alpha: number }[], tone: Tone) {
	return list
		.filter(({ alpha }) => alpha > 0.03)
		.map(({ d, alpha }) => (alpha >= 0.97 ? lineSvg(d, { tone }) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, { tone })}</g>`))
		.join('');
}

/** Ressort vertical (axe z), moitiés avant puis arrière reliées : une seule ligne continue. */
function vcoil(cx: number, cy: number, r: number, z0: number, z1: number, turns: number) {
	// Quatre points par spire suffisent : le ressort fait moins de 2 px de large.
	const count = Math.round(turns * 4);
	const points: Flat[] = [];
	for (let i = 0; i <= count; i++) {
		const a = (i / count) * turns * 2 * Math.PI;
		points.push(iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + ((z1 - z0) * i) / count], P));
	}
	return pathOf(points);
}

// --- Croix de Malte et doigt, à plat dans le plan du fond du hublot ----------------------------------

const CRANK = CENTRES * Math.sin(Math.PI / 6);
const LOCK_R = 3.6;

function genevaCross() {
	const pts: Flat[] = [];
	const half = 0.75;
	const depth = CROSS_R + CRANK - CENTRES + 0.6;
	const toLocal = (r: number, deg: number): Flat => polar(CROSS_AT[0], CROSS_AT[1], r, deg);
	for (let k = 0; k < 6; k++) {
		const slot = 105 + 60 * k;
		const next = slot + 60;
		const delta = (Math.asin(half / CROSS_R) * 180) / Math.PI;
		// Fente : descend le long d'un flanc, contourne le fond, remonte l'autre flanc.
		const axis = (r: number, side: number): Flat => {
			const [x, y] = toLocal(r, slot);
			const n = (slot + 90) * (Math.PI / 180);
			return [x + side * half * Math.sin(n), y - side * half * Math.cos(n)];
		};
		pts.push(axis(CROSS_R, -1), axis(CROSS_R - depth, -1));
		for (let i = 1; i < 6; i++) {
			const t = 180 + (i * 180) / 6;
			const [bx, by] = toLocal(CROSS_R - depth, slot);
			const n = ((slot + 90 + t) * Math.PI) / 180;
			pts.push([bx + half * Math.sin(n) * -1, by - half * Math.cos(n) * -1]);
		}
		pts.push(axis(CROSS_R - depth, 1), axis(CROSS_R, 1));
		// Pourtour, creusé en arc là où le disque de verrouillage du doigt se loge.
		const lock = slot + 30;
		const lockAt = toLocal(CENTRES, lock);
		for (let deg = slot + delta + 1.5; deg < next - delta; deg += 3) {
			const p = toLocal(CROSS_R, deg);
			const dx = p[0] - lockAt[0];
			const dy = p[1] - lockAt[1];
			const dist = Math.hypot(dx, dy);
			const clear = LOCK_R + 0.25;
			pts.push(dist < clear ? [lockAt[0] + (dx / dist) * clear, lockAt[1] + (dy / dist) * clear] : p);
		}
	}
	return localPath(pts, true);
}

function genevaDriver() {
	const [dx, dy] = DRIVER_AT;
	const pts: Flat[] = [];
	const notch = polar(dx, dy, LOCK_R + 1.2, 0);
	for (let deg = 0; deg < 360; deg += 8) {
		const p = polar(dx, dy, LOCK_R, deg);
		const ex = p[0] - notch[0];
		const ey = p[1] - notch[1];
		const dist = Math.hypot(ex, ey);
		pts.push(dist < 2.7 ? [notch[0] + (ex / dist) * 2.7, notch[1] + (ey / dist) * 2.7] : p);
	}
	const disc = localPath(pts, true);
	const pin = polar(dx, dy, CRANK, 0);
	const arm = localPath([polar(dx, dy, 0.9, 90), polar(pin[0], pin[1], 0.9, 90), polar(pin[0], pin[1], 0.9, 270), polar(dx, dy, 0.9, 270)], true);
	return { disc, arm, pin: arcPath(pin[0], pin[1], 0.75, 0, 360, true), hub: arcPath(dx, dy, 1.1, 0, 360, true) };
}

function genevaSvg(cross: string, driver: ReturnType<typeof genevaDriver>, crossDeg: number, fraction: number) {
	const [cx, cy] = CROSS_AT;
	const [dx, dy] = DRIVER_AT;
	return (
		`<g data-csl="driver" transform="rotate(${round(driverAngle(fraction))} ${round(dx)} ${round(dy)})"><path class="iso-shade" data-shade="3" d="${driver.disc}"/>${lineSvg(driver.disc, { tone: 'mid' })}<path class="iso-fill" d="${driver.arm}"/>${lineSvg(driver.arm, { tone: 'mid' })}<path class="iso-fill" d="${driver.pin}"/>${lineSvg(driver.pin, { tone: 'hi' })}</g>` +
		`<g data-csl="cross" transform="rotate(${round(crossDeg % 360)} ${cx} ${cy})"><path class="iso-top" d="${cross}"/>${lineSvg(cross, { tone: 'mid' })}${lineSvg(arcPath(cx, cy, 1.4, 0, 360, true), { tone: 'mid' })}</g>` +
		`<path class="iso-fill" d="${driver.hub}"/>${lineSvg(driver.hub, { tone: 'mid' })}`
	);
}
