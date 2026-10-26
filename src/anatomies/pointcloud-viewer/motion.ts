// Mouvement de l'anatomie de pointcloud-viewer. La tête du scanner est un moteur : elle accélère,
// file et freine (jamais d'amortissement critique). Chaque radian tourné en avant pendant le bake
// lit 100 points du fichier ; en arrière, le cliquet patine et rien n'est relu. Le tour rejoue le
// vrai flux : choix du fichier, bake Rust en WebAssembly, écriture du PCBK, transfert sans copie,
// ancre, rendu three.js, puis la roue change le mode de couleur.
import { holdStill, iso, translateAlong, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, loop, spring, type Spring } from '../live.ts';
import { cloudPoints, dotsPath, renderedPaths } from './cloud.ts';
import { discMarks, RAIL_DIR, TRAVEL } from './disc.ts';
import { ballAt, facingOf, mirrorAt, slitAt, teethAt, ticksAt, ventsAt, windowsAt, type Drum } from './head.ts';
import { AZIMUTH, beamSlot, dirOf, ELEVATION, GROUND, impactAt, LAYERS, projection as P, TILE } from './layout.ts';
import { DRAWN, drawnIndex, INKS, LAST_ANGLE, MODES, PER_TURN, POINTS, readout as text, readSpeed } from './model.ts';

const TAU = Math.PI * 2;
/** Vitesse affichée plafonnée (2,2 tours/s) : au-delà, la fente passe en flou de bougé. */
const CAP = 2.2 * TAU;
/** Accélération du moteur de la tête (rad/s²). */
const ACCEL = 9;
/** Durées des étapes du tour, en secondes ; le bake dure ce que dure la boucle rejouée (14 s). */
const RESET = 1.2;
const SPIN = 0.8;
const WRITE = 1.5;
const TRANSFER = 1;
const ANCHOR = 1;
const MODE_STEP = 1.6;
const TOUR_START = 1.4;
/** Le moteur reprend le tour 2 s après la dernière interaction. */
const RESUME_MS = 2000;
const CARD_LIFT = 6;
const SPIN_RATE = 14;

type Phase = 'reset' | 'spin' | 'read' | 'write' | 'transfer' | 'anchor' | 'rendered';

const smooth = (t: number) => {
	const x = Math.min(1, Math.max(0, t));
	return x * x * (3 - 2 * x);
};
/** Écart signé le plus court, dans ]−π, π]. */
const wrap = (angle: number) => angle - TAU * Math.round(angle / TAU);
/** Écart en avant seulement, dans [0, 2π[. */
const ahead = (from: number, to: number) => (((to - from) % TAU) + TAU) % TAU;
/** Points lus quand la tête a tourné de `read` : le point `i` est à l'angle `i / 100`, le point 0 compris. */
const countOf = (read: number) => (read <= 0 ? 0 : Math.min(POINTS, Math.floor(read * 100 + 1e-6) + 1));
const screenOf = (p: Point3) => iso(p, P);
const offsetOf = (by: Point3): [number, number] => {
	const [a, b] = [screenOf([0, 0, 0]), screenOf(by)];
	return [b[0] - a[0], b[1] - a[1]];
};

