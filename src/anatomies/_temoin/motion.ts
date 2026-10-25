// Mouvement de la figure témoin : un bloc se lève sur un ressort et le relevé dit sa pièce et
// ses lignes. Au repos, la figure lève ses blocs un à un ; le pointeur, le doigt ou les flèches
// de la scène en choisissent un.
import { translateAlong } from '../../vendor/anatomy/iso-kit.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, loop, spring, type Spring } from '../live.ts';
import { projection } from './geometry.ts';
import { linesOf, pieces, readout as atRest } from './model.ts';

/** Course d'un bloc levé, en unités du monde. */
const LIFT = 14;
/** Un ressort un peu sous l'amortissement critique : le bloc dépasse à peine et se pose. */
const STIFFNESS = 170;
const DAMPING = 20;
/** Tour au repos : premier bloc après 1,4 s, puis un bloc toutes les 1,6 s et un temps tout en bas. */
const TOUR_START = 1.4;
const TOUR_STEP = 1.6;
/** Reprise du tour après la dernière interaction. */
const RESUME_MS = 3600;

const tourAt = (clock: number) => {
	if (clock < TOUR_START) return null;
	const step = Math.floor((clock - TOUR_START) / TOUR_STEP) % (pieces.length + 1);
	return step < pieces.length ? step : null;
};

const describe = (index: number | null) =>
	index === null ? 'aucun bloc levé' : `${pieces[index].name}, ${linesOf(pieces[index])} lignes`;

const mount: MountMotion = ({ scene, svg, readout }) => {
	const hooks = pieces.map((piece) => [...svg.querySelectorAll(`[data-piece="${piece.id}"]`)]);
	const lifts: Spring[] = pieces.map(() => ({ at: 0, rate: 0 }));
	let chosen: number | null = null;
	let touring = !asksForStillness();
	let clock = 0;
	let resume = 0;

	const draw = () => {
		hooks.forEach((nodes, index) => {
			const transform = lifts[index].at ? translateAlong(projection, [0, 0, lifts[index].at]) : null;
			for (const node of nodes) {
				if (transform) node.setAttribute('transform', transform);
				else node.removeAttribute('transform');
			}
		});
		// Le relevé lit la position réelle des blocs, pas leur cible.
		const up = lifts.findIndex((lift) => lift.at > LIFT / 2);
		const text = up < 0 ? atRest : `${pieces[up].name} · ${linesOf(pieces[up])} lignes`;
		if (readout.textContent !== text) readout.textContent = text;
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) touring = false;
		if (touring) {
			clock += dt;
			chosen = tourAt(clock);
		}
		let settled = true;
		lifts.forEach((lift, index) => {
			settled = spring(lift, index === chosen ? LIFT : 0, dt, STIFFNESS, DAMPING, calm) && settled;
		});
		draw();
		return touring || !settled;
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
			clock = TOUR_START;
			motion.kick();
		}, RESUME_MS);
	};
	const choose = (index: number | null) => {
		pause();
		if (index !== chosen) {
			chosen = index;
			scene.setAttribute('aria-valuenow', String(index === null ? 0 : index + 1));
			scene.setAttribute('aria-valuetext', describe(index));
		}
		motion.kick();
	};
	const indexOf = (target: EventTarget | null) => {
		const id = target instanceof Element ? target.closest('[data-piece]')?.getAttribute('data-piece') : null;
		const index = pieces.findIndex((piece) => piece.id === id);
		return index < 0 ? null : index;
	};

	const wiring = new AbortController();
	const { signal } = wiring;
	// Le bloc levé quitte le pointeur : passer sur le socle ne le repose pas, sinon il oscillerait.
	scene.addEventListener(
		'pointerover',
		(event) => {
			if (event.pointerType === 'touch') return;
			pause();
			const index = indexOf(event.target);
			if (index !== null) choose(index);
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerleave',
		(event) => {
			if (event.pointerType === 'touch') return;
			choose(null);
			resumeLater();
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerdown',
		(event) => {
			if (event.pointerType !== 'touch') return;
			choose(indexOf(event.target));
			resumeLater();
		},
		{ signal },
	);
	scene.addEventListener('focus', pause, { signal });
	scene.addEventListener('blur', resumeLater, { signal });
	scene.addEventListener(
		'keydown',
		(event) => {
			const last = pieces.length - 1;
			const keys: Record<string, number | null> = {
				ArrowRight: chosen === null ? 0 : Math.min(chosen + 1, last),
				ArrowDown: chosen === null ? 0 : Math.min(chosen + 1, last),
				ArrowLeft: chosen === null ? last : Math.max(chosen - 1, 0),
				ArrowUp: chosen === null ? last : Math.max(chosen - 1, 0),
				Home: 0,
				End: last,
				Escape: null,
			};
			if (!(event.key in keys)) return;
			event.preventDefault();
			choose(keys[event.key]);
		},
		{ signal },
	);

	const attributes = {
		role: 'slider',
		'aria-label': 'Figure témoin : les flèches lèvent les blocs un à un, Début et Fin vont au premier et au dernier, Échap les repose.',
		'aria-valuemin': '0',
		'aria-valuemax': String(pieces.length),
		'aria-valuenow': '0',
		'aria-valuetext': describe(null),
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		lifts.forEach((lift) => Object.assign(lift, { at: 0, rate: 0 }));
		draw();
	};
};

export default mount;
