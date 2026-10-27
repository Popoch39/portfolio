// Mouvement du tableau d'annonciateur. Le crochet de Claude Code perfore sa ligne (une rangée par
// octet) et la boucle tampon s'allonge ; à chaque battement de l'échappement (le `fs_poll`, 1000 ms)
// la tête avale la boucle et, pour chaque ligne, le volet de la fenêtre tombe et la sonnette tinte,
// sauf si la fiche est branchée dans le jack de cette fenêtre (elle est au premier plan). Brancher
// la fiche dans le jack d'un volet tombé l'acquitte. Le tour rejoue le scénario de la fiche de
// concept ; le pointeur, le doigt et le clavier de la scène font de même à la demande.
// `.mjs`, comme `layout.ts` : un seul exemplaire du cœur du kit avec `lathe.mjs`.
import { dotsSvg, solidSvg, translateAlong } from '../../vendor/anatomy/iso-kit.mjs';
import type { Localized } from '../../lib/i18n.ts';
import type { MountMotion } from '../contract.ts';
import { asksForStillness, follow, loop, spring, type Spring } from '../live.ts';
import {
	CORD_R,
	FLAP_DOWN,
	HOOK_LIFT,
	PIVOTS,
	PLUG,
	cordRoute,
	dancerCoil,
	dancerZ,
	flapPaths,
	guidePaths,
	jackBox,
	jackZ,
	loopPaths,
	projection as P,
	ropeSvg,
	spin,
	tapeHoles,
	windowBox,
} from './layout.ts';
import { LEVELS, NVIM, POLL_MS, START_SIZE, WINDOWS, bytesOf, relevesOf, toastOf, type HookEvent, type Level } from './model.ts';

/** Ce que la scène annonce, dans la langue du document : son aide au clavier, et la fiche branchée. */
const UI: Localized<{ label: string; plugged: string }> = {
	fr: {
		label: 'Tableau d’annonciateur : flèches ou chiffres 1 à 5 pour choisir une fenêtre tmux, Entrée pour y faire attendre Claude ou acquitter son volet tombé, F pour une fin de tour.',
		plugged: ', fiche branchée',
	},
	en: {
		label: 'Annunciator board: arrow keys or digits 1 to 5 to pick a tmux window, Enter to make Claude wait there or acknowledge its dropped flap, F to end a turn.',
		plugged: ', plug in its jack',
	},
};

/** Vitesse du perforateur, en rangées (octets) par seconde : une ligne de 140 o en un tiers de seconde. */
const PUNCH_RATE = 420;
/** Temps que met la tête à avaler la boucle. */
const READ_TIME = 0.32;
/** Durée d'un relevé de toast ou d'acquittement. */
const HOLD = 2.6;
/** La fiche revient dans le jack de 1:nvim deux secondes après un acquittement (retour dans Neovim). */
const RETURN_MS = 2000;
/** Reprise du tour après la dernière interaction. */
const RESUME_MS = 3600;
/** Le tour de la fiche de concept (section 6), en secondes ; il boucle toutes les 16 s. */
const PERIOD = 16;
type Step = [at: number, action: 'stop' | 'call' | 'plug', window: number];
const SCRIPT: Step[] = [
	[1, 'stop', 2],
	[4, 'call', 1],
	[7, 'plug', 1],
	[9, 'call', 1],
	[12, 'plug', 2],
	[14, 'plug', NVIM],
];
/** Fiche : sortie du jack, course vers le jack visé, enfoncement sec. */
const PULL = 0.22;
const PUSH = 0.09;
const BULGE = 3;
const N = WINDOWS.length;