const mount: MountMotion = ({ scene, svg, readout }) => {
	const one = <T extends Element = SVGElement>(selector: string) => svg.querySelector<T>(selector);
	const rot = (key: string) => one(`[data-rot="${key}"]`);
	const setD = (node: Element | null, d: string) => {
		if (node && node.getAttribute('d') !== d) node.setAttribute('d', d);
	};
	const setAttr = (node: Element | null, name: string, value: string | null) => {
		if (!node) return;
		if (value === null) node.removeAttribute(name);
		else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
	};

	// --- Le nuage --------------------------------------------------------------------------------
	const { screen, layers } = cloudPoints();
	const cloud = Array.from({ length: LAYERS }, (_, layer) => {
		const group = one(`[data-cloud="${layer}"]`);
		return {
			group,
			inks: INKS.map((_, ink) => group?.querySelector(`[data-ink="${ink}"]`) ?? null),
			written: group?.querySelector('[data-written]') ?? null,
			current: group?.querySelector('[data-current]') ?? null,
		};
	});
	const restInks = cloud.map(({ inks }) => inks.map((node) => node?.getAttribute('d') ?? ''));
	const inksByMode = new Map<number, (layer: number) => string[]>();
	const inksFor = (mode: number) => {
		if (!inksByMode.has(mode)) inksByMode.set(mode, renderedPaths(screen, layers, MODES[mode]));
		return inksByMode.get(mode)!;
	};

	// --- Les autres pièces mobiles ---------------------------------------------------------------
	const beam = one<SVGGElement>('[data-beam]');
	const beamLine = beam?.querySelector('path') ?? null;
	const beamEnds = beam ? [...beam.querySelectorAll('circle')] : [];
	const slots = [0, 1, 2].map((k) => one(`[data-slot="${k}"]`));
	const restSlot = beam?.parentElement ?? null;
	const chariot = one('[data-chariot]');
	const marks = { hub: one('[data-mark="hub"]'), grooves: one('[data-mark="grooves"]'), radii: one('[data-mark="radii"]') };
	const latches = { dock: one('[data-latch="dock"]'), support: one('[data-latch="support"]') };
	const card = one('[data-card]');
	const led = one('[data-led]');
	const flash = one('[data-flash]');
	const pawl = one('[data-pawl]');
	const drumParts = [...(rot('drum')?.children ?? [])];
	const ghost = rot('ghost');

	// --- L'état ----------------------------------------------------------------------------------
	const rest = () => ({
		phase: 'rendered' as Phase,
		clock: 0,
		angle: LAST_ANGLE,
		rate: 0,
		target: LAST_ANGLE,
		/** La tête rattrape le point courant, en avant seulement, au lieu de viser une cible. */
		chase: false,
		read: LAST_ANGLE,
		/** Ce que la tête doit refaire en avant avant de relire : le patinage du cliquet. */
		back: 0,
		spin: 0,
		spinRate: 0,
		/** Crans de la roue depuis le repos : elle ne tourne qu'en avant. */
		steps: 0,
		wheel: { at: 0, rate: 0 } as Spring,
		share: 1,
		shareFrom: 1,
		progress: 1,
		lift: 0,
		fade: 1,
		blend: 1,
		pulse: 0,
		shown: DRAWN,
		writtenTo: DRAWN,
	});
	let state = rest();
	const mode = () => state.steps % MODES.length;
	let touring = !asksForStillness();
	let fresh = true;
	let driver: 'tour' | 'user' = 'tour';
	let tourClock = 0;
	let resume = 0;
	let written = Array.from({ length: LAYERS }, () => '');
	let writtenDirty = false;
	let drawnMode = 0;
	let drawnRotor = '';
	let lastLine = '';

	const lineOf = () => {
		const read = countOf(state.read);
		switch (state.phase) {
			case 'reset':
			case 'spin':
				return text.reading(0);
			case 'read':
				return driver === 'user' && state.back > 0.01 ? text.slipping(read) : text.reading(read);
			case 'write':
				return text.writing;
			case 'rendered':
				return text.rendered(MODES[mode()]);
			default:
				return text.anchored;
		}
	};
	const describe = () => {
		scene.setAttribute('aria-valuenow', String(countOf(state.read)));
		scene.setAttribute('aria-valuetext', lineOf());
	};

	const enter = (phase: Phase) => {
		state.phase = phase;
		state.clock = 0;
		if (phase === 'reset') {
			state.shareFrom = state.share;
			// Les réglages reviennent à zéro : la tête retourne au trait 0 du cercle, par le plus court.
			state.chase = false;
			state.target = state.angle - wrap(state.angle);
			// …et la roue revient en avant jusqu'au RGB, le mode par défaut d'un nuage coloré.
			state.steps = Math.ceil(state.steps / MODES.length) * MODES.length;
		} else if (phase === 'read') {
			Object.assign(state, { read: 0, back: 0, shown: 0, writtenTo: 0, chase: driver === 'tour' });
			written = written.map(() => '');
			writtenDirty = true;
		} else if (phase === 'write') {
			state.read = LAST_ANGLE;
			state.chase = true;
		} else if (phase === 'anchor') state.blend = 0;
		else if (phase === 'rendered') tourClock = 0;
		describe();
	};
	const newBake = () => {
		state.fade = 1;
		enter('reset');
	};
	const setMode = (next: number) => {
		const wanted = next % MODES.length;
		if (state.phase !== 'rendered' || wanted === mode()) return;
		state.steps += (wanted - mode() + MODES.length) % MODES.length;
		describe();
	};

	// --- La lecture, au cliquet ------------------------------------------------------------------
	const advance = (delta: number) => {
		if (state.phase !== 'read' || driver === 'tour') return;
		if (delta < 0) state.back -= delta;
		else {
			const used = Math.min(state.back, delta);
			state.back -= used;
			state.read = Math.min(LAST_ANGLE, state.read + delta - used);
		}
	};
	/** La main passe au visiteur : la tête a lu tout ce qu'elle a déjà balayé jusqu'à son angle. */
	const takeOver = () => {
		if (driver === 'user') return;
		driver = 'user';
		if (state.phase === 'read') {
			state.read = Math.min(LAST_ANGLE, state.read + ahead(state.read, state.angle));
			state.back = 0;
		}
		state.chase = false;
		state.target = state.angle;
	};

	// --- Le moteur de la tête --------------------------------------------------------------------
	const drive = (dt: number, calm: boolean) => {
		const before = state.angle;
		if (calm) {
			state.angle = state.chase ? state.angle + ahead(state.angle, state.read) : state.target;
			state.rate = 0;
		} else {
			// En lecture, le moteur reçoit la vitesse du point courant : il le suit tant qu'il peut.
			const feed = state.chase && state.phase === 'read' && driver === 'tour' ? readSpeed(state.read) : 0;
			const error = state.chase ? ahead(state.angle, state.read) : state.target - state.angle;
			const gapOf = () => (state.chase ? wrap(state.read - state.angle) : state.target - state.angle);
			const was = gapOf();
			const want = Math.sign(error) * Math.min(CAP, feed + Math.sqrt(2 * ACCEL * Math.abs(error)));
			state.rate += Math.min(ACCEL * dt, Math.max(-ACCEL * dt, want - state.rate));
			state.angle += state.rate * dt;
			const gap = gapOf();
			// Le moteur freine sur sa cible : s'il la franchit au pas de temps près, il s'y pose (en
			// poursuite, la dépasser d'un cheveu lui ferait refaire un tour entier).
			const crossed = Math.abs(gap) < 0.5 && Math.sign(gap) !== Math.sign(was) && Math.abs(state.rate) < 3;
			if (!feed && (crossed || (Math.abs(gap) < 2e-3 && Math.abs(state.rate) < 0.08))) {
				state.angle = state.chase ? state.angle + wrap(state.read - state.angle) : state.target;
				state.rate = 0;
			}
		}
		advance(state.angle - before);
	};

	// --- Le pas de temps -------------------------------------------------------------------------
	const step = (dt: number, calm: boolean) => {
		const long = calm ? 0 : 1;
		state.clock += dt;
		switch (state.phase) {
			case 'reset':
				state.fade = calm ? 0 : Math.max(0, 1 - state.clock / 0.6);
				state.lift = calm ? 0 : CARD_LIFT * Math.sin(Math.PI * Math.min(1, state.clock / RESET));
				state.share = calm ? 0 : state.shareFrom * (1 - smooth(state.clock / (RESET * 0.85)));
				if (state.clock > 0.6 || calm) state.progress = 0;
				if (state.clock >= RESET * long) {
					state.lift = 0;
					enter('spin');
				}
				break;
			case 'spin':
				if (state.clock >= SPIN * long) enter('read');
				break;
			case 'read':
				if (driver === 'tour') state.read = calm ? LAST_ANGLE : Math.min(LAST_ANGLE, state.read + readSpeed(state.read) * dt);
				if (state.read >= LAST_ANGLE) enter('write');
				break;
			case 'write':
				state.progress = calm ? 1 : Math.min(1, state.clock / WRITE);
				if (state.clock >= WRITE * long) enter('transfer');
				break;
			case 'transfer':
				state.share = calm ? 1 : smooth(state.clock / TRANSFER);
				if (state.clock >= TRANSFER * long) enter('anchor');
				break;
			case 'anchor':
				state.blend = calm ? 1 : smooth(state.clock / (ANCHOR * 0.7));
				state.pulse = calm ? 0 : Math.sin(Math.PI * Math.min(1, state.clock / (ANCHOR * 0.6)));
				if (state.clock >= ANCHOR * long) {
					state.pulse = 0;
					enter('rendered');
				}
				break;
		}
		const spinning = state.phase === 'spin' || state.phase === 'read' || state.phase === 'write';
		state.spinRate = calm ? 0 : state.spinRate + ((spinning ? SPIN_RATE : 0) - state.spinRate) * Math.min(1, dt * 3);
		if (state.spinRate < 0.01) state.spinRate = 0;
		state.spin += state.spinRate * dt;
		spring(state.wheel, state.steps, dt, 120, 16, calm);
		drive(dt, calm);
	};

	/** Le tour au repos : un bake complet, puis les quatre crans de la roue, et on recommence. */
	const tour = (dt: number) => {
		if (state.phase !== 'rendered') return;
		tourClock += dt;
		if (fresh) {
			if (tourClock >= TOUR_START) {
				fresh = false;
				newBake();
			}
			return;
		}
		const steps = Math.floor(tourClock / MODE_STEP);
		if (tourClock >= MODES.length * MODE_STEP + 0.6) newBake();
		else if (steps >= 1) setMode(steps % MODES.length);
	};

	// --- Le dessin -------------------------------------------------------------------------------
	const drawCloud = () => {
		const { phase } = state;
		if (phase === 'read' || phase === 'write' || phase === 'transfer' || phase === 'anchor') {
			const last = countOf(state.read) - 1;
			while (state.shown < DRAWN && drawnIndex(state.shown) <= last) state.shown++;
			// La spire courante : les points des 628 derniers ; les plus anciens passent au ton `lo`.
			while (state.writtenTo < state.shown && drawnIndex(state.writtenTo) <= last - PER_TURN) {
				written[layers[state.writtenTo]] += dotsPath(screen, [state.writtenTo]);
				state.writtenTo++;
				writtenDirty = true;
			}
			const current = Array.from({ length: LAYERS }, () => [] as number[]);
			for (let j = state.writtenTo; j < state.shown; j++) current[layers[j]].push(j);
			const blend = phase === 'anchor' ? state.blend : 0;
			const rendered = phase === 'anchor' ? inksFor(mode()) : null;
			cloud.forEach((layer, k) => {
				if (writtenDirty) setD(layer.written, written[k]);
				setD(layer.current, dotsPath(screen, current[k]));
				const fading = blend ? (1 - blend).toFixed(2) : null;
				setAttr(layer.written, 'opacity', fading);
				setAttr(layer.current, 'opacity', fading);
				// Le rendu three.js pose tout le nuage d'un coup : un seul fondu du ton `lo` au rendu.
				const paths = rendered?.(k);
				layer.inks.forEach((node, ink) => {
					setD(node, paths ? paths[ink] : '');
					setAttr(node, 'opacity', (INKS[ink] * blend).toFixed(2));
				});
			});
			writtenDirty = false;
			drawnMode = -1;
		} else if ((phase === 'reset' || phase === 'spin') && state.fade === 0 && drawnMode !== -2) {
			cloud.forEach((layer) => {
				setD(layer.written, '');
				setD(layer.current, '');
				layer.inks.forEach((node) => setD(node, ''));
			});
			drawnMode = -2;
		} else if (phase === 'rendered' && drawnMode !== mode()) {
			// Changer de mode n'échange que les tons : la géométrie du nuage reste.
			const paths = inksFor(mode());
			cloud.forEach((layer, k) => {
				const list = mode() === 0 ? restInks[k] : paths(k);
				layer.inks.forEach((node, ink) => {
					setD(node, list[ink]);
					setAttr(node, 'opacity', String(INKS[ink]));
				});
				setD(layer.written, '');
				setD(layer.current, '');
				setAttr(layer.written, 'opacity', null);
				setAttr(layer.current, 'opacity', null);
			});
			drawnMode = mode();
		}
		const fading = phase === 'reset' && state.fade < 1 ? state.fade.toFixed(2) : null;
		cloud.forEach(({ group }) => setAttr(group, 'opacity', fading));
	};

	const drumMarkup = (shape: Drum) =>
		`<path class="iso-fill" d="${shape.fill}"/>${shape.shades.map((d, k) => `<path class="iso-shade" data-shade="${k}" d="${d}"/>`).join('')}<path class="iso-top" d="${shape.mirror}"/><path class="iso-line iso-edge" data-tone="hi" d="${shape.outline}"/>`;

	const drawRotor = () => {
		const blur = smooth((Math.abs(state.rate) - CAP * 0.55) / (CAP * 0.45));
		const key = `${state.angle.toFixed(4)}|${state.spin.toFixed(2)}|${state.wheel.at.toFixed(3)}|${blur.toFixed(2)}`;
		if (key === drawnRotor) return;
		drawnRotor = key;
		const { angle } = state;
		// Le flou traîne derrière la fente, du côté d'où elle vient.
		const slit = slitAt(state.rate < 0 ? angle + blur * 0.7 : angle, state.spin, blur * 0.7);
		const sharp = state.rate < 0 && blur > 0.05 ? slitAt(angle, state.spin) : slit;
		for (const name of ['clip', 'opening']) setD(rot(name), slit?.opening ?? '');
		setD(rot('back'), slit?.back ?? '');
		setD(rot('side'), slit?.side ?? '');
		setD(rot('floor'), slit?.floor ?? '');
		setD(rot('bearing'), sharp?.bearing ?? '');
		setD(rot('bearing-ring'), sharp?.bearing ?? '');
		const drum = sharp?.drum;
		const ds = drum ? [drum.fill, ...drum.shades, drum.mirror, drum.ribs, drum.outline] : [];
		drumParts.forEach((node, k) => setD(node, ds[k] ?? ''));
		if (ghost) {
			const markup = slit?.ghost && blur > 0.05 ? drumMarkup(slit.ghost) : '';
			if (ghost.innerHTML !== markup) ghost.innerHTML = markup;
			setAttr(ghost, 'opacity', (0.35 * blur).toFixed(2));
		}
		ventsAt(angle, blur).forEach(({ d, alpha }, k) => {
			const node = rot(`vent${k}`);
			setD(node, d);
			setAttr(node, 'opacity', alpha.toFixed(2));
		});
		teethAt(angle, blur).forEach((d, k) => setD(rot(`teeth${k}`), d));
		const ticks = ticksAt(angle);
		for (const name of ['minor', 'major', 'zero'] as const) {
			setD(rot(name), ticks[name]);
			setAttr(rot(name), 'opacity', blur > 0.01 ? (1 - 0.85 * blur).toFixed(2) : null);
		}
		windowsAt(angle, state.wheel.at).forEach((d, k) => {
			setD(rot(`window${k}`), d);
			setD(rot(`window-ring${k}`), d);
		});
		const ball = ballAt(angle);
		setD(rot('ball'), ball);
		setD(rot('ball-ring'), ball);
		// Le cliquet se soulève à chaque dent qui passe, puis retombe.
		const tooth = ((((angle * 48) / TAU) % 1) + 1) % 1;
		const [dx, dy] = dirOf(angle);
		setAttr(pawl, 'transform', tooth > 0.02 ? translateAlong(P, [dx * 0.3 * tooth, dy * 0.3 * tooth, 0]) : null);
	};

	const drawBeam = () => {
		if (!beam || !beamLine) return;
		const on = state.phase !== 'reset' && state.phase !== 'spin';
		setAttr(beam, 'visibility', on ? null : 'hidden');
		if (!on) return;
		const from = mirrorAt(state.angle);
		const to = impactAt(state.angle, Math.max(0, countOf(state.read) - 1));
		const slot = slots[beamSlot(from, to, facingOf(state.angle) > 0.05)];
		if (slot && beam.parentNode !== slot) slot.appendChild(beam);
		const [a, b] = [screenOf(from), screenOf(to)];
		setD(beamLine, `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
		[a, b].forEach(([x, y], k) => {
			setAttr(beamEnds[k], 'cx', x.toFixed(1));
			setAttr(beamEnds[k], 'cy', y.toFixed(1));
		});
	};

	const drawParts = () => {
		const shift = state.share * TRAVEL;
		setAttr(chariot, 'transform', shift > 1e-3 ? translateAlong(P, [RAIL_DIR[0] * shift, RAIL_DIR[1] * shift, 0]) : null);
		setAttr(latches.dock, 'visibility', state.share < 0.98 ? null : 'hidden');
		setAttr(latches.support, 'visibility', state.share < 0.98 ? 'hidden' : null);
		const engraved = discMarks(state.progress);
		setD(marks.hub, engraved.hub);
		setD(marks.grooves, engraved.grooves);
		setD(marks.radii, engraved.radii);
		if (card) {
			const offset = offsetOf([0, 0, state.lift]);
			const lifted = state.lift > 1e-3;
			setAttr(card, 'transform', lifted ? `translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})` : null);
			holdStill(card, lifted ? offset : [0, 0]);
		}
		const baking = state.phase === 'spin' || state.phase === 'read' || state.phase === 'write' || state.phase === 'transfer';
		// Le voyant : éteint au choix du fichier, clignotant pendant le bake, fixe une fois rendu.
		const glow = baking ? (Math.floor(state.clock / 0.26) % 2 ? 1 : 0.15) : state.phase === 'reset' ? 0.15 : 1;
		setAttr(led, 'opacity', glow === 1 ? null : String(glow));
		setAttr(flash, 'opacity', state.pulse > 0.01 ? (1 - 0.6 * state.pulse).toFixed(2) : null);
	};

	const draw = () => {
		drawCloud();
		drawRotor();
		drawBeam();
		drawParts();
		const line = lineOf();
		if (line !== lastLine) {
			lastLine = line;
			readout.textContent = line;
		}
		// Un geste se lit quand la tête s'arrête : les points lus ou le cliquet qui a patiné.
		if (driver === 'user' && !state.rate && scene.getAttribute('aria-valuetext') !== line) describe();
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) touring = false;
		if (touring) tour(dt);
		step(dt, calm);
		draw();
		const still = !state.rate && !state.spinRate && state.phase === 'rendered' && state.wheel.at === state.steps;
		return touring || !still;
	});

	// --- Les gestes ------------------------------------------------------------------------------
	const pause = () => {
		touring = false;
		clearTimeout(resume);
	};
	const resumeLater = () => {
		clearTimeout(resume);
		resume = window.setTimeout(() => {
			if (asksForStillness() || scene.matches(':focus')) return;
			touring = true;
			driver = 'tour';
			if (state.phase === 'read' || state.phase === 'write') state.chase = true;
			tourClock = 0;
			motion.kick();
		}, RESUME_MS);
	};
	const act = () => {
		pause();
		takeOver();
		motion.kick();
	};

	/** L'angle de la spirale sous le pointeur, ramené au plan du terrain ; rien hors du terrain. */
	const angleAt = (event: PointerEvent) => {
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		const [sa, ca] = [Math.sin((AZIMUTH * Math.PI) / 180), Math.cos((AZIMUTH * Math.PI) / 180)];
		const [se, ce] = [Math.sin((ELEVATION * Math.PI) / 180), Math.cos((ELEVATION * Math.PI) / 180)];
		const k = P.scale * Math.sqrt(1.6);
		const u = (point.x - P.origin[0]) / k;
		const w = ((point.y - P.origin[1]) / k + GROUND * ce) / se;
		const [x, y] = [u * sa + w * ca, -u * ca + w * sa];
		if (Math.abs(x) > TILE || Math.abs(y) > TILE || Math.hypot(x, y) < 4) return null;
		return Math.atan2(x, y);
	};
	const aim = (angle: number, forward: boolean) => {
		state.chase = false;
		state.target = forward ? state.angle + ahead(state.angle, angle) : state.angle + wrap(angle - state.angle);
	};
	const pieceAt = (target: EventTarget | null) => (target instanceof Element ? target.closest('[data-piece]')?.getAttribute('data-piece') : null);

	const wiring = new AbortController();
	const { signal } = wiring;
	scene.addEventListener(
		'pointermove',
		(event) => {
			if (event.pointerType === 'touch') return;
			const angle = angleAt(event);
			if (angle === null) return;
			act();
			aim(angle, false);
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerleave',
		(event) => {
			if (event.pointerType !== 'touch') resumeLater();
		},
		{ signal },
	);
	scene.addEventListener(
		'pointerdown',
		(event) => {
			if (event.pointerType !== 'touch') return;
			const piece = pieceAt(event.target);
			if (piece === 'roue' || piece === 'carte') return;
			const angle = angleAt(event);
			if (angle === null) return;
			act();
			// Au toucher, la tête va jusqu'au point en avant seulement : elle lit en chemin.
			aim(angle, true);
			resumeLater();
		},
		{ signal },
	);
	scene.addEventListener(
		'click',
		(event) => {
			const piece = pieceAt(event.target);
			if (piece === 'roue') {
				act();
				setMode(mode() + 1);
			} else if (piece === 'carte') {
				act();
				newBake();
			} else return;
			if ('pointerType' in event && event.pointerType === 'touch') resumeLater();
		},
		{ signal },
	);
	scene.addEventListener('focus', pause, { signal });
	scene.addEventListener('blur', resumeLater, { signal });
	scene.addEventListener(
		'keydown',
		(event) => {
			const turn = (by: number) => {
				act();
				state.target = (state.chase ? state.angle : state.target) + by;
				state.chase = false;
			};
			switch (event.key) {
				case 'ArrowRight':
				case 'ArrowUp':
					turn(event.shiftKey ? 10 * TAU : TAU / 8);
					break;
				case 'ArrowLeft':
				case 'ArrowDown':
					turn(-TAU / 8);
					break;
				case 'End':
					act();
					if (state.phase === 'reset' || state.phase === 'spin' || state.phase === 'read') enter('write');
					break;
				case 'c':
				case 'C':
					act();
					setMode(mode() + 1);
					break;
				case 'Enter':
					act();
					newBake();
					break;
				default:
					return;
			}
			event.preventDefault();
		},
		{ signal },
	);

	const attributes = {
		role: 'slider',
		'aria-label':
			'Scanner sur trépied : les flèches tournent la tête d’un huitième de tour (Maj : dix tours) ; en avant elle lit 79 points, en arrière le cliquet patine. Fin finit le bake, C change le mode de couleur, Entrée relance un bake.',
		'aria-valuemin': '0',
		'aria-valuemax': String(POINTS),
		'aria-valuenow': String(POINTS),
		'aria-valuetext': text.rest,
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		for (const name of Object.keys(attributes)) scene.removeAttribute(name);
		state = rest();
		drawnMode = -1;
		drawnRotor = '';
		if (beam && restSlot && beam.parentElement !== restSlot) restSlot.appendChild(beam);
		draw();
		setAttr(beam, 'visibility', null);
	};
};

export default mount;
