// Mouvement de la colonne de sondage. Maintenir l'appui sur le fût (pointeur, doigt, ou ↓ au
// clavier) fait forer : le carottier descend à vitesse constante de la vis après une rampe courte,
// et s'arrête net au relâcher. Au fond, le treuil remonte le tube intérieur puis le carottier
// remonte. Le plateau (ou Entrée) relance le sondage, depuis le cache dès qu'un sondage a abouti.
// Au repos, un tour fore strate par strate ; un tour sur deux perd la strate Bâtiment.
import { translateAlong, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, loop, spring, type Spring } from '../live.ts';
import {
	boreClipAt,
	boreEdgesAt,
	cableClipAt,
	CORE_SCALE,
	couplingPaths,
	crankEnd,
	crankPaths,
	drumMarks,
	DRUM_R,
	LID,
	NOTCH,
	onCylinder,
	projection as P,
	R_BOTTOM,
	R_LID,
	RIGHT,
	setSolid,
	teethPaths,
	TUBAGE_TOP,
} from './layout.ts';
import * as M from './model.ts';

/** Le tour : un temps au repos, le choix, puis un arrêt dans chaque strate. */
const REST_WAIT = 1.3;
const CHOICE_WAIT = 0.7;
const STRATUM_WAIT = 0.75;
/** Reprise du tour après la dernière interaction. */
const RESUME_MS = 4000;
/** Au toucher, un appui long sans glisser : le temps de laisser partir un défilement. */
const TOUCH_HOLD_MS = 220;
/** Les curseurs du log se calent sur un petit ressort. */
const SLIDER = { stiffness: 260, damping: 17 };

type Action =
	| { kind: 'move'; target: number; top: number }
	| { kind: 'wait'; time: number }
	| { kind: 'hoist'; time: number }
	| { kind: 'call'; run: () => void };

/** Ce que le dernier sondage a carotté : le log et la carotte le gardent jusqu'au suivant. */
interface Run {
	reached: number;
	lost: boolean;
	cached: boolean;
}

const at = (selector: string, root: Element) => [...root.querySelectorAll(`[data-mp="${selector}"]`)];

