// Mouvement de la rampe à cadran : on fait avancer le temps au volant (glisser, toucher, clavier) ou
// le tour le fait. Le temps affiché suit la cible sans saut ; tout le reste découle du modèle pur à
// cet instant : rendu de la minute, croix de Malte, sonde, tampon, et les aiguilles amorties
// (amortissement critique, environ 0,6 s) qui mènent tiges, lames, amortisseur et relevé. Sur la
// fiche, la règle de temps montre et règle le temps, et le tour ne part que sur son bouton ; dans
// l'aperçu, sans règle, le tour part seul quand on laisse la figure.
import { axisVector, holdStill, translateAlong } from '../../vendor/anatomy/iso-kit.ts';
import { formats, type Localized } from '../../lib/i18n.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, follow, loop, spring, type Spring } from '../live.ts';
import { readingAnchor, rulerX } from '../ruler.ts';
import { DETENTS, MODULES, BLADE_FIRST, BLADE_PITCH, PIVOT_Z, PINIONS, DIAL, WHEEL, PROBE, projection as P } from './layout.ts';
import { bar, cacheLevel, EVENTS, LAST, minuteReading, poseAt, releveOf, REST, SOURCES, type Pose, type Shown, type Source } from './model.ts';
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
/** Tour : départ 4 s après la dernière action (aperçu), 5 min/s, ralenti autour des événements. */
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

/** Un délai de `fmtReset` (`3j`, `2h14`, `59m`) dit en toutes lettres, pour une annonce en anglais. */
function spokenDelay(reset: string) {
	const [, value, unit, minutes] = /^(\d+)([jhm])(\d*)$/.exec(reset) ?? [];
	if (!unit) return reset;
	const say = (n: string, name: string) => new Intl.NumberFormat(formats.en.intl, { style: 'unit', unit: name, unitDisplay: 'long' }).format(Number(n));
	if (unit === 'j') return say(value, 'day');
	if (unit === 'm') return say(value, 'minute');
	return `${say(value, 'hour')}${Number(minutes) ? ` ${say(minutes, 'minute')}` : ''}`;
}

const tell = (name: string, shown: Shown, none: string, percent: string, resetIn: (reset: string) => string) =>
	shown.pct == null ? `${name} ${none}` : `${name} ${bar(shown.pct).shown}${percent}${shown.reset ? `, ${resetIn(shown.reset)}` : ''}`;

// Tout ce que le mouvement écrit ou annonce, dans les deux langues : le chargeur dit laquelle.
const UI: Localized<{
	describe: (minute: number, source: Source, five: Shown, week: Shown) => string;
	start: string;
	stop: string;
	keys: string;
	ruler: string;
	scene: string;
}> = {
	fr: {
		describe: (minute: number, source: Source, five: Shown, week: Shown) => {
			const window = (name: string, shown: Shown) => tell(name, shown, 'sans pourcentage', ' %', (reset) => `reset dans ${reset}`);
			return `Minute ${minute} : source ${source}, ${window('5 heures', five)}, ${window('semaine', week)}`;
		},
		start: 'Lancer le tour',
		stop: 'Arrêter le tour',
		keys: 'Au clavier, les flèches avancent ou reculent d’une minute, Page suivante et Page précédente d’une heure, Fin va au prochain événement, Début revient à la pose au repos, Espace lance ou arrête le tour.',
		ruler: 'Temps de la rampe à cadran, en minutes de session.',
		scene: 'Rampe à cadran : glissez vers la droite pour faire avancer le temps.',
	},
	en: {
		describe: (minute: number, source: Source, five: Shown, week: Shown) => {
			const window = (name: string, shown: Shown) => tell(name, shown, 'with no percentage', '%', (reset) => `resets in ${spokenDelay(reset)}`);
			return `Minute ${minute}: source ${source}, ${window('5-hour window', five)}, ${window('weekly window', week)}`;
		},
		start: 'Start the tour',
		stop: 'Stop the tour',
		keys: 'With the keyboard, the arrow keys step one minute forward or back, Page Down and Page Up one hour, End goes to the next event, Home returns to the at-rest pose, Space starts or stops the tour.',
		ruler: 'Dial rail time, in minutes of the session.',
		scene: 'Dial rail: drag to the right to move time forward.',
	},
};

