// Mouvement du meuble à fiches. Chaque traction rejoue `GET /api/v1/treks?page=n` : la fiche de
// demande entre dans le gabarit, ses broches lisent les encoches et claquent, puis la fiche
// tombe dans la fente ; le tiroir n sort avec l'inertie d'un caisson plein et finit sur un petit
// choc en butée, pendant que le totalisateur compte ; enfin les fiches montent. Une fiche refusée
// bascule le clapet et glisse au bac de rejet. Au repos, le tour tire les six tiroirs puis rejoue un
// refus ; la poignée se tire à la main (pointeur, doigt) ou au clavier sur la scène.
import { axisVector, translateAlong, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import type { Localized } from '../../lib/i18n.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, follow, loop, spring, type Spring } from '../live.ts';
import {
	BIN_Z,
	CARD_LIFT,
	CARD_STAIR,
	CARDS,
	CHUTE,
	chuteZ,
	flapPath,
	offsetTo,
	openings,
	PIN_COUNT,
	PIN_NOTCH,
	PIN_RAISED,
	PIN_STOP,
	projection as P,
	REJECT,
	REJECT_START,
	REQUEST_DROP,
	REQUEST_FEED,
	REQUEST_RISE,
	restDrop,
	TRAVEL,
	WHEEL_PITCH,
} from './layout.ts';
import { check, DRAWERS, FIELDS, notched, pageRequest, PROXIMITY, REFUSED, releveOf, REST_PAGE, rowsOf, TOTAL, type Request } from './model.ts';

/** Ce que le mouvement annonce, dans la langue du document. */
const T: Localized<{ keys: string; drawer: (n: number) => string }> = {
	fr: {
		keys: 'Meuble à fiches : les flèches choisissent un tiroir, Entrée ou Espace le tire et demande sa page, Échap le repousse.',
		drawer: (n: number) => `Tiroir ${n}, page ${n}`,
	},
	en: {
		keys: 'Card cabinet: the arrow keys choose a drawer, Enter or Space pulls it out and requests its page, Escape pushes it back in.',
		drawer: (n: number) => `Drawer ${n}, page ${n}`,
	},
};

/** Le tiroir : une masse menée vers un peu au-delà de sa butée, qui la frappe et s'y arrête. */
const DRIVE = { stiffness: 14, damping: 7.5, beyond: 14 };
/** À la main : il suit la poignée avec retard, comme un caisson lourd. */
const HAND = { stiffness: 60, damping: 15.5 };
/** Tampons des butées : un ressort raide et bref, sans oscillation qu'on voie. */
const PAD = { stiffness: 6000, damping: 70 };
/** Broches : un ressort raide, peu amorti, qui claque. */
const PIN = { stiffness: 1400, damping: 28 };
/** Le tour : premier geste après 1,4 s, une pause pour lire chaque relevé, reprise 3,6 s après la dernière interaction. */
const TOUR_START = 1.4;
const READ_PAUSE = 1.6;
const RESUME_MS = 3600;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const along = (by: Point3) => translateAlong(P, by);

/** Une étape du déroulé : `update(t)` place les pièces à `t` secondes ; finie quand `done(t)`. */
interface Step {
	begin?: () => void;
	update?: (t: number) => void;
	done: (t: number) => boolean;
}

/** La position d'une roue d'odomètre de rang `place` (1, 10, 100) pour le compte `count`. */
const wheelAt = (count: number, place: number) => (place === 1 ? count : Math.floor(count / place) + smooth(count % place - (place - 1)));
/** La roue des pages : elle passe à la page suivante dès la première fiche qui l'ouvre. */
const pagesAt = (count: number) => {
	const at = (count + 19) / 20;
	return Math.floor(at) + smooth(((at % 1) - 0.95) / 0.05);
};

const mount: MountMotion = ({ locale, scene, svg, releve }) => {
	const texts = T[locale];
	const releveOn = (req: Request) => releveOf(req, locale);
	const atRest = releveOn(pageRequest(REST_PAGE));
	const all = (selector: string) => [...svg.querySelectorAll<SVGElement>(selector)];
	const one = (selector: string) => svg.querySelector<SVGElement>(selector);
	const assembly = one('[data-drawer]');
	const pullOut = one('[data-pull-out]');
	const middle = one('[data-middle]');
	const cardsGroup = one('[data-cards]');
	const traces = all('[data-traces]');
	const cards = all('[data-card]');
	const fronts = openings.map((opening) => one(`[data-front="${opening.drawer}"]`));
	const pins = Array.from({ length: PIN_COUNT }, (_, index) => all(`[data-pin="${index}"]`));
	const bar = one('[data-bar]');
	const comb = one('[data-comb]');
	const notches = Array.from({ length: PIN_COUNT }, (_, index) => one(`[data-notch="${index}"]`));
	const request = one('[data-request]');
	const reject = one('[data-reject]');
	const flaps = all('[data-flap]');
	const wheels = [0, 1, 2, 3].map((index) => one(`[data-wheel="${index}"]`));
	const pullEdges = (index: number) => [...(fronts[index]?.querySelectorAll('[data-pull] .iso-edge') ?? []), ...(index === state.opening ? (assembly?.querySelectorAll('[data-pull] .iso-edge') ?? []) : [])];

	// Tout ce que le mouvement réécrit, pour rendre la figure au repos exact à l'arrêt.
	const touched = [assembly, pullOut, middle, cardsGroup, ...traces, ...cards, ...fronts, ...pins.flat(), bar, comb, ...notches, request, reject, ...flaps, ...wheels, ...all('[data-pull] .iso-edge')].filter(
		(node): node is SVGElement => Boolean(node),
	);
	const saved = touched.map((node) => ['transform', 'visibility', 'opacity', 'd', 'data-tone'].map((name) => [name, node.getAttribute(name)] as const));

	const state = {
		opening: REST_PAGE - 1,
		drawer: { x: TRAVEL, v: 0, mode: 'rest' as 'rest' | 'drive' | 'hand', target: TRAVEL, hand: TRAVEL },
		lift: 1,
		liftTarget: 1,
		pins: Array.from({ length: PIN_COUNT }, (_, index): Spring => ({ at: restDrop(index), rate: 0 })),
		pinTargets: Array.from({ length: PIN_COUNT }, (_, index) => restDrop(index)),
		card: { x: 0, z: 0, opacity: 1 },
		flap: 0,
		flapTarget: 0,
		chute: { shown: false, slide: 0, drop: 0, opacity: 1 },
		count: TOTAL,
		countTarget: TOTAL,
		spinFrom: null as number | null,
		spin: 0,
		counting: false,
		lit: -1,
		selected: REST_PAGE - 1,
		releve: atRest,
	};

	// ——— Écriture du DOM ———

	const set = (node: Element | null | undefined, name: string, value: string | null) => {
		if (!node) return;
		if (value === null) node.removeAttribute(name);
		else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
	};
	const say = (text: string) => {
		state.releve = text;
		if (releve.textContent !== text) releve.textContent = text;
	};
	const showNotches = (req: Request) => notches.forEach((node, index) => set(node, 'visibility', notched(req, FIELDS[index]) ? null : 'hidden'));
	const light = (index: number) => {
		if (index === state.lit) return;
		if (state.lit >= 0) pullEdges(state.lit).forEach((edge) => set(edge, 'data-tone', 'mid'));
		state.lit = index;
		if (index >= 0) pullEdges(index).forEach((edge) => set(edge, 'data-tone', 'hi'));
	};
	const moveTo = (index: number) => {
		const lit = state.lit;
		light(-1);
		set(fronts[state.opening], 'visibility', null);
		state.opening = index;
		set(fronts[index], 'visibility', 'hidden');
		set(assembly, 'transform', along(offsetTo(openings[index])));
		const empty = rowsOf(index + 1) === 0;
		set(cardsGroup, 'visibility', empty ? 'hidden' : null);
		traces.forEach((node) => set(node, 'visibility', empty ? 'hidden' : null));
		light(lit);
	};

	const draw = () => {
		const { x } = state.drawer;
		set(pullOut, 'transform', along([x, 0, 0]));
		set(middle, 'transform', along([-x / 2, 0, 0]));
		set(cardsGroup, 'transform', along([0, 0, CARD_LIFT * state.lift]));
		cards.forEach((node, index) => set(node, 'transform', along([0, 0, CARD_STAIR * (CARDS - 1 - index) * state.lift])));
		pins.forEach((nodes, index) => nodes.forEach((node) => set(node, 'transform', along([0, 0, state.pins[index].at]))));
		const proximity = PROXIMITY.map((field) => state.pins[FIELDS.indexOf(field)].at);
		set(bar, 'transform', along([0, 0, Math.max(...proximity)]));
		const teeth = ['facile', 'moyen', 'difficile', 'tres_difficile'].map((field) => state.pins[FIELDS.indexOf(field as (typeof FIELDS)[number])].at);
		set(comb, 'transform', along([0, 0, Math.max(...teeth)]));
		set(request, 'transform', along([state.card.x, 0, state.card.z]));
		set(request, 'opacity', state.card.opacity < 1 ? state.card.opacity.toFixed(2) : null);
		const d = flapPath(state.flap);
		flaps.forEach((node) => set(node, 'd', d));
		const { shown, slide, drop, opacity } = state.chute;
		set(reject, 'visibility', shown ? null : 'hidden');
		const slope = Math.atan2(CHUTE.end[1] - CHUTE.start[1], CHUTE.end[0] - CHUTE.start[0]);
		set(reject, 'transform', along([0, slide * Math.cos(slope), slide * Math.sin(slope) - drop]));
		set(reject, 'opacity', opacity < 1 ? opacity.toFixed(2) : null);
		// Remise à zéro : chaque roue avance jusqu'à son prochain zéro, toutes ensemble.
		const { spinFrom, spin } = state;
		const roll = (position: number) => {
			const digit = position % 10;
			return spinFrom === null ? digit : digit + ((digit > 1e-3 ? 10 : 0) - digit) * spin;
		};
		const source = spinFrom ?? state.count;
		const positions = [...[100, 10, 1].map((place) => wheelAt(source, place)), pagesAt(source)];
		positions.forEach((position, index) => set(wheels[index], 'transform', `translate(0 ${(-roll(position) * WHEEL_PITCH).toFixed(2)})`));
	};

	// ——— Physique ———

	const settledAt = (stop: number) => state.drawer.mode === 'rest' && state.drawer.x === stop;
	const drive = (open: boolean) => Object.assign(state.drawer, { mode: 'drive', target: open ? TRAVEL + DRIVE.beyond : -DRIVE.beyond });

	const physics = (dt: number, calm: boolean) => {
		const drawer = state.drawer;
		if (calm && drawer.mode === 'drive') Object.assign(drawer, { x: drawer.target > 0 ? TRAVEL : 0, v: 0, mode: 'rest' });
		if (calm && drawer.mode === 'hand') Object.assign(drawer, { x: clamp(drawer.hand, 0, TRAVEL), v: 0 });
		let moving = drawer.mode !== 'rest';
		if (moving && !calm) {
			const steps = Math.max(Math.ceil(dt * 240), 1);
			const slice = dt / steps;
			for (let step = 0; step < steps; step++) {
				const goal = drawer.mode === 'hand' ? drawer.hand : drawer.target;
				const { stiffness, damping } = drawer.mode === 'hand' ? HAND : DRIVE;
				let force = (goal - drawer.x) * stiffness - drawer.v * damping;
				if (drawer.x > TRAVEL) force += -(drawer.x - TRAVEL) * PAD.stiffness - drawer.v * PAD.damping;
				if (drawer.x < 0) force += -drawer.x * PAD.stiffness - drawer.v * PAD.damping;
				drawer.v += force * slice;
				drawer.x += drawer.v * slice;
			}
			// Contre sa butée et presque immobile : le tiroir s'y pose.
			const stop = drawer.target > TRAVEL / 2 ? TRAVEL : 0;
			if (drawer.mode === 'drive' && Math.abs(drawer.x - stop) < 0.6 && Math.abs(drawer.v) < 3) {
				Object.assign(drawer, { x: stop, v: 0, mode: 'rest' });
				moving = false;
			}
		}
		if (state.counting) state.countTarget = TOTAL * clamp(drawer.x / TRAVEL, 0, 1);
		state.lift = follow(state.lift, state.liftTarget, dt, 0.35, calm);
		state.flap = follow(state.flap, state.flapTarget, dt, 0.09, calm);
		state.count = state.counting ? state.countTarget : follow(state.count, state.countTarget, dt, 0.12, calm);
		const pinsAtRest = state.pins.map((pin, index) => spring(pin, state.pinTargets[index], dt, PIN.stiffness, PIN.damping, calm)).every(Boolean);
		const settled = pinsAtRest && state.lift === state.liftTarget && state.flap === state.flapTarget && state.count === state.countTarget;
		return moving || !settled;
	};

	// ——— Déroulé ———

	let queue: Step[] = [];
	let current: Step | null = null;
	let since = 0;
	const wait = (seconds: number): Step => ({ done: (t) => t >= seconds });
	const once = (begin: () => void): Step => ({ begin, done: () => true });

	const closing = (): Step[] => [
		once(() => (state.liftTarget = 0)),
		{ done: () => state.lift < 0.02 },
		once(() => (state.drawer.x > 0 || state.drawer.mode !== 'rest' ? drive(false) : undefined)),
		{ done: () => settledAt(0) },
	];

	/** La fiche entre par la fourche, se pose sur les lèvres ; les broches attendent, relevées. */
	const feed = (req: Request): Step[] => [
		once(() => {
			showNotches(req);
			state.pinTargets.fill(PIN_RAISED);
			state.spinFrom = state.count;
			state.count = state.countTarget = 0;
			state.counting = false;
			say(`GET ?${req.query} → …`);
		}),
		{
			update: (t) => {
				state.spin = smooth(t / 0.45);
				if (state.spin === 1) state.spinFrom = null;
				const slideIn = smooth(t / 0.65);
				state.card.x = -REQUEST_FEED * (1 - slideIn);
				state.card.z = REQUEST_RISE * (1 - smooth((t - 0.7) / 0.2));
				state.card.opacity = clamp(t / 0.3, 0, 1);
				// La fiche refusée du tour précédent s'efface du bac.
				if (state.chute.shown) state.chute.opacity = clamp(1 - t / 0.3, 0, 1);
				if (state.chute.opacity === 0) state.chute.shown = false;
			},
			done: (t) => t >= 0.9,
		},
	];

	/** Les broches tombent une à une ; le verrou triple bute si la proximité est incomplète. */
	const read = (req: Request): Step => {
		const present = PROXIMITY.filter((field) => notched(req, field));
		const targetOf = (field: (typeof FIELDS)[number]) => {
			if (PROXIMITY.includes(field)) return present.length === PROXIMITY.length ? -PIN_NOTCH : 0;
			if (['facile', 'moyen', 'difficile', 'tres_difficile'].includes(field)) return 0;
			if (field === 'pageSize' && notched(req, field)) return check(req).ok ? -PIN_NOTCH : -PIN_STOP;
			return notched(req, field) ? -PIN_NOTCH : 0;
		};
		const stuck = present.length > 0 && present.length < PROXIMITY.length;
		return {
			update: (t) =>
				FIELDS.forEach((field, index) => {
					if (t < index * 0.045) return;
					// La barre du verrou triple : la broche présente pousse, la barre bute et la retient.
					const twitch = stuck && PROXIMITY.includes(field) && t < index * 0.045 + 0.12 ? -1.2 : 0;
					state.pinTargets[index] = targetOf(field) + twitch;
				}),
			done: (t) => t >= FIELDS.length * 0.045 + 0.45,
		};
	};

	/** Les broches se relèvent et la fiche tombe dans la fente (rien ne bouge si elle y est déjà). */
	const release = (): Step[] => {
		let from = 0;
		return [
			once(() => {
				state.pinTargets.fill(PIN_RAISED);
				from = state.card.z;
			}),
			{ update: (t) => (state.card.z = from + (-REQUEST_DROP - from) * smooth(t / 0.35) ** 1.6), done: (t) => t >= 0.35 || from <= -REQUEST_DROP },
		];
	};

	const serving = (index: number): Step[] => [
		once(() => {
			state.counting = true;
			drive(true);
		}),
		{ done: () => settledAt(TRAVEL) },
		once(() => {
			state.counting = false;
			state.countTarget = TOTAL;
			state.liftTarget = 1;
			say(releveOn(pageRequest(index + 1)));
		}),
		{ done: () => state.lift > 0.98 },
	];

	const serve = (index: number): Step[] => {
		const req = pageRequest(index + 1);
		return [...release(), ...closing(), once(() => moveTo(index)), ...feed(req), read(req), ...release(), ...serving(index)];
	};

	/** Une fiche refusée : le clapet bascule, la fiche glisse dans la goulotte et tombe au bac. */
	const refuse = (req: Request): Step[] => {
		const slope = Math.atan2(CHUTE.end[1] - CHUTE.start[1], CHUTE.end[0] - CHUTE.start[0]);
		// Jusqu'à ce que son bord arrière quitte la goulotte, puis la chute jusqu'au fond du bac.
		const travel = (CHUTE.end[0] + 1 - REJECT_START) / Math.cos(slope);
		const lead = CHUTE.end[0] + 1 + REJECT.length * Math.cos(slope);
		const fall = chuteZ(lead) - (BIN_Z[0] + 1.5);
		const slideTime = Math.sqrt((2 * travel) / 260);
		const fallTime = Math.sqrt((2 * fall) / 1400);
		return [
			...release(),
			...closing(),
			...feed(req),
			read(req),
			...release(),
			once(() => (state.flapTarget = 1.2)),
			wait(0.25),
			once(() => Object.assign(state.chute, { shown: true, slide: 0, drop: 0, opacity: 1 })),
			{
				update: (t) => {
					const s = Math.min(t, slideTime);
					state.chute.slide = 130 * s * s;
					state.chute.slide = Math.min(travel, state.chute.slide);
					const f = clamp(t - slideTime, 0, fallTime);
					state.chute.drop = Math.min(fall, 700 * f * f);
				},
				done: (t) => t >= slideTime + fallTime,
			},
			once(() => {
				state.flapTarget = 0;
				say(releveOn(req));
			}),
		];
	};

	// Le tiroir 1 est déjà sorti au repos : le tour reprend au 2, va jusqu'au 6 (vide), rejoue un
	// refus, puis recommence au 1.
	let refusals = 0;
	let tourAt = REST_PAGE;
	const tourNext = () => {
		const step = tourAt % (DRAWERS + 1);
		tourAt++;
		if (step < DRAWERS) return [...serve(step), wait(READ_PAUSE)];
		return [...refuse(REFUSED[refusals++ % REFUSED.length]), wait(READ_PAUSE)];
	};

	// ——— Boucle ———

	let touring = !asksForStillness();
	let idle = 0;
	let resume = 0;

	const sequence = (dt: number, calm: boolean) => {
		for (let guard = 0; guard < 64; guard++) {
			if (!current) {
				if (!queue.length && touring && idle >= TOUR_START) queue = tourNext();
				current = queue.shift() ?? null;
				if (!current) return false;
				since = 0;
				current.begin?.();
			}
			since += dt;
			dt = 0;
			if (calm) {
				current.update?.(Infinity);
				current = null;
				continue;
			}
			current.update?.(since);
			if (!current.done(since)) return true;
			current = null;
		}
		return true;
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) touring = false;
		if (touring && idle < TOUR_START) idle += dt;
		const busy = sequence(dt, calm);
		const moving = physics(dt, calm);
		draw();
		return busy || moving || (touring && !current && !queue.length);
	});

	const pause = () => {
		touring = false;
		clearTimeout(resume);
	};
	const resumeLater = () => {
		clearTimeout(resume);
		resume = window.setTimeout(() => {
			if (asksForStillness() || scene.matches(':focus')) return;
			touring = true;
			idle = TOUR_START;
			motion.kick();
		}, RESUME_MS);
	};
	/** Interrompt le déroulé en cours ; la suite commence par laisser tomber la fiche engagée. */
	const interrupt = () => {
		queue = [];
		current = null;
		state.counting = false;
		state.spinFrom = null;
		state.countTarget = state.count < TOTAL / 2 ? 0 : TOTAL;
		state.flapTarget = 0;
		if (state.chute.shown && state.chute.drop === 0) state.chute.shown = false;
	};
	const describe = (index: number) => texts.drawer(index + 1);
	const select = (index: number) => {
		state.selected = index;
		light(index);
		set(scene, 'aria-valuenow', String(index + 1));
		set(scene, 'aria-valuetext', describe(index));
	};
	const pull = (index: number) => {
		pause();
		interrupt();
		queue = serve(index);
		motion.kick();
	};
	const push = () => {
		pause();
		interrupt();
		queue = [...release(), ...closing()];
		motion.kick();
	};

	// ——— Pointeur et doigt ———

	const indexOf = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return -1;
		if (target.closest('[data-drawer]')) return state.opening;
		const front = target.closest('[data-front]');
		return front ? Number(front.getAttribute('data-front')) - 1 : -1;
	};
	const toFigure = (event: PointerEvent) => {
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		return [point.x, point.y] as const;
	};
	const axis = axisVector(P, [1, 0, 0]);
	const axisLength = axis[0] * axis[0] + axis[1] * axis[1];
	let grip: { index: number; id: number; from: readonly [number, number]; start: number; moved: number; ready: boolean } | null = null;

	const wiring = new AbortController();
	const { signal } = wiring;
	scene.addEventListener(
		'pointermove',
		(event) => {
			if (grip && event.pointerId === grip.id) {
				const at = toFigure(event);
				if (!at) return;
				const dx = at[0] - grip.from[0];
				const dy = at[1] - grip.from[1];
				grip.moved = Math.max(grip.moved, Math.hypot(dx, dy));
				if (!grip.ready && state.opening === grip.index && settledAt(0)) grip.ready = true;
				if (grip.ready) {
					state.drawer.hand = clamp(grip.start + (dx * axis[0] + dy * axis[1]) / axisLength, 0, TRAVEL);
					if (state.drawer.mode !== 'hand' && grip.moved > 4) state.drawer.mode = 'hand';
				}
				motion.kick();
				return;
			}
			if (event.pointerType === 'touch') return;
			light(indexOf(event.target));
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerdown',
		(event) => {
			const index = indexOf(event.target);
			if (index < 0) return;
			// Tirer une poignée ne doit pas sélectionner les chiffres du totalisateur au passage.
			event.preventDefault();
			pause();
			scene.setPointerCapture(event.pointerId);
			const at = toFigure(event);
			if (!at) return;
			const open = state.opening === index;
			// Un autre tiroir est dehors : il rentre d'abord, puis celui-ci suit la main.
			interrupt();
			queue = open ? release() : [...release(), ...closing(), once(() => moveTo(index))];
			grip = { index, id: event.pointerId, from: at, start: open ? state.drawer.x : 0, moved: 0, ready: open };
			if (open) {
				Object.assign(state.drawer, { mode: 'rest', v: 0 });
				state.liftTarget = 0;
			}
			motion.kick();
		},
		{ signal },
	);
	const letGo = (event: PointerEvent) => {
		if (!grip || event.pointerId !== grip.id) return;
		const { index, moved, ready } = grip;
		grip = null;
		// Lâché avant que l'autre tiroir soit rentré : le geste vaut une traction entière.
		if (moved < 4 || !ready) pull(index);
		else if (state.drawer.x > TRAVEL / 2 && state.opening === index) {
			// Au-delà de la mi-course, la demande part : le tiroir finit sa course, puis la fiche.
			const req = pageRequest(index + 1);
			queue = [...release(), once(() => drive(true)), { done: () => settledAt(TRAVEL) }, ...feed(req), read(req), ...release(), ...serving(index)];
		} else queue = [...release(), ...closing()];
		motion.kick();
		resumeLater();
	};
	scene.addEventListener('pointerup', letGo, { signal });
	scene.addEventListener('pointercancel', letGo, { signal });
	scene.addEventListener(
		'pointerleave',
		(event) => {
			if (event.pointerType === 'touch' || grip) return;
			light(scene.matches(':focus') ? state.selected : -1);
			resumeLater();
		},
		{ signal },
	);

	// ——— Clavier, sur la scène seulement ———

	scene.addEventListener('focus', () => (pause(), light(state.selected)), { signal });
	scene.addEventListener('blur', () => (light(-1), resumeLater()), { signal });
	scene.addEventListener(
		'keydown',
		(event) => {
			const column = state.selected % 2;
			const row = Math.floor(state.selected / 2);
			const moves: Record<string, number> = {
				ArrowLeft: row * 2,
				ArrowRight: row * 2 + 1,
				ArrowUp: Math.max(row - 1, 0) * 2 + column,
				ArrowDown: Math.min(row + 1, DRAWERS / 2 - 1) * 2 + column,
				Home: 0,
				End: DRAWERS - 1,
			};
			if (event.key in moves) {
				event.preventDefault();
				pause();
				select(moves[event.key]);
			} else if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				pull(state.selected);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				push();
			}
		},
		{ signal },
	);

	const attributes = {
		role: 'slider',
		'aria-label': texts.keys,
		'aria-valuemin': '1',
		'aria-valuemax': String(DRAWERS),
		'aria-valuenow': String(state.selected + 1),
		'aria-valuetext': describe(state.selected),
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);
	motion.kick();

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		touched.forEach((node, index) => saved[index].forEach(([name, value]) => set(node, name, value)));
		if (releve.textContent !== atRest) releve.textContent = atRest;
	};
};

export default mount;
