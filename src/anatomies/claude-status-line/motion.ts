// Mouvement de la rampe à cadran : on fait avancer le temps au volant (glisser, toucher, clavier) ou
// le tour au repos le fait. Le temps affiché suit la cible sans saut ; tout le reste découle du modèle
// pur à cet instant : rendu de la minute, croix de Malte, sonde, tampon, et les aiguilles amorties
// (amortissement critique, environ 0,6 s) qui mènent tiges, lames, amortisseur et relevé.
import { axisVector, holdStill, translateAlong } from '../../vendor/anatomy/iso-kit.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, follow, loop, spring, type Spring } from '../live.ts';
import { DETENTS, MODULES, BLADE_FIRST, BLADE_PITCH, PIVOT_Z, PINIONS, DIAL, WHEEL, PROBE, projection as P } from './layout.ts';
import { bar, cacheLevel, EVENTS, LAST, poseAt, readoutOf, REST, SOURCES, type Pose } from './model.ts';
import {
	bladeSvg,
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
	ringTicksSvg,
	rodTravel,
	spokesSvg,
	witnessSvg,
} from './parts.ts';
import { HAMMER_SWING } from './layout.ts';

const ID = 'claude-status-line';
/** Le temps affiché rattrape la cible avec cette constante de temps (s). */
const TIME_LAG = 0.18;
/** Aiguilles et tiges : ressort critique de pulsation 7 rad/s, établi en 0,6 à 0,7 s. */
const NEEDLE = { stiffness: 49, damping: 14 };
/** Lames : un cran sec, critique et rapide. */
const BLADE = { stiffness: 1600, damping: 80 };
/** Levier d'aiguillage : un peu sous l'amortissement critique, il claque sur son cran. */
const LEVER = { stiffness: 900, damping: 42 };
/** Rouleau d'un tambour : un chiffre en environ 0,2 s. */
const DRUM_LAG = 0.06;
/** Glisser : une minute par pixel. */
const MINUTES_PER_PX = 1;
/** Tour au repos : départ 4 s après la dernière action, 5 min/s, ralenti autour des événements. */
const TOUR_DELAY = 4000;
const TOUR_SPEED = 5;
const TOUR_SLOW = 0.9;
const TOUR_FETCH = 0.5;
const TOUR_END = 145.7;
const TOUR_HOLD = 1.6;

const clampTime = (t: number) => Math.max(0, Math.min(LAST, t));

/** Vitesse du tour (minutes simulées par seconde) au temps t. */
function tourSpeed(t: number) {
	if (t < 0.6 || (t >= 145 && t < TOUR_END)) return TOUR_FETCH;
	return EVENTS.some((e) => e > 0 && Math.abs(t - e) < 1.2) ? TOUR_SLOW : TOUR_SPEED;
}

const describe = (t: number) => {
	const pose = poseAt(t);
	const { five, week } = pose.output;
	const window = (label: string, shown: typeof five, unit: string) =>
		shown.pct == null ? `${label} sans pourcentage` : `${label} ${bar(shown.pct).shown} %${shown.reset ? `, ${unit} ${shown.reset}` : ''}`;
	return `Minute ${Math.floor(pose.t)} : source ${SOURCES[pose.lever]}, ${window('5 heures', five, 'reset dans')}, ${window('semaine', week, 'reset dans')}`;
};