const mount: MountMotion = ({ locale, scene, svg, releve, timeline }) => {
	const ui = UI[locale];
	const describe = (t: number) => {
		const pose = poseAt(t);
		return ui.describe(Math.floor(pose.t), SOURCES[pose.lever], pose.output.five, pose.output.week);
	};
	const at = (name: string) => svg.querySelector<SVGGElement>(`[data-csl="${name}"]`);
	// La règle de la fiche prend le clavier à la scène : c'est elle, le curseur du temps.
	const ruler = timeline?.ruler ?? null;
	const tourButton = timeline?.tour ?? null;
	const control = ruler ?? scene;
	const scale = ruler?.querySelector('svg') ?? null;
	const thumb = ruler?.querySelector('[data-thumb]') ?? null;
	const reading = ruler?.querySelector('[data-reading]') ?? null;
	const tourLabel = tourButton?.querySelector('[data-tour-label]') ?? null;
	const tourIcon = tourButton?.querySelector('path') ?? null;
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
	let hovering = false;
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
		const text = releveOf(
			source,
			{ pct: pose.output.five.pct == null ? null : needles[0].at, reset: pose.output.five.reset },
			{ pct: pose.output.week.pct == null ? null : needles[1].at, reset: pose.output.week.reset },
			locale,
		);
		if (text !== lastText) releve.textContent = lastText = text;
		// Le curseur de la règle, au temps affiché.
		write(thumb, 'x', rulerX(pose.t, LAST));
		write(reading, 'text-anchor', readingAnchor(pose.t, LAST));
		const minute = minuteReading(Math.min(pose.t, LAST));
		if (reading && reading.textContent !== minute) reading.textContent = minute;
	};

	// Le bouton du tour dit l'action qu'il fera : lancer, ou arrêter le tour en cours.
	const setTouring = (on: boolean) => {
		touring = on;
		if (!tourButton) return;
		tourButton.toggleAttribute('data-touring', on);
		if (tourLabel) tourLabel.textContent = on ? ui.stop : ui.start;
		write(tourIcon, 'd', on ? 'M1.5 1h2.5v8H1.5zM6 1h2.5v8H6z' : 'M2 1l7 4-7 4z');
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm && touring) setTouring(false);
		if (touring) {
			if (tourT < TOUR_END) tourT = Math.min(TOUR_END, tourT + tourSpeed(tourT) * dt);
			// Sur la fiche, le tour s'arrête à son terme, la session hors ligne affichée.
			else if (ruler) setTouring(false);
			else if ((holdFor += dt) > TOUR_HOLD) {
				touring = false;
				tourT = 0;
				holdFor = 0;
				target = REST;
				resumeLater();
			}
			if (touring) target = tourT;
			value(target);
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
		// Sur la fiche, le tour part d'où en est la règle ; au repos ou au bout, il part du début.
		tourT = ruler && target > REST && target < TOUR_END ? target : 0;
		holdFor = 0;
		setTouring(true);
		motion.kick();
	};
	const resumeLater = () => {
		clearTimeout(idle);
		if (ruler) return;
		idle = window.setTimeout(() => {
			if (asksForStillness() || hovering || scene.matches(':focus')) return;
			startTour();
		}, TOUR_DELAY);
	};
	const takeOver = () => {
		clearTimeout(idle);
		if (touring) {
			setTouring(false);
			target = clampTime(shown);
		}
	};
	// La valeur du curseur : la minute du rendu, comme le temps lu sur la règle. Le tour la fait
	// avancer aussi.
	let announced = -1;
	const value = (t: number) => {
		const minute = Math.floor(t);
		if (minute === announced) return;
		announced = minute;
		control.setAttribute('aria-valuenow', String(minute));
		control.setAttribute('aria-valuetext', describe(t));
	};
	const aim = (t: number) => {
		target = clampTime(t);
		value(target);
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
		const dx = event.clientX - drag.x;
		// Un glisser dont les mouvements ne sont pas parvenus compte à son point d'arrivée ; un toucher
		// bref avance d'un cran.
		if (event.type === 'pointerup' && Math.abs(dx) > 3) aim(drag.t + dx * MINUTES_PER_PX);
		else if (!drag.moved && event.type === 'pointerup' && event.pointerType === 'touch') aim(Math.round(target) + 1);
		if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
		drag = null;
		resumeLater();
	};
	// Aperçu : le pointeur qui survole la figure suspend le tour ; il reprend 4 s après son départ. Sur
	// la fiche, un tour lancé au bouton continue sous le pointeur.
	scene.addEventListener(
		'pointerenter',
		(event) => {
			if (event.pointerType === 'touch' || ruler) return;
			hovering = true;
			takeOver();
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerleave',
		(event) => {
			if (event.pointerType === 'touch' || ruler) return;
			hovering = false;
			if (!drag) resumeLater();
		},
		{ signal },
	);
	scene.addEventListener('pointerup', release, { signal });
	scene.addEventListener('pointercancel', release, { signal });
	scene.addEventListener('focus', takeOver, { signal });
	scene.addEventListener('blur', resumeLater, { signal });

	// La règle : un appui y pose le temps, un glisser l'y promène, à la minute près ; le bouton lance
	// ou arrête le tour.
	if (ruler && scale && tourButton) {
		let sliding: number | null = null;
		const timeAt = (event: PointerEvent) => {
			const box = scale.getBoundingClientRect();
			return Math.round(((event.clientX - box.left) / box.width) * LAST);
		};
		ruler.addEventListener(
			'pointerdown',
			(event) => {
				if (event.button !== 0) return;
				takeOver();
				sliding = event.pointerId;
				ruler.setPointerCapture(event.pointerId);
				aim(timeAt(event));
			},
			{ signal },
		);
		ruler.addEventListener('pointermove', (event) => event.pointerId === sliding && aim(timeAt(event)), { signal });
		const stopSliding = (event: PointerEvent) => {
			if (event.pointerId === sliding) sliding = null;
		};
		ruler.addEventListener('pointerup', stopSliding, { signal });
		ruler.addEventListener('pointercancel', stopSliding, { signal });
		tourButton.addEventListener('click', () => (touring ? takeOver() : startTour()), { signal });
		// Le survol passe par un attribut : la CSS livrée n'a pas de `:hover`.
		for (const node of [ruler, tourButton]) {
			node.addEventListener('pointerenter', (event) => event.pointerType !== 'touch' && node.setAttribute('data-hover', ''), { signal });
			node.addEventListener('pointerleave', () => node.removeAttribute('data-hover'), { signal });
		}
		tourButton.disabled = false;
	}

	control.addEventListener(
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

	const attributes: Record<string, string> = {
		role: 'slider',
		'aria-label': `${ruler ? ui.ruler : ui.scene} ${ui.keys}`,
		'aria-valuemin': '0',
		'aria-valuemax': String(LAST),
		...(ruler && { tabindex: '0' }),
	};
	for (const [name, text] of Object.entries(attributes)) control.setAttribute(name, text);
	value(REST);
	if (!asksForStillness()) resumeLater();

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(idle);
		for (const name of [...Object.keys(attributes), 'aria-valuenow', 'aria-valuetext']) control.removeAttribute(name);
		// Retour au repos exact : le panneau masqué de l'aperçu réapparaît tel quel, la fiche retrouve sa
		// règle inerte.
		setTouring(false);
		if (tourButton) tourButton.disabled = true;
		ruler?.removeAttribute('data-hover');
		tourButton?.removeAttribute('data-hover');
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
