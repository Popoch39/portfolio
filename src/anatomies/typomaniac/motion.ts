// Mouvement du banc de duel : le duel du modèle tourne en mémoire, et la figure le lit à chaque
// image. Au repos, le tour joue un duel classé complet, avec un saut avoué au milieu de chaque
// manche. Le visiteur est le joueur A : un clic sur son clavier frappe la lettre attendue, une
// vraie touche frappe ce caractère ; le pilote de A s'arrête alors, et reprend 5 s après.
import { solidSvg, translateAlong, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, loop } from '../live.ts';
import * as L from './layout.ts';
import {
	armOpening,
	bandeau,
	barLevel,
	clientRun,
	createDuel,
	drumTime,
	expectedKey,
	keyDepth,
	lampLevel,
	LOOP_MS,
	mmrOf,
	press,
	pulsesOn,
	readoutOf,
	restDuel,
	resumeTour,
	rush,
	RUNNING,
	sliderPose,
	START,
	takeOver,
	tokenAt,
	advance,
	type Duel,
} from './model.ts';

/** Le tour démarre 1,4 s après le montage ; la main du visiteur rend la main au pilote après 5 s. */
const TOUR_START = 1.4;
const RESUME_MS = 5000;
/** Une touche survolée se soulève à peine. */
const HOVER_LIFT = 0.4;
const KEY_TRAVEL = 1.1;