const mount: MountMotion = ({ scene, svg, readout }) => {
	const rides = at('ride', svg);
	const core = at('core', svg)[0];
	const lostBand = svg.querySelector('[data-band="4"]');
	const boreClip = at('bore-clip', svg)[0];
	const floor = at('floor', svg)[0];
	const boreEdges = at('bore-edges', svg)[0];
	const cableClip = at('cable-clip', svg)[0];
	const thread = at('thread', svg)[0];
	const crank = at('crank', svg)[0];
	const knobs = at('knob', svg);
	const drum = at('drum', svg)[0];
	const couplings = at('coupling', svg);
	const teeth = at('tooth', svg);
	const groove = at('groove', svg)[0];
	const lamp = at('lamp', svg)[0]?.firstElementChild;
	const sliders = at('slider', svg);

	// État du sondage, recréé à chaque montage.
	let depth = 0;
	let speed = 0;
	let hoist = 0;
	let spin = 0;
	let selected = false;
	let done = false;
	let record: Run | null = null;
	let completed = false;
	let queue: Action[] = [];
	/** Appui maintenu : 1 fore, -1 remonte, 0 rien. */
	let hold: 0 | 1 | -1 = 0;
	/** La séquence du fond (treuil puis remontée) ne se laisse pas interrompre par un appui. */
	let locked = false;
	let touring = !asksForStillness();
	let tours = 0;
	let resume = 0;
	let touchTimer = 0;
	const springs: Spring[] = sliders.map(() => ({ at: 0, rate: 0 }));
	/** Dernière valeur écrite de chaque attribut : on ne touche au DOM que quand elle change. */
	const written = new Map<Element, Map<string, string | null>>();
	let drawnSpin = Number.NaN;
	let drawnTurn = Number.NaN;

	const write = (node: Element | null | undefined, name: string, value: string | null) => {
		if (!node) return;
		const entry = written.get(node) ?? new Map<string, string | null>();
		if (entry.has(name) && entry.get(name) === value) return;
		entry.set(name, value);
		written.set(node, entry);
		if (value === null) node.removeAttribute(name);
		else node.setAttribute(name, value);
	};
	const shift = (by: Point3) => (by.every((v) => Math.abs(v) < 1e-4) ? null : translateAlong(P, by));

	const sounding = (): M.Sounding => ({
		depth,
		reached: record?.reached ?? 0,
		selected,
		lost: record?.lost ?? false,
		cached: record?.cached ?? false,
		done,
	});

	const select = (lost: boolean, cached: boolean) => {
		record = { reached: 0, lost, cached };
		selected = true;
		done = false;
		hoist = 0;
	};
	const finish = () => {
		selected = false;
		done = false;
		locked = false;
	};
	/** Arrivé au fond : le treuil remonte le tube intérieur, puis le carottier remonte au repos. */
	const bottomOut = (calm: boolean) => {
		done = true;
		completed = true;
		hold = 0;
		if (calm) {
			hoist = 1;
			queue = [];
			return;
		}
		locked = true;
		const fast = record?.cached ? M.CACHED / 2 : 1;
		queue = [{ kind: 'hoist', time: M.HOIST_TIME / fast }, { kind: 'move', target: 0, top: M.RISE * fast }, { kind: 'call', run: finish }];
	};
	/** Le prochain arrêt du tour : le bas de la strate où se trouve la couronne. */
	const nextStop = () => M.STRATA.map((_, index) => M.depthThrough(index)).find((stop) => stop > depth + 1e-6) ?? M.DEPTH;

	const plan = () => {
		if (!selected) {
			if (depth > 1e-6) queue.push({ kind: 'move', target: 0, top: M.RISE });
			else
				queue.push(
					{ kind: 'wait', time: REST_WAIT },
					{ kind: 'call', run: () => select(tours++ % 2 === 1, false) },
					{ kind: 'wait', time: CHOICE_WAIT },
				);
			return;
		}
		if (done) return;
		const stop = nextStop();
		queue.push({ kind: 'move', target: stop, top: M.FEED });
		if (stop < M.DEPTH) queue.push({ kind: 'wait', time: STRATUM_WAIT });
	};

	/** Avance la file d'actions de `dt` ; renvoie vrai si quelque chose bouge. */
	const run = (dt: number, calm: boolean) => {
		let budget = dt;
		while (queue.length && budget > 0) {
			const action = queue[0];
			if (action.kind === 'call') {
				queue.shift();
				action.run();
				continue;
			}
			if (action.kind === 'wait') {
				const used = calm ? action.time : Math.min(action.time, budget);
				action.time -= used;
				budget = calm ? budget : budget - used;
				if (action.time <= 1e-9) queue.shift();
				else break;
				continue;
			}
			if (action.kind === 'hoist') {
				const used = calm ? action.time : Math.min(action.time, budget);
				hoist = Math.min(1, hoist + used / M.HOIST_TIME);
				action.time -= used;
				budget = calm ? budget : budget - used;
				if (action.time <= 1e-9) {
					hoist = 1;
					queue.shift();
				} else break;
				continue;
			}
			const before = depth;
			if (calm) {
				depth = action.target;
				speed = 0;
			} else {
				const step = M.feed(depth, speed, action.target, budget, action.top);
				depth = step.depth;
				speed = step.speed;
				budget = 0;
			}
			if (depth > before) spin += (calm ? 0 : dt) * M.SPIN * 2 * Math.PI;
			if (Math.abs(depth - action.target) < 1e-9) {
				speed = 0;
				queue.shift();
				if (depth >= M.DEPTH - 1e-9 && selected && !done) bottomOut(calm);
			}
		}
	};

	const step = (dt: number, calm: boolean) => {
		if (calm) touring = false;
		if (hold && !locked) {
			if (calm) {
				// Mouvement réduit : chaque appui place le carottier à la strate visée, sans transition.
				const stops = [0, ...M.STRATA.map((_, index) => M.depthThrough(index))];
				depth = hold > 0 ? (stops.find((stop) => stop > depth + 1e-6) ?? M.DEPTH) : ([...stops].reverse().find((stop) => stop < depth - 1e-6) ?? 0);
				hold = 0;
			} else {
				const target = hold > 0 ? M.DEPTH : 0;
				const next = M.feed(depth, speed, target, dt);
				if (next.depth > depth) spin += dt * M.SPIN * 2 * Math.PI;
				depth = next.depth;
				speed = next.speed;
				if (next.arrived) speed = 0;
			}
			if (depth >= M.DEPTH - 1e-9 && selected && !done) bottomOut(calm);
		} else {
			if (!queue.length && touring) plan();
			run(dt, calm);
		}
		if (selected && record) record.reached = Math.max(record.reached, depth);
		// Remonté au plateau après un sondage complet (Début ou ↑, en mouvement réduit) : il est fini.
		if (done && !locked && depth <= 1e-9) finish();
	};

	const draw = (dt: number, calm: boolean) => {
		const state = sounding();
		const move = shift([0, 0, -depth]);
		for (const node of rides) write(node, 'transform', move);

		const cored = record ? M.coreOf({ ...state, selected: true }) : 0;
		write(core, 'transform', shift([0, 0, -CORE_SCALE * (M.TOTAL_REQUESTS - cored) + hoist * M.HOIST]));
		write(lostBand, 'visibility', record?.lost ? 'hidden' : null);

		const floorZ = Math.min(M.bitAt(record?.reached ?? 0), M.SOIL_TOP);
		write(boreClip, 'd', boreClipAt(floorZ, M.SOIL_TOP));
		write(boreEdges, 'd', boreEdgesAt(floorZ, M.SOIL_TOP));
		write(floor, 'transform', translateAlong(P, [0, 0, floorZ]));
		write(cableClip, 'd', cableClipAt(depth));
		write(thread, 'transform', shift([0, 0, -(depth % M.THREAD)]));

		const turn = (2 * Math.PI * depth) / M.LEAD;
		if (turn !== drawnTurn) {
			drawnTurn = turn;
			if (crank) setSolid(crank, crankPaths(turn));
			const end = crankEnd(turn);
			const rest = crankEnd(0);
			const behind = Math.cos(turn - Math.PI / 4) < 0;
			for (const knob of knobs) {
				write(knob, 'transform', shift([end[0] - rest[0], end[1] - rest[1], 0]));
				write(knob, 'visibility', (knob.getAttribute('data-slot') === 'back') === behind ? null : 'hidden');
			}
		}
		const marks = drumMarks((depth + hoist * M.HOIST) / DRUM_R);
		[...(drum?.children ?? [])].forEach((dot, index) => {
			write(dot, 'cx', marks[index][0].toFixed(1));
			write(dot, 'cy', marks[index][1].toFixed(1));
		});
		if (spin !== drawnSpin) {
			drawnSpin = spin;
			couplings.forEach((node, index) => setSolid(node, couplingPaths(index, spin)));
			const sorted = teethPaths(spin);
			teeth.forEach((node, index) => setSolid(node, sorted[index]));
		}

		write(groove, 'data-tone', selected ? 'lit' : 'mid');
		write(lamp, 'data-lit', M.pendingOf(state) ? '' : null);

		const levels = record ? M.logOf({ ...state, selected: true }) : M.STRATA.map(() => 0);
		let settled = true;
		springs.forEach((state, index) => {
			settled = spring(state, levels[index] * NOTCH, dt, SLIDER.stiffness, SLIDER.damping, calm) && settled;
			write(sliders[index], 'transform', shift([RIGHT[0] * state.at, RIGHT[1] * state.at, 0]));
		});

		const text = M.readoutOf(state);
		if (readout.textContent !== text) {
			readout.textContent = text;
			scene.setAttribute('aria-valuetext', text);
		}
		const read = String(selected && record ? M.strataThrough(record.reached) : 0);
		if (scene.getAttribute('aria-valuenow') !== read) scene.setAttribute('aria-valuenow', read);
		return settled;
	};

	const motion = loop(scene, (dt, calm) => {
		step(dt, calm);
		const settled = draw(dt, calm);
		return touring || hold !== 0 || queue.length > 0 || !settled;
	});

	const pause = () => {
		touring = false;
		clearTimeout(resume);
		if (!locked) queue = [];
	};
	const resumeLater = () => {
		clearTimeout(resume);
		resume = window.setTimeout(() => {
			if (asksForStillness() || scene.matches(':focus')) return;
			touring = true;
			motion.kick();
		}, RESUME_MS);
	};

	/** Commence un appui maintenu ; un forage depuis le repos choisit d'abord la parcelle. */
	const press = (direction: 1 | -1) => {
		pause();
		if (locked) return;
		if (direction > 0 && (!selected || done)) select(false, false);
		hold = direction;
		speed = 0;
		// Mouvement réduit : le saut a lieu tout de suite, même si la touche est relâchée avant l'image suivante.
		if (asksForStillness()) step(0, true);
		motion.kick();
	};
	const release = () => {
		clearTimeout(touchTimer);
		if (!hold) return;
		hold = 0;
		speed = 0;
		resumeLater();
		motion.kick();
	};
	/** Relance le sondage depuis le plateau : remonter, choisir la parcelle, redescendre d'une traite. */
	const relaunch = () => {
		pause();
		hold = 0;
		locked = false;
		const cached = completed;
		const rate = cached ? M.CACHED : 1;
		queue = [];
		if (depth > 1e-6) queue.push({ kind: 'move', target: 0, top: M.RISE * M.CACHED });
		queue.push({ kind: 'call', run: () => select(false, cached) }, { kind: 'move', target: M.DEPTH, top: M.FEED * rate });
		resumeLater();
		motion.kick();
	};

	const pointAt = (event: PointerEvent | MouseEvent) => {
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		return [point.x, point.y] as [number, number];
	};
	const zoneOf = (event: PointerEvent | MouseEvent) => {
		const point = pointAt(event);
		if (!point) return null;
		if (onCylinder(point, R_LID, LID[0], TUBAGE_TOP)) return 'plateau';
		if (onCylinder(point, R_BOTTOM, 0, LID[0])) return 'column';
		return null;
	};

	const wiring = new AbortController();
	const { signal } = wiring;
	scene.addEventListener(
		'pointerdown',
		(event) => {
			if (event.button !== 0) return;
			const zone = zoneOf(event);
			if (!zone) return;
			if (zone === 'plateau') {
				relaunch();
				return;
			}
			scene.setPointerCapture?.(event.pointerId);
			if (event.pointerType === 'touch') {
				clearTimeout(touchTimer);
				touchTimer = window.setTimeout(() => press(1), TOUCH_HOLD_MS);
			} else {
				event.preventDefault();
				press(1);
			}
		},
		{ signal },
	);
	for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) scene.addEventListener(type, release, { signal });
	scene.addEventListener(
		'contextmenu',
		(event) => {
			if (zoneOf(event) === 'column') event.preventDefault();
		},
		{ signal },
	);
	scene.addEventListener('focus', pause, { signal });
	scene.addEventListener(
		'blur',
		() => {
			release();
			resumeLater();
		},
		{ signal },
	);
	scene.addEventListener(
		'keydown',
		(event) => {
			const { key } = event;
			if (key === 'ArrowDown' || key === 'ArrowUp') {
				event.preventDefault();
				if (!event.repeat) press(key === 'ArrowDown' ? 1 : -1);
				return;
			}
			if (key === 'Home' || key === 'End') {
				event.preventDefault();
				pause();
				if (locked) return;
				if (key === 'End' && (!selected || done)) select(false, false);
				queue = [{ kind: 'move', target: key === 'End' ? M.DEPTH : 0, top: key === 'End' ? M.FEED : M.RISE }];
				motion.kick();
				return;
			}
			if (key === 'Enter') {
				event.preventDefault();
				relaunch();
			}
		},
		{ signal },
	);
	scene.addEventListener(
		'keyup',
		(event) => {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') release();
		},
		{ signal },
	);

	const callout = svg.style.getPropertyValue('-webkit-touch-callout');
	svg.style.setProperty('-webkit-touch-callout', 'none');
	svg.style.setProperty('user-select', 'none');
	const attributes = {
		role: 'slider',
		'aria-label':
			'Colonne de sondage : maintenir flèche bas pour forer les strates, flèche haut pour remonter ; Début ramène au plateau, Fin envoie au fond, Entrée relance le sondage.',
		'aria-valuemin': '0',
		'aria-valuemax': String(M.STRATA.length),
		'aria-valuenow': '0',
		'aria-valuetext': M.REST_READOUT,
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		clearTimeout(touchTimer);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		svg.style.removeProperty('user-select');
		if (callout) svg.style.setProperty('-webkit-touch-callout', callout);
		else svg.style.removeProperty('-webkit-touch-callout');
		depth = 0;
		speed = 0;
		hoist = 0;
		spin = 0;
		selected = false;
		done = false;
		record = null;
		queue = [];
		hold = 0;
		springs.forEach((state) => Object.assign(state, { at: 0, rate: 0 }));
		draw(0, true);
	};
};

export default mount;
