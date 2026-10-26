// Placement du repère de la fiche : l'étiquette glisse jusqu'à la pièce visée (la pièce maîtresse
// au repos), son trait la rejoint et la pointe s'y pose. Au-dessus de la figure, l'étiquette glisse
// en x et le trait descend ; à côté d'une figure haute, elle glisse en y et le trait part vers la
// droite : la CSS du repère en décide (`--repere-axis`). Les panneaux sont écrits au build et la
// mise en avant choisit le visible (`data-on`) : ce module ne fait que mesurer et placer.
//
// Le survol doit rester fluide sur des figures de deux mille éléments : la pièce est mesurée une
// fois par pièce visée, par sa géométrie (boîtes de ses formes, puis `isPointInFill`), avec au plus
// une poignée de tests de visibilité ; le glissement n'écrit que des propriétés non héritées
// (`translate` des panneaux, du trait et de la pointe, sur leurs propres calques), qui ne
// restylent pas les panneaux.
import { follow, loop } from './live.ts';

/** Constante de temps du glissement (s) : l'étiquette arrive en un tiers de seconde environ. */
const GLIDE = 0.1;
/** Écart entre l'étiquette et le début du trait (px). */
const GAP = 8;
/** Le trait s'aligne sur le centre du numéro de l'étiquette, large de 30 px. */
const NUMBER_CENTER = 15;
/** Lignes essayées dans la boîte de la pièce, du milieu vers les bords. */
const LINES = [0.5, 0.35, 0.65, 0.2, 0.8];
/** Pas et portée de l'affinage dans une forme (px) : au-delà, le bord de sa boîte fait l'affaire. */
const STEP = 1.5;
const REACH = 40;
const SHAPES = 'path, polygon, polyline, rect, circle, ellipse';

interface Place {
	/** Décalage de l'étiquette dans le repère. */
	x: number;
	y: number;
	/** Le trait, dans le repère de la scène : origine et dimensions, l'une valant 1 px. */
	leaderX: number;
	leaderY: number;
	leaderW: number;
	leaderH: number;
}

interface Point {
	x: number;
	y: number;
}

const KEYS = ['x', 'y', 'leaderX', 'leaderY', 'leaderW', 'leaderH'] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const px = (value: number) => `${value.toFixed(1)}px`;

/** Le point (coordonnées de la fenêtre) est-il dans la forme, surface ou trait ? */
function inside(shape: SVGGeometryElement, x: number, y: number) {
	const toShape = shape.getScreenCTM()?.inverse();
	if (!toShape) return false;
	const point = new DOMPoint(x, y).matrixTransform(toShape);
	return shape.isPointInFill(point) || shape.isPointInStroke(point);
}

/**
 * Place le repère `repere` sur la figure `svg` de la scène `scene`. Renvoie `aim`, à appeler à
 * chaque changement de pièce visée (`null` : plus rien de visé), et de quoi tout débrancher.
 */