const mount: MountMotion = ({ scene, svg, readout }) => {
	const all = (selector: string) => [...svg.querySelectorAll<SVGElement>(selector)];
	const one = (selector: string) => svg.querySelector<SVGElement>(selector);

	// Tout ce que le mouvement écrit est noté une fois, pour rendre la figure au repos exact.
	const saved = new Map<Element, Map<string, string | null>>();
	const set = (node: Element | null, name: string, value: string | null) => {
		if (!node || node.getAttribute(name) === value) return;
		let attributes = saved.get(node);
		if (!attributes) saved.set(node, (attributes = new Map()));
		if (!attributes.has(name)) attributes.set(name, node.getAttribute(name));
		if (value === null) node.removeAttribute(name);
		else node.setAttribute(name, value);
	};
	const lift = (by: number) => (Math.abs(by) < 1e-3 ? null : translateAlong(L.P, [0, 0, by]));

	const bySide = (name: string) => [0, 1].map((side) => tm(`${name}"][data-side="${side}`));
	const tm = (name: string) => one(`[data-tm="${name}"]`);
	const keys = all('[data-tm="key"]');
	const bars = bySide('bar');
	const bands = bySide('text').map((node) => [...(node?.querySelectorAll('text, rect.iso-line') ?? [])]);
	const words = bands.map(([typed, pending]) => [typed.textContent, pending.textContent]);
	const glows = all('[data-tm="glow"]');
	// Chaque tronçon de câble porte son câble, sa portée et ses longueurs : `câble s0 s1 total écran`.
	const pulses = all('[data-pulse]').map((node) => {
		const [cable, s0, s1, total, screen] = (node.dataset.pulse ?? '').split(' ').map(Number);
		return { node, cable, s0, s1, total, screen };
	});
	const drum = tm('drum');
	const sliders = bySide('slider');
	const verniers = bySide('vernier');
	const flags = bySide('flag');
	const weight = tm('weight');
	const lever = tm('lever');
	const pointer = tm('knob');
	const niche = tm('niche');
	const arms = [0, 1, 2, 3].map((index) => tm(`arm${index}`));
	// Le tambour et les bras se redessinent : leur tracé au repos est gardé tel quel.
	const redrawn = [drum, ...arms].map((node) => [node, node?.innerHTML ?? ''] as const);
	const partOf = (name: string) => one(`[data-niche="guichet.${name}"]`)?.parentElement ?? null;
	const tokens = all('[data-tm^="token"]');
	const template = tokens[tokens.length - 1];
	const clones: Element[] = [];
	const nicheChildren = niche ? [...niche.children] : [];

	// Les textes des manches viennent du SVG au repos, qui les porte sur le bandeau de A.
	const texts = (one('[data-texts]')?.dataset.texts ?? '').split('|').map((text) => text.split(' '));
	let duel: Duel = restDuel(texts);
	let ranked = true;
	let touring = !asksForStillness();
	let wait = TOUR_START;
	let hovered: Element | null = null;
	let resume = 0;
	let knob = L.KNOB_ANGLE.ranked;
	/** En mouvement réduit, le jeton d'une frappe apparaît accepté au bout du rail, sans trajet. */
	let parked: number | null = null;
	// Ce qui est déjà dessiné, pour ne réécrire un tracé que s'il change.
	const fresh = () => ({ drum: -1, arms: [-1, -1, -1, -1], order: '' });
	let shown = fresh();
	const rest = readout.textContent;

	const draw = (calm: boolean) => {
		// Touches : frappées, ou soulevées sous le pointeur.
		for (const node of keys) {
			const side = Number(node.dataset.side);
			const depth = keyDepth(duel, side, node.dataset.key ?? '') * KEY_TRAVEL;
			set(node, 'transform', lift((node === hovered ? HOVER_LIFT : 0) - depth));
		}
		const level = barLevel(duel);
		bars.forEach((node) => set(node, 'transform', lift((L.BAR.down - L.BAR.up) * level)));
		// Bandeaux : les cases de lettres ne bougent pas, seuls leur texte et le curseur creux changent.
		bands.forEach(([typed, pending, rival], side) => {
			const { chars, opponent } = bandeau(duel, side, L.GLYPH.cursor, L.GLYPH.span);
			if (typed.textContent !== chars.slice(0, L.GLYPH.cursor)) typed.textContent = chars.slice(0, L.GLYPH.cursor);
			if (pending.textContent !== chars.slice(L.GLYPH.cursor)) pending.textContent = chars.slice(L.GLYPH.cursor);
			set(rival, 'x', (Math.max(opponent, 0) * L.GLYPH.advance - 0.3).toFixed(1));
			set(rival, 'opacity', opponent < 0 ? '0' : null);
		});
		glows.forEach((node) => set(node, 'opacity', (lampLevel(duel, Number(node.dataset.side), Number(node.dataset.i)) * 0.78).toFixed(2)));
		const onCable = [pulsesOn(duel, 0), pulsesOn(duel, 1)];
		for (const pulse of pulses) set(pulse.node, 'stroke-dasharray', L.pulseDash(onCable[pulse.cable], pulse.total, pulse.s0, pulse.s1, pulse.screen));
		const t = drumTime(duel);
		if (Math.abs(t - shown.drum) > 0.004) {
			shown.drum = t;
			if (drum) drum.innerHTML = L.drumMarksSvg(t);
		}
		// Mât : le curseur monte d'un cran, le vernier glisse, le drapeau bascule (dessinés dans la pose au repos).
		[0, 1].forEach((side) => {
			const start = duel.standings[side];
			const pose = sliderPose(duel, side);
			const z = L.notchZ(start.step) + L.SLIDER.h / 2;
			set(sliders[side], 'transform', lift(L.notchZ(pose.step) - L.notchZ(start.step)));
			set(verniers[side], 'transform', translateAlong(L.P, [0, ((pose.tp - start.tp) / 100) * (L.SLIDER.d - 2), 0]));
			const inward = side ? 1 : -1;
			set(flags[side], 'transform', pose.shield ? L.turnIn(L.flagHinge(side, z), [0, inward, 0], [0, 0, 1], pose.shield * L.FLAG_SWING) : null);
		});
		set(weight, 'transform', translateAlong(L.P, [0, 0, L.weightZ(mmrOf(duel))]));
		const tripped = duel.over?.forfeit ? Math.min(1, (duel.clock - duel.over.at) / 90) : 0;
		set(lever, 'transform', tripped ? L.turnIn(L.LEVER_PIVOT, [1, 0, 0], [0, 0, 1], tripped * L.LEVER_SWING) : null);
		const turned = knob - L.KNOB_ANGLE.ranked;
		set(pointer, 'transform', Math.abs(turned) > 1e-3 ? L.turnIn([L.KNOB.x, L.KNOB.y, L.KNOB.z + L.KNOB.h], [1, 0, 0], [0, 1, 0], turned) : null);
		drawNiche(calm);
		const text = readoutOf(duel);
		if (readout.textContent !== text) readout.textContent = text;
	};

	const drawNiche = (calm: boolean) => {
		const openings = arms.map((_, index) => armOpening(duel, index));
		openings.forEach((opening, index) => {
			if (Math.abs(opening - shown.arms[index]) < 1e-3) return;
			shown.arms[index] = opening;
			const arm = arms[index];
			if (arm) arm.innerHTML = solidSvg(L.armPaths(index, opening), { tone: 'hi' });
		});
		const on = duel.trips.map((trip) => tokenAt(trip, duel.clock)).filter((at): at is number => at !== null);
		if (calm && parked !== null) on.push(parked);
		while (tokens.length + clones.length < on.length + 1 && template) {
			const copy = template.closest('[data-piece]')?.cloneNode(true) as Element;
			const index = tokens.length + clones.length;
			copy.querySelector('[data-niche]')?.setAttribute('data-niche', `guichet.token${index}`);
			copy.querySelector('[data-tm^="token"]')?.setAttribute('data-tm', `token${index}`);
			niche?.append(copy);
			clones.push(copy);
		}
		const nodes = [...tokens, ...clones.map((copy) => copy.querySelector('[data-tm^="token"]') as SVGElement)];
		const slots: (number | null)[] = nodes.map((_, index) => on[index] ?? null);
		nodes.forEach((node, index) => {
			const at = slots[index];
			const shift = at === null ? null : (L.railPoint(at).map((v, i) => v - L.railPoint(0)[i]) as Point3);
			set(node, 'transform', shift ? translateAlong(L.P, shift) : null);
			const fade = at === null ? 0 : L.tokenOpacity(at);
			set(node, 'opacity', fade >= 1 ? null : fade.toFixed(2));
		});
		// Le jeton passe devant ou derrière un bras selon son côté : la niche se réordonne.
		const order = L.nicheOrder(openings, slots);
		const key = order.join();
		if (key !== shown.order && niche) {
			shown.order = key;
			for (const name of order) {
				const part = partOf(name);
				if (part) niche.append(part);
			}
		}
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) {
			draw(true);
			return false;
		}
		if (touring && wait > 0) {
			wait -= dt;
			draw(false);
			return true;
		}
		advance(duel, dt * 1000);
		// Après le classement, le banc revient au repos et un nouveau duel commence.
		if (duel.over && duel.clock - duel.over.at >= LOOP_MS) restart();
		draw(false);
		return true;
	});

	/** Un nouveau duel, au format choisi, piloté comme l'était le précédent. */
	function restart() {
		const tour = duel.tour;
		duel = createDuel(texts, ranked, START);
		if (!tour) takeOver(duel);
	}

	// --- Le visiteur frappe ---
	const strike = (name: string) => {
		takeOver(duel);
		press(duel, 0, name);
		if (asksForStillness()) {
			// Mouvement réduit : la frappe passe tout de suite, le jeton se pose accepté au bout du rail.
			rush(duel);
			parked = duel.phase === RUNNING ? 0.75 : null;
		} else {
			wait = 0;
			touring = false;
			clearTimeout(resume);
			resume = window.setTimeout(() => {
				resumeTour(duel);
				touring = true;
				motion.kick();
			}, RESUME_MS);
		}
		motion.kick();
	};

	const wiring = new AbortController();
	const { signal } = wiring;
	const target = (event: Event, selector: string) => (event.target instanceof Element ? event.target.closest(selector) : null);

	scene.addEventListener(
		'keydown',
		(event) => {
			if (event.metaKey || event.altKey) return;
			let name: string | null = null;
			if (event.key === 'Backspace') name = event.ctrlKey ? 'deleteWord' : 'Backspace';
			else if (event.key.length === 1 && !event.ctrlKey) name = event.key;
			if (!name) return;
			event.preventDefault();
			strike(name.length > 1 ? name : name.toLowerCase());
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerdown',
		(event) => {
			if (target(event, '[data-tm="selector"]')) {
				// Classé (Bo3, mât actif) ↔ Défi (une manche, mât immobile) : un nouveau duel commence.
				ranked = !ranked;
				restart();
				knob = ranked ? L.KNOB_ANGLE.ranked : L.KNOB_ANGLE.challenge;
				shown = fresh();
				motion.kick();
				return;
			}
			if (target(event, '[data-board="a"]')) {
				event.preventDefault();
				strike(expectedKey(clientRun(duel, 0)));
			}
		},
		{ signal },
	);
	scene.addEventListener(
		'pointermove',
		(event) => {
			if (event.pointerType === 'touch') return;
			const key = target(event, '[data-tm="key"][data-side="0"]');
			if (key !== hovered) {
				hovered = key;
				motion.kick();
			}
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerleave',
		() => {
			hovered = null;
			motion.kick();
		},
		{ signal },
	);

	const attributes = {
		role: 'application',
		'aria-label': 'Banc de duel, joueur A : tapez une lettre ou l’espace pour frapper, retour arrière pour effacer, Ctrl + retour arrière pour effacer le mot.',
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);
	draw(asksForStillness());

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		for (const copy of clones) copy.remove();
		for (const child of nicheChildren) niche?.append(child);
		for (const [node, values] of saved) {
			for (const [name, value] of values) {
				if (value === null) node.removeAttribute(name);
				else node.setAttribute(name, value);
			}
		}
		saved.clear();
		for (const [node, html] of redrawn) if (node) node.innerHTML = html;
		bands.forEach(([typed, pending], side) => {
			typed.textContent = words[side][0];
			pending.textContent = words[side][1];
		});
		readout.textContent = rest;
	};
};

export default mount;