const mount: MountMotion = ({ scene, svg, readout }) => {
	const at = (name: string) => svg.querySelector<SVGGElement>(`[data-csl="${name}"]`);
	const keys = ['five', 'week'] as const;
	const blades = keys.flatMap((key, index) =>
		Array.from({ length: 10 }, (_, k) => ({ node: at(`blade-${key}-${k}`), window: index, k, x: MODULES[index] + BLADE_FIRST + k * BLADE_PITCH, state: { at: 0, rate: 0 } as Spring, drawn: -1 })),
	);
	const drums = keys.flatMap((key) =>
		Array.from({ length: 5 }, (_, j) => {
			const node = at(`drum-${key}-${j}`);
			const [a, b] = node ? [...node.querySelectorAll('text')] : [];
			return { key, j, a, b, shown: a?.textContent ?? '', next: '', phase: 0 };
		}),
	);
	const nodes = {
		rods: keys.map((key) => at(`rod-${key}`)),
		pinions: keys.map((key) => at(`pinion-${key}`)),
		needles: keys.map((key) => at(`needle-${key}`)),
		lever: at('lever'),
		ball: at('lever-ball'),
		probe: at('probe'),
		head: at('probe-head'),
		coilBack: at('coil-back')?.querySelector('path') ?? null,
		coilFront: at('coil-front')?.querySelector('path') ?? null,
		probeHold: svg.querySelector(`#${ID}-probe-rod`),
		ring: at('probe-ring'),
		hammer: at('hammer'),
		witness: at('witness'),
		damper: at('damper-rod'),
		damperHold: svg.querySelector(`#${ID}-damper-rod`),
		link: at('link'),
		spokes: at('spokes'),
		knurl: at('knurl'),
		notches: at('notches'),
		crank: at('crank'),
		driver: at('driver'),
		cross: at('cross'),
	};
	// Le levier, sa boule et la manivelle sont dessinés à l'angle 0 et déplacés de là.
	const restBall = leverTip(0);
	const restCrank = crankAt(0);
	const write = (node: Element | null, name: string, value: string | null) => {
		if (!node) return;
		if (value === null) node.removeAttribute(name);
		else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
	};
	const fill = (node: Element | null, html: string) => {
		if (node && node.innerHTML !== html) node.innerHTML = html;
	};
	const shift = (dx: number, dy: number, dz = 0) => (dx || dy || dz ? translateAlong(P, [dx, dy, dz]) : null);
	// La découpe d'une tige qui sort de son presse-étoupe reste en place quand la tige avance.
	const hold = (clip: Element | null, dx: number) => clip && holdStill(clip, axisVector(P, [dx, 0, 0]));
	const round = (value: number) => Math.round(value * 100) / 100;

	// État : le temps visé, le temps affiché, les ressorts.
	let target = REST;
	let shown = REST;
	const restPose = poseAt(REST);
	const pctOf = (pose: Pose, index: number) => (index === 0 ? pose.output.five.pct : pose.output.week.pct);
	const needles: Spring[] = keys.map((_, index) => ({ at: bar(pctOf(restPose, index) ?? 0).clamped, rate: 0 }));
	const lever: Spring = { at: DETENTS[restPose.lever], rate: 0 };
	for (const blade of blades) blade.state.at = blade.drawn = needles[blade.window].at >= 10 * (blade.k + 1) - 5 ? 1 : 0;
	let touring = false;
	let tourT = 0;
	let holdFor = 0;
	let idle = 0;
	let lastText = '';

	const draw = (pose: Pose) => {
		// Tiges, pignons, aiguilles : la valeur amortie de chaque fenêtre.
		keys.forEach((_, index) => {
			const pct = needles[index].at;
			const travel = rodTravel(pct);
			write(nodes.rods[index], 'transform', shift(travel, 0));
			write(nodes.pinions[index], 'transform', `rotate(${round(pinionAngle(index, travel))} ${PINIONS[index].x} ${-PINIONS[index].z})`);
			write(nodes.needles[index], 'transform', `rotate(${round(needleAngle(pct))} ${DIAL[0]} ${-DIAL[1]})`);
		});
		for (const blade of blades) {
			const raise = Math.round(blade.state.at * 1000) / 1000;
			if (raise !== blade.drawn) {
				blade.drawn = raise;
				// Couchée, la lame est cachée par le guide avant, comme dans la figure au repos.
				fill(blade.node, raise ? bladeSvg(blade.x, PIVOT_Z, raise) : '');
			}
		}
		// Aiguillage, sonde, capsule.
		fill(nodes.lever, leverSvg(lever.at));
		const tip = leverTip(lever.at);
		write(nodes.ball, 'transform', shift(tip[0] - restBall[0], tip[1] - restBall[1], tip[2] - restBall[2]));
		const out = pose.probe * PROBE.stroke;
		write(nodes.probe, 'transform', shift(-out, 0));
		write(nodes.head, 'transform', shift(-out, 0));
		hold(nodes.probeHold, -out);
		const coil = probeCoil(out);
		write(nodes.coilBack, 'd', coil.back);
		write(nodes.coilFront, 'd', coil.front);
		fill(nodes.ring, ringTicksSvg(pose.ring));
		fill(nodes.hammer, hammerSvg(pose.hammer * HAMMER_SWING));
		fill(nodes.witness, witnessSvg(cacheLevel(pose.t)));
		// Amortisseur et bielle, menés par l'aiguille 5h.
		const damped = damperOut(needles[0].at);
		write(nodes.damper, 'transform', shift(-damped, 0));
		hold(nodes.damperHold, -damped);
		fill(nodes.link, linkSvg(linkAngle(needles[0].at)));
		// Volant, croix de Malte.
		fill(nodes.spokes, spokesSvg(pose.wheel));
		fill(nodes.knurl, knurlSvg(pose.wheel));
		write(nodes.notches, 'transform', `rotate(${round(pose.wheel * 360)} ${WHEEL[0]} ${-WHEEL[1]})`);
		const crank = crankAt(pose.wheel);
		write(nodes.crank, 'transform', shift(crank[0] - restCrank[0], 0, crank[2] - restCrank[2]));
		write(nodes.driver, 'transform', `rotate(${round(driverAngle(pose.driver))} ${round(DRIVER_AT[0])} ${round(DRIVER_AT[1])})`);
		write(nodes.cross, 'transform', `rotate(${round(pose.cross % 360)} ${CROSS_AT[0]} ${CROSS_AT[1]})`);
		// Tambours : le chiffre sortant monte, l'entrant arrive par le bas.
		for (const drum of drums) {
			if (!drum.a || !drum.b) continue;
			write(drum.a, 'transform', drum.phase ? `translate(0 ${round(-10 * drum.phase)})` : null);
			write(drum.b, 'transform', drum.phase ? `translate(0 ${round(-10 * drum.phase)})` : null);
			if (drum.a.textContent !== drum.shown) drum.a.textContent = drum.shown;
			if (drum.b.textContent !== drum.next) drum.b.textContent = drum.next;
		}
		// Relevé : la source au cran du levier, les pourcentages là où sont les aiguilles.
		const source = SOURCES[DETENTS.reduce((best, deg, index) => (Math.abs(deg - lever.at) < Math.abs(DETENTS[best] - lever.at) ? index : best), 0)];
		const text = readoutOf(
			source,
			{ pct: pose.output.five.pct == null ? null : needles[0].at, reset: pose.output.five.reset },
			{ pct: pose.output.week.pct == null ? null : needles[1].at, reset: pose.output.week.reset },
		);
		if (text !== lastText) readout.textContent = lastText = text;
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) touring = false;
		if (touring) {
			if (tourT < TOUR_END) tourT = Math.min(TOUR_END, tourT + tourSpeed(tourT) * dt);
			else if ((holdFor += dt) > TOUR_HOLD) {
				touring = false;
				tourT = 0;
				holdFor = 0;
				target = REST;
				resumeLater();
			}
			if (touring) target = tourT;
		}
		// Le dernier vingtième de minute est rattrapé d'un coup : sinon le rendu visé tarde à s'afficher.
		shown = follow(shown, target, dt, TIME_LAG, calm);
		if (Math.abs(target - shown) < 0.05) shown = target;
		const pose = poseAt(shown);
		let settled = shown === target;
		keys.forEach((_, index) => {
			settled = spring(needles[index], bar(pctOf(pose, index) ?? 0).clamped, dt, NEEDLE.stiffness, NEEDLE.damping, calm) && settled;
		});
		for (const blade of blades) {
			const on = pctOf(pose, blade.window) != null && needles[blade.window].at >= 10 * (blade.k + 1) - 5 ? 1 : 0;
			settled = spring(blade.state, on, dt, BLADE.stiffness, BLADE.damping, calm) && settled;
		}
		settled = spring(lever, DETENTS[pose.lever], dt, LEVER.stiffness, LEVER.damping, calm) && settled;
		keys.forEach((key, index) => {
			const shownWindow = index === 0 ? pose.output.five : pose.output.week;
			const chars = drumChars(shownWindow.pct == null ? '—' : shownWindow.reset);
			drums
				.filter((drum) => drum.key === key)
				.forEach((drum) => {
					const want = chars[drum.j];
					if (calm) {
						Object.assign(drum, { shown: want, next: '', phase: 0 });
						return;
					}
					if (!drum.phase && want !== drum.shown) Object.assign(drum, { next: want, phase: 0.001 });
					if (drum.phase) {
						drum.phase = follow(drum.phase, 1, dt, DRUM_LAG);
						if (drum.phase >= 1) Object.assign(drum, { shown: drum.next, next: '', phase: 0 });
						settled = false;
					}
				});
		});
		draw(pose);
		return touring || !settled;
	});

	const startTour = () => {
		if (asksForStillness()) return;
		touring = true;
		tourT = 0;
		holdFor = 0;
		motion.kick();
	};
	const resumeLater = () => {
		clearTimeout(idle);
		idle = window.setTimeout(() => {
			if (asksForStillness() || scene.matches(':focus')) return;
			startTour();
		}, TOUR_DELAY);
	};
	const takeOver = () => {
		clearTimeout(idle);
		if (touring) {
			touring = false;
			target = clampTime(shown);
		}
	};
	const aim = (t: number) => {
		target = clampTime(t);
		scene.setAttribute('aria-valuenow', String(Math.round(target)));
		scene.setAttribute('aria-valuetext', describe(target));
		motion.kick();
	};

	const wiring = new AbortController();
	const { signal } = wiring;
	let drag: { id: number; x: number; t: number; moved: boolean } | null = null;
	scene.addEventListener(
		'pointerdown',
		(event) => {
			if (event.button !== 0) return;
			takeOver();
			drag = { id: event.pointerId, x: event.clientX, t: target, moved: false };
		},
		{ signal },
	);
	scene.addEventListener(
		'pointermove',
		(event) => {
			if (!drag || event.pointerId !== drag.id) return;
			const dx = event.clientX - drag.x;
			if (!drag.moved && Math.abs(dx) > 3) {
				drag.moved = true;
				scene.setPointerCapture(event.pointerId);
			}
			if (drag.moved) aim(drag.t + dx * MINUTES_PER_PX);
		},
		{ signal },
	);
	const release = (event: PointerEvent) => {
		if (!drag || event.pointerId !== drag.id) return;
		// Un toucher bref avance d'un cran.
		if (!drag.moved && event.type === 'pointerup' && event.pointerType === 'touch') aim(Math.round(target) + 1);
		if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
		drag = null;
		resumeLater();
	};
	scene.addEventListener('pointerup', release, { signal });
	scene.addEventListener('pointercancel', release, { signal });
	scene.addEventListener('focus', takeOver, { signal });
	scene.addEventListener('blur', resumeLater, { signal });
	scene.addEventListener(
		'keydown',
		(event) => {
			const now = Math.round(touring ? shown : target);
			const next = EVENTS.find((e) => e > target + 0.01) ?? LAST;
			const moves: Record<string, number> = { ArrowRight: now + 1, ArrowLeft: now - 1, PageDown: now + 60, PageUp: now - 60, End: next, Home: REST };
			if (event.key === ' ') {
				event.preventDefault();
				if (touring) takeOver();
				else startTour();
				return;
			}
			if (!(event.key in moves)) return;
			event.preventDefault();
			takeOver();
			aim(moves[event.key]);
		},
		{ signal },
	);

	const attributes = {
		role: 'slider',
		'aria-label':
			'Rampe à cadran : glissez vers la droite pour faire avancer le temps. Au clavier, les flèches avancent ou reculent d’une minute, Page suivante et Page précédente d’une heure, Fin va au prochain événement, Début revient à la pose au repos, Espace lance ou arrête le tour.',
		'aria-valuemin': '0',
		'aria-valuemax': String(LAST),
		'aria-valuenow': String(REST),
		'aria-valuetext': describe(REST),
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);
	if (!asksForStillness()) resumeLater();

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(idle);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		// Retour au repos exact : le panneau masqué de l'aperçu réapparaît tel quel.
		touring = false;
		target = shown = REST;
		keys.forEach((_, index) => Object.assign(needles[index], { at: bar(pctOf(restPose, index) ?? 0).clamped, rate: 0 }));
		Object.assign(lever, { at: DETENTS[restPose.lever], rate: 0 });
		for (const blade of blades) Object.assign(blade.state, { at: needles[blade.window].at >= 10 * (blade.k + 1) - 5 ? 1 : 0, rate: 0 });
		const restChars = keys.map((_, index) => {
			const w = index === 0 ? restPose.output.five : restPose.output.week;
			return drumChars(w.pct == null ? '—' : w.reset);
		});
		for (const drum of drums) Object.assign(drum, { shown: restChars[drum.key === 'five' ? 0 : 1][drum.j], next: '', phase: 0 });
		draw(restPose);
	};
};

export default mount;