export function placeRepere(repere: HTMLElement, scene: HTMLElement, svg: SVGSVGElement) {
	const stage = repere.parentElement ?? repere;
	const panels = [...repere.querySelectorAll<HTMLElement>('[data-piece]')];
	const leader = repere.querySelector<HTMLElement>('.leader');
	const tip = repere.querySelector<HTMLElement>('.tip');
	const master = panels.find((panel) => panel.hasAttribute('data-master'))?.dataset.piece ?? null;
	let shown = master;
	let target: Place | null = null;
	let current: Place | null = null;

	/**
	 * Le premier point de la pièce en venant de l'étiquette : le plus haut quand le trait descend, le
	 * plus à gauche quand il part vers la droite. Sur chaque ligne essayée, la forme de la pièce qui
	 * commence le plus tôt donne le point, affiné dans sa géométrie ; on garde le plus tôt de ceux
	 * que rien ne cache, sinon le plus tôt tout court.
	 */
	const anchorOf = (id: string, down: boolean): Point => {
		const hooks = [...svg.querySelectorAll(`[data-piece="${CSS.escape(id)}"]`)];
		const shapes = hooks
			.flatMap((hook) => [...hook.querySelectorAll<SVGGeometryElement>(SHAPES)])
			.map((shape) => ({ shape, box: shape.getBoundingClientRect() }))
			.filter(({ box }) => box.width > 0 || box.height > 0);
		const boxes = hooks.map((hook) => hook.getBoundingClientRect());
		const box = boxes.reduce((largest, b) => (b.width * b.height > largest.width * largest.height ? b : largest));
		// Coordonnées le long du trait (`along`) et en travers (`across`).
		const point = (along: number, across: number): Point => (down ? { x: across, y: along } : { x: along, y: across });
		const [from, span] = down ? [box.left, box.width] : [box.top, box.height];
		const candidates: { along: number; across: number }[] = [];
		for (const fraction of LINES) {
			const across = from + fraction * span;
			const crossing = shapes.filter(({ box: b }) => (down ? b.left <= across && across <= b.right : b.top <= across && across <= b.bottom));
			if (!crossing.length) continue;
			const first = crossing.reduce((a, b) => ((down ? b.box.top < a.box.top : b.box.left < a.box.left) ? b : a));
			const start = down ? first.box.top : first.box.left;
			let along = start;
			for (; along < start + REACH; along += STEP) {
				const { x, y } = point(along, across);
				if (inside(first.shape, x, y)) break;
			}
			candidates.push({ along, across });
		}
		if (!candidates.length) return point(down ? box.top : box.left, from + span / 2);
		candidates.sort((a, b) => a.along - b.along);
		const visible = candidates.find(({ along, across }) => {
			const { x, y } = point(along + STEP, across);
			return document.elementFromPoint(x, y)?.closest('[data-piece]')?.getAttribute('data-piece') === id;
		});
		const best = visible ?? candidates[0];
		return point(best.along, best.across);
	};

	const measure = () => {
		const panel = panels.find((candidate) => candidate.dataset.piece === shown);
		if (!shown || !panel) return;
		const style = getComputedStyle(repere);
		const down = style.getPropertyValue('--repere-axis').trim() !== 'y';
		const origin = stage.getBoundingClientRect();
		const band = repere.getBoundingClientRect();
		const view = scene.getBoundingClientRect();
		const anchor = anchorOf(shown, down);
		// Les cibles au pixel entier : le trait de 1 px finit net, seul le glissement passe entre deux.
		const x = Math.round(anchor.x - origin.left);
		const y = Math.round(anchor.y - origin.top);
		if (down) {
			// Le bas du panneau, sans son décalage en cours : les panneaux sont alignés en bas du bandeau.
			const top = Math.round(band.bottom - origin.top - parseFloat(style.paddingBottom) + GAP);
			target = {
				x: Math.round(clamp(anchor.x - band.left - NUMBER_CENTER, 0, repere.clientWidth - panel.offsetWidth)),
				y: 0,
				leaderX: x,
				leaderY: top,
				leaderW: 1,
				leaderH: Math.max(0, y - top),
			};
		} else {
			const left = Math.round(band.right - origin.left + GAP);
			target = {
				x: 0,
				y: Math.round(clamp(anchor.y - band.top - NUMBER_CENTER, 0, repere.clientHeight - panel.offsetHeight)),
				leaderX: left,
				leaderY: y,
				leaderW: Math.max(0, x - left),
				leaderH: 1,
			};
		}
		// Une pièce coupée par le recadrage du téléphone n'a pas de pointe dans le vide.
		repere.toggleAttribute('data-placed', anchor.x >= view.left && anchor.x <= view.right);
		motion.kick();
	};

	// Au dixième de pixel : un glissement arrondi au pixel finirait en escalier.
	const write = (place: Place) => {
		const shift = `${px(place.x)} ${px(place.y)}`;
		for (const panel of panels) panel.style.translate = shift;
		// Le trait est un carré de 1 px étiré : changer sa taille relancerait la mise en page de la
		// scène, donc de toute la figure, à chaque image.
		if (leader) {
			leader.style.translate = `${px(place.leaderX)} ${px(place.leaderY)}`;
			leader.style.scale = `${place.leaderW.toFixed(2)} ${place.leaderH.toFixed(2)}`;
		}
		if (tip) tip.style.translate = `${px(place.leaderX + place.leaderW - 4)} ${px(place.leaderY + place.leaderH - 4)}`;
	};

	const motion = loop(repere, (dt, calm) => {
		if (!target) return false;
		const to = target;
		const from = current ?? to;
		current = { ...from };
		for (const key of KEYS) current[key] = follow(from[key], to[key], dt, GLIDE, calm);
		write(current);
		return KEYS.some((key) => current?.[key] !== to[key]);
	});

	// La mise en page change (largeur, polices) : la nouvelle place est prise d'un coup.
	const resized = new ResizeObserver(() => {
		current = null;
		measure();
	});
	resized.observe(stage);

	// Une mesure par image au plus : le pointeur qui traverse plusieurs pièces d'un coup ne fait
	// mesurer que la dernière, une fois la mise en avant appliquée.
	let frame = 0;
	return {
		aim: (id: string | null) => {
			shown = id ?? master;
			frame ||= requestAnimationFrame(() => {
				frame = 0;
				measure();
			});
		},
		stop: () => {
			cancelAnimationFrame(frame);
			motion.stop();
			resized.disconnect();
			repere.removeAttribute('data-placed');
		},
	};
}
