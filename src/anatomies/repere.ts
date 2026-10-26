// Placement du repère de la fiche : l'étiquette glisse jusqu'à la pièce visée (la pièce maîtresse
// au repos), son trait la rejoint et la pointe s'y pose. Au-dessus de la figure, l'étiquette glisse
// en x et le trait descend ; à côté d'une figure haute, elle glisse en y et le trait part vers la
// droite : la CSS du repère en décide (`--repere-axis`). Les panneaux sont écrits au build et la
// mise en avant choisit le visible (`data-on`) : ce module ne fait que mesurer et placer, en
// propriétés CSS du repère. Il suit la pièce quand la figure la déplace.
import { follow, loop } from './live.ts';

/** Constante de temps du glissement (s) : l'étiquette arrive en un tiers de seconde environ. */
const GLIDE = 0.1;
/** Écart entre l'étiquette et le début du trait (px). */
const GAP = 8;
/** Le trait s'aligne sur le centre du numéro de l'étiquette, large de 30 px. */
const NUMBER_CENTER = 15;
/** Lignes sondées dans la boîte de la pièce, du milieu vers les bords, et pas de la sonde (px). */
const LINES = [0.5, 0.35, 0.65, 0.2, 0.8];
const STEP = 2;
/** Une figure en mouvement est remesurée au plus à ce rythme (ms). */
const REMEASURE = 120;

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

const KEYS = ['x', 'y', 'leaderX', 'leaderY', 'leaderW', 'leaderH'] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Place le repère `repere` sur la figure `svg` de la scène `scene`. Renvoie `aim`, à appeler à
 * chaque changement de pièce visée (`null` : plus rien de visé), et de quoi tout débrancher.
 */
export function placeRepere(repere: HTMLElement, scene: HTMLElement, svg: SVGSVGElement) {
	const stage = repere.parentElement ?? repere;
	const panels = [...repere.querySelectorAll<HTMLElement>('[data-piece]')];
	const master = panels.find((panel) => panel.hasAttribute('data-master'))?.dataset.piece ?? null;
	let shown = master;
	let target: Place | null = null;
	let current: Place | null = null;

	/**
	 * Le premier point visible de la pièce (rien ne la cache) en venant de l'étiquette : le plus haut
	 * quand le trait descend, le plus à gauche quand il part vers la droite. Le trait s'y pose sans
	 * traverser la pièce elle-même. Hors de l'écran, faute de mieux, le bord de sa boîte.
	 */
	const anchorOf = (id: string, down: boolean) => {
		const boxes = [...svg.querySelectorAll(`[data-piece="${CSS.escape(id)}"]`)].map((hook) => hook.getBoundingClientRect());
		const box = boxes.reduce((largest, b) => (b.width * b.height > largest.width * largest.height ? b : largest));
		// Coordonnées le long de la sonde (`along`) et en travers (`across`).
		const [start, end, from, span, limit] = down
			? [box.top, box.bottom, box.left, box.width, innerHeight]
			: [box.left, box.right, box.top, box.height, innerWidth];
		const point = (along: number, across: number) => (down ? { x: across, y: along } : { x: along, y: across });
		let best: { along: number; across: number } | null = null;
		for (const fraction of LINES) {
			const across = from + fraction * span;
			if (across < 0 || across >= (down ? innerWidth : innerHeight)) continue;
			for (let along = Math.max(start, 0); along <= Math.min(end, limit - 1) && (!best || along < best.along); along += STEP) {
				const { x, y } = point(along, across);
				if (document.elementFromPoint(x, y)?.closest('[data-piece]')?.getAttribute('data-piece') === id) {
					best = { along, across };
					break;
				}
			}
		}
		return best ? point(best.along, best.across) : point(start, from + span / 2);
	};

	const measure = () => {
		const panel = panels.find((candidate) => candidate.dataset.piece === shown);
		if (!shown || !panel) return;
		const down = getComputedStyle(repere).getPropertyValue('--repere-axis').trim() !== 'y';
		const origin = stage.getBoundingClientRect();
		const band = repere.getBoundingClientRect();
		const view = scene.getBoundingClientRect();
		const anchor = anchorOf(shown, down);
		const x = anchor.x - origin.left;
		const y = anchor.y - origin.top;
		if (down) {
			const top = panel.getBoundingClientRect().bottom - origin.top + GAP;
			target = {
				x: clamp(anchor.x - band.left - NUMBER_CENTER, 0, repere.clientWidth - panel.offsetWidth),
				y: 0,
				leaderX: x,
				leaderY: top,
				leaderW: 1,
				leaderH: Math.max(0, y - top),
			};
		} else {
			const left = band.right - origin.left + GAP;
			target = {
				x: 0,
				y: clamp(anchor.y - band.top - NUMBER_CENTER, 0, repere.clientHeight - panel.offsetHeight),
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

	const write = (place: Place) => {
		repere.style.setProperty('--repere-x', `${place.x.toFixed(1)}px`);
		repere.style.setProperty('--repere-y', `${place.y.toFixed(1)}px`);
		repere.style.setProperty('--leader-x', `${Math.round(place.leaderX)}px`);
		repere.style.setProperty('--leader-y', `${Math.round(place.leaderY)}px`);
		repere.style.setProperty('--leader-w', `${Math.round(place.leaderW)}px`);
		repere.style.setProperty('--leader-h', `${Math.round(place.leaderH)}px`);
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
	// Hors de l'écran, la pièce n'est pas sondée : elle l'est dès qu'elle y revient.
	const seen = new IntersectionObserver((entries) => entries[entries.length - 1].isIntersecting && measure(), { threshold: [0, 0.5, 1] });
	seen.observe(scene);
	// La figure déplace ses pièces : la pointe les suit.
	let pending = 0;
	const moved = new MutationObserver(() => {
		if (!pending) pending = window.setTimeout(() => ((pending = 0), measure()), REMEASURE);
	});
	moved.observe(svg, { subtree: true, childList: true, attributeFilter: ['transform', 'd', 'points', 'x', 'y'] });

	return {
		aim: (id: string | null) => {
			shown = id ?? master;
			measure();
		},
		stop: () => {
			motion.stop();
			resized.disconnect();
			seen.disconnect();
			moved.disconnect();
			clearTimeout(pending);
			repere.removeAttribute('data-placed');
		},
	};
}