interface Line {
	window: number;
	event: HookEvent;
	bytes: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

const mount: MountMotion = ({ locale, scene, svg, releve }) => {
	const releves = relevesOf(locale);
	const ui = UI[locale];
	const q = (name: string) => svg.querySelector<SVGGElement>(`[data-ctn="${name}"]`);
	const all = <T>(make: (index: number) => T) => Array.from({ length: N }, (_, index) => make(index));
	const flaps = all((index) => q(`flap-${index}`));
	const hooks = all((index) => q(`hook-${index}`));
	const lamps = all((index) => [q(`lamp-${index}-warn`), q(`lamp-${index}-info`)]);
	const [plugBody, plugTip, cord, loopGroup, holes, guideLow, guideHigh] = ['plug', 'plug-tip', 'cord', 'loop', 'holes', 'guide-low', 'guide-high'].map(q);
	const coilBack = q('coil-back')?.firstElementChild;
	const coilFront = q('coil-front')?.firstElementChild;
	const dancer = ['dancer-back', 'dancer-front', 'carriage'].map(q);
	const spinners = { escape: q('escape'), anchor: q('anchor'), balance: q('balance'), sprocket: q('sprocket'), debit: q('spider'), takeup: q('hub'), hammer: q('hammer'), selector: q('selector') };
	const shifters = [q('striker'), q('punches')];
	// Ce que le mouvement réécrit, pour rendre la figure exactement au repos à l'arrêt.
	const rebuilt = [...flaps, cord, loopGroup, holes, guideLow, guideHigh];
	const original = rebuilt.map((node) => node?.innerHTML ?? '');
	const coilPaths = [coilBack?.getAttribute('d') ?? '', coilFront?.getAttribute('d') ?? ''];
	const tipWrap = plugTip?.parentElement;
	const tipHome = tipWrap ? { parent: tipWrap.parentNode, next: tipWrap.nextSibling } : null;
	const restText = releves.rest(NVIM);
	const zRest = dancerZ(0);
	const plugZ0 = jackZ(NVIM);

	// --- État du modèle, recréé à chaque montage -------------------------------------------------
	const wins = all(() => ({ down: false, angle: 0, rate: 0, hook: 0, release: 0, delay: 0, level: 'warn' as Level, drawn: -1 }));
	let clock = 0;
	let beat = 0;
	let rows = START_SIZE;
	let readRows = START_SIZE;
	let size = START_SIZE;
	let offset = START_SIZE;
	let punching: (Line & { done: number }) | null = null;
	const queue: Line[] = [];
	let pending: Line[] = [];
	let delivered: Line[] = [];
	let reading = -1;
	let readFrom = START_SIZE;
	let zp = zRest;
	let strikeClock = 0;
	const plug = { at: NVIM, to: NVIM, t: -1, out: 0, z: plugZ0, from: plugZ0, user: false };
	let bell = { level: 'warn' as Level, age: 99 };
	const selector: Spring = { at: 0.35, rate: 0 };
	const escape: Spring = { at: 0, rate: 0 };
	let escapeTarget = 0;
	let anchorSide = 1;
	let sprocket = 0;
	let sprocketTarget = 0;
	let debit = 0;
	let takeup = 0;
	let message = '';
	let messageUntil = 0;
	let hovered: number | null = null;
	let chosen = NVIM;
	let focused = false;
	let returning = 0;
	let resume = 0;
	let drawn = { plug: '', zp: NaN, rows: NaN, escape: NaN, anchor: NaN, sprocket: NaN, debit: NaN, takeup: NaN, hammer: NaN, selector: NaN, strike: NaN, tipAhead: false };

	const activeJack = () => (plug.t < 0 ? plug.at : -1);
	const say = (text: string, hold = HOLD) => {
		message = text;
		messageUntil = clock + hold;
	};

	// --- Le flux du plugin ----------------------------------------------------------------------
	/** Le crochet de Claude Code ajoute une ligne : elle attend le perforateur. */
	const emit = (window: number, event: HookEvent) => {
		queue.push({ window, event, bytes: bytesOf(event, window) });
		motion.kick();
	};
	/** Une ligne lue : toast, sauf si la fenêtre est au premier plan (fiche branchée dans son jack). */
	const deliver = (line: Line, calm: boolean) => {
		if (activeJack() === line.window) {
			say(releves.suppressed(line.window));
			return;
		}
		const win = wins[line.window];
		win.level = LEVELS[line.event];
		if (!win.down) {
			win.down = true;
			win.release = 0.3;
			win.delay = calm ? 0 : 0.06;
		}
		bell = { level: win.level, age: calm ? 99 : 0 };
		say(toastOf(line.event, line.window));
		if (line.window === chosen) describe();
	};
	/** Brancher la fiche dans le jack `target` : on passe dans cette fenêtre. */
	const plugTo = (target: number, user = false) => {
		clearTimeout(returning);
		if (plug.t >= 0 || target === plug.at) {
			if (target === plug.at && plug.t < 0) arrive(user);
			return;
		}
		Object.assign(plug, { to: target, t: 0, from: jackZ(plug.at), user });
		motion.kick();
	};
	const arrive = (user: boolean) => {
		const win = wins[plug.at];
		if (win.down) win.down = false;
		bell.age = 99;
		say(plug.at === NVIM ? '' : releves.focused(plug.at), plug.at === NVIM ? 0 : HOLD);
		if (user && plug.at !== NVIM) {
			returning = window.setTimeout(() => plugTo(NVIM), RETURN_MS);
		}
		describe();
	};

	// --- Le tour --------------------------------------------------------------------------------
	let touring = !asksForStillness();
	let tour = { clock: 0, steps: [] as Array<[number, () => void]>, next: 0, base: 0 };
	const startTour = (first: boolean) => {
		const steps: Array<[number, () => void]> = [];
		let at = first ? 0 : 0.4;
		// Première mise en route : l'index saute à la fin de la bande, l'arriéré est ignoré.
		if (first) steps.push([0.2, () => (sprocketTarget += Math.PI * 2)]);
		wins.forEach((win, index) => {
			if (!win.down) return;
			steps.push([at, () => plugTo(index)]);
			at += 2.2;
		});
		if (steps.length > (first ? 1 : 0) || plug.at !== NVIM) {
			steps.push([at, () => plugTo(NVIM)]);
			at += 2;
		}
		tour = { clock: 0, steps, next: 0, base: at };
	};
	const runTour = (dt: number) => {
		tour.clock += dt;
		while (true) {
			if (tour.next >= tour.steps.length) {
				for (const [at, action, window] of SCRIPT) tour.steps.push([tour.base + at, () => (action === 'plug' ? plugTo(window) : emit(window, action === 'call' ? 'Notification' : 'Stop'))]);
				tour.base += PERIOD;
			}
			const [at, run] = tour.steps[tour.next];
			if (at > tour.clock) break;
			tour.next++;
			run();
		}
	};
	if (touring) startTour(true);

	// --- Image par image -----------------------------------------------------------------------
	const setTransform = (node: Element | null | undefined, value: string) => {
		if (!node) return;
		if (value) node.setAttribute('transform', value);
		else node.removeAttribute('transform');
	};
	const solid = (paths: Parameters<typeof solidSvg>[0], tone: 'hi' | 'mid' = 'mid') => solidSvg(paths, { tone });

	const draw = () => {
		wins.forEach((win, index) => {
			if (win.angle !== win.drawn && flaps[index]) {
				flaps[index]!.innerHTML = win.angle ? flapPaths(index, win.angle).map((paths) => solid(paths, 'hi')).join('') : original[index];
				win.drawn = win.angle;
			}
			setTransform(hooks[index], win.hook ? spin(PIVOTS.hook(index), win.hook) : '');
			const [warn, info] = lamps[index];
			warn?.setAttribute('visibility', win.level === 'warn' ? 'visible' : 'hidden');
			info?.setAttribute('visibility', win.level === 'info' ? 'visible' : 'hidden');
		});
		// Fiche et cordon.
		const plugKey = `${plug.out.toFixed(2)}|${plug.z.toFixed(2)}`;
		if (plugKey !== drawn.plug) {
			drawn.plug = plugKey;
			const moved = plug.out || plug.z !== plugZ0 ? translateAlong(P, [plug.out, 0, plug.z - plugZ0]) : '';
			setTransform(plugBody, moved);
			setTransform(plugTip, moved);
			// Hors du jack, la pointe passe devant les douilles ; dedans, elle repasse derrière.
			const ahead = plug.out > 4;
			if (tipWrap && tipHome && ahead !== drawn.tipAhead) {
				const body = plugBody?.parentElement;
				if (ahead && body) body.before(tipWrap);
				else tipHome.parent?.insertBefore(tipWrap, tipHome.next);
				drawn.tipAhead = ahead;
			}
			if (cord) cord.innerHTML = moved ? ropeSvg(cordRoute(plug.z, plug.out), CORD_R) : original[N];
		}
		// Boucle tampon, bras danseur, ressort et barre de guidage.
		if (zp !== drawn.zp) {
			drawn.zp = zp;
			const lifted = zp === zRest;
			const shift = lifted ? '' : translateAlong(P, [0, 0, zp - zRest]);
			for (const node of dancer) setTransform(node, shift);
			if (loopGroup) loopGroup.innerHTML = lifted ? original[N + 1] : loopPaths(zp).map((paths) => solid(paths)).join('');
			const coil = dancerCoil(zp);
			coilBack?.setAttribute('d', lifted ? coilPaths[0] : coil.back);
			coilFront?.setAttribute('d', lifted ? coilPaths[1] : coil.front);
			const [low, high] = guidePaths(zp);
			if (guideLow) guideLow.innerHTML = lifted ? original[N + 3] : solid(low);
			if (guideHigh) guideHigh.innerHTML = lifted ? original[N + 4] : solid(high);
		}
		// Bande perforée, perforateur et bobines.
		if (rows !== drawn.rows) {
			drawn.rows = rows;
			if (holes) holes.innerHTML = rows === START_SIZE ? original[N + 2] : dotsSvg(tapeHoles(rows), { size: 0.32, tone: 'hi' });
		}
		const strike = punching ? 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * 14 * strikeClock)) : 0;
		if (strike !== drawn.strike) {
			drawn.strike = strike;
			for (const node of shifters) setTransform(node, strike ? translateAlong(P, [0, 0, -strike]) : '');
		}
		const turns: Array<['escape' | 'anchor' | 'sprocket' | 'debit' | 'takeup' | 'selector', number, Parameters<typeof spin>[0]]> = [
			['escape', escape.at, PIVOTS.escape],
			['anchor', anchorSide * 0.07 * (escapeTarget ? 1 : 0), PIVOTS.anchor],
			['sprocket', sprocket, PIVOTS.sprocket],
			['debit', debit, PIVOTS.debit],
			['takeup', takeup, PIVOTS.takeup],
			['selector', selector.at - 0.35, PIVOTS.selector],
		];
		for (const [name, angle, pivot] of turns) {
			if (drawn[name] === angle) continue;
			drawn[name] = angle;
			setTransform(spinners[name], angle ? spin(pivot, angle) : '');
		}
		const swing = hammerAngle();
		if (swing !== drawn.hammer) {
			drawn.hammer = swing;
			setTransform(spinners.hammer, swing ? spin(PIVOTS.hammer, swing) : '');
		}
		setTransform(spinners.balance, balanceAngle ? spin(PIVOTS.balance, balanceAngle) : '');
		const text = textNow();
		if (releve.textContent !== text) releve.textContent = text;
	};

	let balanceAngle = 0;
	const hammerAngle = () => {
		const { age, level } = bell;
		if (level === 'warn') return age < 1.4 ? 0.022 * Math.sin(Math.PI * 2 * 17 * age) * clamp(age / 0.04) * clamp((1.4 - age) / 0.2) : 0;
		return age < 0.3 ? 0.03 * Math.sin(Math.PI * clamp(age / 0.1)) * Math.exp(-age / 0.12) : 0;
	};
	const textNow = () => {
		if (hovered !== null) return releves.hover(hovered, wins[hovered].down);
		if (size > offset) return releves.unread(size - offset, (beat + 1) * POLL_MS - clock * 1000);
		if (message && clock < messageUntil) return message;
		const active = activeJack();
		return releves.rest(active < 0 ? plug.to : active);
	};

	const motion = loop(scene, (dt, calm) => {
		if (calm) touring = false;
		clock += dt;
		if (touring) runTour(dt);

		// Le perforateur frappe la ligne en tête de file : la boucle s'allonge d'autant.
		const next = punching ? undefined : queue.shift();
		if (next) punching = { ...next, done: 0 };
		if (punching) {
			const step = calm ? punching.bytes - punching.done : Math.min(punching.bytes - punching.done, PUNCH_RATE * dt);
			punching.done += step;
			rows += step;
			debit -= step * 0.012;
			strikeClock += dt;
			if (punching.done >= punching.bytes) {
				size += punching.bytes;
				pending.push(punching);
				punching = null;
				strikeClock = 0;
			}
		}
		// L'échappement bat la seconde : c'est le `fs_poll`. À chaque battement, lecture de ce qui dépasse le décalage.
		const beats = Math.floor((clock * 1000) / POLL_MS);
		if (beats > beat || (calm && size > offset)) {
			if (beats > beat) {
				beat = beats;
				escapeTarget -= (Math.PI * 2) / 30;
				anchorSide = -anchorSide;
			}
			if (size > offset) {
				offset = size;
				delivered = delivered.concat(pending);
				pending = [];
				readFrom = readRows;
				reading = 0;
			}
		}
		if (reading >= 0) {
			reading = calm ? READ_TIME : reading + dt;
			const before = readRows;
			readRows = readFrom + (offset - readFrom) * ease(clamp(reading / READ_TIME));
			sprocket += (readRows - before) * 0.05;
			sprocketTarget += (readRows - before) * 0.05;
			takeup += (readRows - before) * 0.012;
			if (reading >= READ_TIME) {
				reading = -1;
				for (const line of delivered) deliver(line, calm);
				delivered = [];
			}
		}
		zp = follow(zp, dancerZ(rows - readRows), dt, 0.08, calm);
		sprocket = follow(sprocket, sprocketTarget, dt, 0.12, calm);
		spring(escape, escapeTarget, dt, 900, 38, calm);

		// La fiche : sortie, course, enfoncement sec.
		if (plug.t >= 0) {
			const to = jackZ(plug.to);
			const travel = 0.25 + Math.abs(to - plug.from) / 320;
			plug.t = calm ? PULL + travel + PUSH : plug.t + dt;
			const t = plug.t;
			if (t < PULL) {
				plug.out = PLUG.out * ease(t / PULL);
			} else if (t < PULL + travel) {
				const u = ease((t - PULL) / travel);
				plug.z = plug.from + (to - plug.from) * u;
				plug.out = PLUG.out + BULGE * Math.sin(Math.PI * u);
			} else if (t < PULL + travel + PUSH) {
				const u = (t - PULL - travel) / PUSH;
				plug.z = to;
				plug.out = PLUG.out * (1 - u * u);
			} else {
				Object.assign(plug, { t: -1, out: 0, z: to, at: plug.to });
				arrive(plug.user);
			}
		}
		// Volets : le crochet se lève, le volet tombe et rebondit sur sa butée ; relevé par la fiche.
		let moving = false;
		for (const win of wins) {
			win.release = Math.max(0, win.release - dt);
			if (win.down) {
				win.delay = Math.max(0, win.delay - dt);
				if (calm) Object.assign(win, { angle: FLAP_DOWN, rate: 0 });
				else if (!win.delay && (win.angle < FLAP_DOWN || win.rate)) {
					win.rate += 30 * Math.sin(win.angle + 0.12) * dt;
					win.angle += win.rate * dt;
					if (win.angle >= FLAP_DOWN) {
						win.angle = FLAP_DOWN;
						win.rate = win.rate > 1.4 ? -win.rate * 0.3 : 0;
					}
				}
			} else {
				win.rate = 0;
				win.angle = follow(win.angle, 0, dt, 0.08, calm);
			}
			const latch = win.release > 0 || (!win.down && win.angle > 0.02 && win.angle < 0.45);
			win.hook = follow(win.hook, latch ? HOOK_LIFT : 0, dt, 0.035, calm);
			moving ||= win.angle !== (win.down ? FLAP_DOWN : 0) || win.hook !== 0;
		}
		// Sonnette : sélecteur sur le niveau, trembleur pour warn, un coup pour info.
		bell.age += dt;
		spring(selector, bell.level === 'warn' ? 0.35 : -0.35, dt, 400, 30, calm);
		balanceAngle = calm ? 0 : 0.55 * Math.sin(Math.PI * 2 * clock);
		draw();
		return !calm || moving || plug.t >= 0 || queue.length > 0 || punching !== null || reading >= 0;
	});

	// --- Interaction ----------------------------------------------------------------------------
	const describe = () => {
		scene.setAttribute('aria-valuenow', String(chosen + 1));
		scene.setAttribute('aria-valuetext', `${releves.hover(chosen, wins[chosen].down)}${activeJack() === chosen ? ui.plugged : ''}`);
		drawFocus();
	};
	const pause = () => {
		touring = false;
		clearTimeout(resume);
	};
	const resumeLater = () => {
		clearTimeout(resume);
		resume = window.setTimeout(() => {
			if (asksForStillness() || scene.matches(':focus')) return;
			touring = true;
			startTour(false);
			motion.kick();
		}, RESUME_MS);
	};
	/** Appeler depuis une fenêtre, ou l'acquitter si son volet est tombé. */
	const act = (index: number, event: HookEvent = 'Notification') => {
		pause();
		if (event === 'Notification' && wins[index].down) plugTo(index, true);
		else emit(index, event);
		resumeLater();
	};
	const pointAt = (event: PointerEvent | MouseEvent) => {
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		const inside = ([x0, y0, x1, y1]: number[]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
		for (let index = 0; index < N; index++) if (inside(jackBox(index))) return { index, jack: true };
		for (let index = 0; index < N; index++) if (inside(windowBox(index))) return { index, jack: false };
		return null;
	};

	// Anneau de focus autour de la fenêtre choisie, tant que la scène a le focus.
	const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	ring.setAttribute('class', 'iso-line');
	ring.setAttribute('data-tone', 'hi');
	ring.setAttribute('data-dashed', '');
	svg.append(ring);
	const drawFocus = () => {
		if (!focused) {
			ring.removeAttribute('d');
			return;
		}
		const [x0, y0, x1, y1] = windowBox(chosen);
		ring.setAttribute('d', `M${x0 - 2} ${y0 - 2}H${x1 + 2}V${y1 + 2}H${x0 - 2}Z`);
	};

	const wiring = new AbortController();
	const on = <K extends keyof HTMLElementEventMap>(type: K, listener: (event: HTMLElementEventMap[K]) => void) =>
		scene.addEventListener(type, listener as EventListener, { signal: wiring.signal });
	on('pointermove', (event) => {
		if (event.pointerType === 'touch') return;
		pause();
		const hit = pointAt(event);
		const next = hit ? hit.index : null;
		if (next !== hovered) {
			hovered = next;
			motion.kick();
		}
	});
	on('pointerleave', (event) => {
		if (event.pointerType === 'touch') return;
		hovered = null;
		motion.kick();
		resumeLater();
	});
	on('click', (event) => {
		const hit = pointAt(event);
		if (!hit) return;
		chosen = hit.index;
		if (hit.jack && !wins[hit.index].down) return;
		act(hit.index);
		describe();
	});
	on('focus', () => {
		focused = true;
		pause();
		drawFocus();
	});
	on('blur', () => {
		focused = false;
		drawFocus();
		resumeLater();
	});
	on('keydown', (event) => {
		const digit = Number(event.key);
		let handled = true;
		if (event.key === 'ArrowUp') chosen = Math.max(0, chosen - 1);
		else if (event.key === 'ArrowDown') chosen = Math.min(N - 1, chosen + 1);
		else if (Number.isInteger(digit) && digit >= 1 && digit <= N) chosen = digit - 1;
		else if (event.key === 'Enter' || event.key === ' ') act(chosen);
		else if (event.key === 'f' || event.key === 'F') act(chosen, 'Stop');
		else handled = false;
		if (!handled) return;
		event.preventDefault();
		pause();
		describe();
		motion.kick();
	});

	const attributes = {
		role: 'slider',
		'aria-label': ui.label,
		'aria-valuemin': '1',
		'aria-valuemax': String(N),
	};
	for (const [name, value] of Object.entries(attributes)) scene.setAttribute(name, value);
	describe();

	return () => {
		motion.stop();
		wiring.abort();
		clearTimeout(resume);
		clearTimeout(returning);
		for (const name of [...Object.keys(attributes), 'aria-valuenow', 'aria-valuetext']) scene.removeAttribute(name);
		ring.remove();
		rebuilt.forEach((node, index) => node && (node.innerHTML = original[index]));
		coilBack?.setAttribute('d', coilPaths[0]);
		coilFront?.setAttribute('d', coilPaths[1]);
		if (tipWrap && tipHome) tipHome.parent?.insertBefore(tipWrap, tipHome.next);
		for (const node of [...hooks, plugBody, plugTip, ...dancer, ...shifters, ...Object.values(spinners)]) setTransform(node, '');
		lamps.forEach(([warn, info]) => {
			warn?.removeAttribute('visibility');
			info?.setAttribute('visibility', 'hidden');
		});
		releve.textContent = restText;
	};
};

export default mount;
