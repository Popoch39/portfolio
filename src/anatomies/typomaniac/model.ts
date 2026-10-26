// Modèle du banc de duel : un duel classé de typomaniac rejoué en mémoire, comme le serveur le
// tient (ADR 0003). Les règles sont portées des fonctions du dépôt au commit lu, sans en changer
// un chiffre : `acceptKeystroke`, `applyKeystroke`, `computeScore`, `roundOutcome`,
// `isDuelDecided`, `tpDelta`, `applyTp`, `isFlooding`. Le relevé, la géométrie au repos et le
// mouvement lisent tous ce module ; il tourne au build, sous Node pour l'audit et dans le
// navigateur, sans DOM.

// --- Constantes du code (apps/api, apps/frontend, packages/typing-engine, packages/ranked) ---

/** `DUEL_SECONDS` (service.ts) : une manche dure 30 s, en anglais. */
export const ROUND_MS = 30_000;
/** `END_TOLERANCE_MS` (running-duel.ts) : la manche est jugée 400 ms après sa fin. */
export const TOLERANCE_MS = 400;
/** `ROUND_BREAK_MS` (running-duel.ts). */
export const BREAK_MS = 7000;
/** `COUNTDOWN_MS` (service.ts) : face-à-face 1,5 s, puis 3-2-1. */
export const COUNTDOWN_MS = 4500;
const FACE_OFF_MS = 1500;
/** `MAX_KEYSTROKES_PER_SECOND` (running-duel.ts). */
export const FLOOD = 40;
/** `BATCH_MS` (duel-store.ts) : un lot part au plus 50 ms après sa première frappe. */
export const BATCH_MS = 50;
/** `comboSteps`, `maxMultiplier`, `burstMargin`, `burstMinLetters` (score.ts). */
const COMBO_STEPS = [5, 10, 15];
const MAX_MULTIPLIER = 4;
const BURST_MARGIN = 1.2;
const BURST_MIN_LETTERS = 4;
/** `BASE_TP`, `MIN_TP`, `MAX_TP`, `DIVISION_TP`, `DEMOTED_TP` (ranked.ts). */
const BASE_TP = 20;
const MIN_TP = 8;
const MAX_TP = 35;
export const DIVISION_TP = 100;
const DEMOTED_TP = 75;
/** `IRON_IV_MMR`, `MMR_PER_DIVISION`, `CATCH_UP_TP_PER_MMR`, `ELO_K`, `ELO_SCALE` (ranked.ts). */
const IRON_IV_MMR = 400;
const MMR_PER_DIVISION = 50;
const CATCH_UP = 0.1;
const ELO_K = 32;
const ELO_SCALE = 400;
/** 6 Tiers de 4 Divisions, puis Maniac au 24ᵉ cran (`MANIAC_STEP`). */
export const MANIAC_STEP = 24;
const TIERS = ['Fer', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant'];
const ROMAN = ['I', 'II', 'III', 'IV'];

// --- Choix de la figure (pas des chiffres du code) ---

/** Pace des deux pilotes, en wpm : A à 58, B à 52 (un wpm vaut 5 caractères par minute). */
export const PACE = [58, 52] as const;
/** Trajet d'une impulsion sur un câble, ralenti pour l'œil ; il sert aussi de délai d'arrivée. */
export const CABLE_MS = 350;
/** Le jeton parcourt le rail du guichet à vitesse constante, en fraction de rail par seconde. */
const RAIL_RATE = 3.6;
/** Pivotement d'un bras de barrière, d'un coup sec. */
export const ARM_MS = 120;
/** Place des quatre bras le long du rail (0 : entrée, 1 : sortie), un par motif de refus. */
export const ARMS = [0.12, 0.3, 0.48, 0.66];
/** Le jeton refusé bute contre le bras de son motif, à cette distance avant lui. */
const STOP = 0.075;
/** Deux jetons se suivent d'au moins 50 ms à l'entrée du rail : plus d'un diamètre d'écart. */
const GATE_MS = 50;
/** Le rail visible entre les parois de la niche, en fraction de rail. */
export const RAIL_ENDS = [0.055, 0.945];
/** Saut avoué du tour : la manche file de 6 s à 26 s, 50 fois plus vite. */
const JUMP = [6000, 26_000] as const;
const JUMP_RATE = 50;

/** Les trois textes d'un duel, une liste de mots par manche (`texts.ts`). */
export type Texts = string[][];

// --- Moteur de frappe (run.ts, mode `time` seulement) ---

export type Keystroke = { kind: 'char'; char: string; at: number } | { kind: 'backspace' | 'deleteWord'; at: number };

interface Word {
	target: string;
	typed: string;
}
export interface Run {
	words: Word[];
	index: number;
	validated: number;
}

const createRun = (text: string[]): Run => ({ words: text.map((target) => ({ target, typed: '' })), index: 0, validated: 0 });

const current = (run: Run) => run.words[run.index];

const isIgnored = (run: Run, key: Keystroke) =>
	key.at >= ROUND_MS || (key.kind === 'char' && key.char === ' ' && current(run).typed === '');

const retype = (run: Run, typed: string): Run => ({
	...run,
	words: run.words.map((word, i) => (i === run.index ? { ...word, typed } : word)),
});

/** Le mot précédent, s'il porte une faute : un mot juste n'est jamais retapé. */
const back = (run: Run): Run | null => {
	const previous = run.words[run.index - 1];
	return !previous || previous.typed === previous.target ? null : { ...run, index: run.index - 1, validated: run.validated - 1 };
};

export function applyKeystroke(run: Run, key: Keystroke): Run {
	if (isIgnored(run, key)) return run;
	const { typed } = current(run);
	if (key.kind === 'char') {
		if (key.char !== ' ') return retype(run, typed + key.char);
		// Le texte d'une manche `time` ne s'épuise pas : le banc en tient 36 mots et reste sur le dernier.
		return { ...run, index: Math.min(run.index + 1, run.words.length - 1), validated: run.validated + 1 };
	}
	if (typed !== '') return retype(run, key.kind === 'backspace' ? typed.slice(0, -1) : '');
	const previous = back(run);
	if (!previous) return run;
	return key.kind === 'backspace' ? previous : retype(previous, '');
}

export const replay = (text: string[], keys: readonly Keystroke[]) => keys.reduce(applyKeystroke, createRun(text));

/** `judge` (result.ts) : seuls les caractères comptent, une faute corrigée reste une faute. */
function judge(run: Run, key: Keystroke) {
	if (key.kind !== 'char' || isIgnored(run, key)) return 'ignored';
	const word = current(run);
	const expected = key.char === ' ' ? word.target : word.target[word.typed.length];
	return (key.char === ' ' ? word.typed : key.char) === expected ? 'correct' : 'incorrect';
}

const multiplierOf = (combo: number) => Math.min(MAX_MULTIPLIER, 1 + COMBO_STEPS.filter((step) => combo >= step).length);

export interface Score {
	score: number;
	/** Précision de `computeResult` : la part des frappes de caractère justes, de 0 à 100. */
	accuracy: number;
}

/** `computeScore` (score.ts) sur une manche `time` finie, et la précision de `computeResult`. */
export function computeScore(text: string[], keys: readonly Keystroke[], pace: number): Score {
	let run = createRun(text);
	let score = 0;
	let combo = 0;
	let wordStart = 0;
	let typedChars = 0;
	let right = 0;
	const mistaken = new Set<number>();
	for (const key of keys) {
		const verdict = judge(run, key);
		const next = applyKeystroke(run, key);
		const word = current(run);
		const validated = next.validated > run.validated;
		if (verdict !== 'ignored') typedChars++;
		if (verdict === 'correct') right++;
		if (verdict === 'incorrect') {
			combo = 0;
			mistaken.add(run.index);
		} else if (validated) {
			const chars = word.target.length + 1;
			const burst =
				!mistaken.has(run.index) &&
				word.target.length >= BURST_MIN_LETTERS &&
				chars * 12_000 >= pace * BURST_MARGIN * (key.at - wordStart);
			combo++;
			score += chars * multiplierOf(combo) * (burst ? 2 : 1);
		}
		if (validated) wordStart = key.at;
		run = next;
	}
	// La manche finit au milieu d'un mot : ses lettres justes comptent, au multiplicateur suivant.
	const word = current(run);
	const letters = [...word.typed].filter((char, i) => char === word.target[i]).length;
	score += letters * multiplierOf(combo + 1);
	return { score, accuracy: typedChars ? (right / typedChars) * 100 : 0 };
}

/** `roundOutcome` (outcome.ts) : 1 pour A, −1 pour B, 0 pour une manche nulle. */
export const roundOutcome = (a: Score, b: Score) => Math.sign(a.score - b.score || a.accuracy - b.accuracy);

// --- Contrôles du guichet (acceptance.ts) et cadence (running-duel.ts) ---

export type Reason = 'before-start' | 'after-arrival' | 'out-of-order' | 'after-end';
/** Les motifs dans l'ordre des contrôles, qui est celui des bras du guichet. */
export const REASON_TEXT: Record<Reason, string> = {
	'before-start': 'avant le départ',
	'after-arrival': 'datée après son arrivée',
	'out-of-order': 'hors d’ordre',
	'after-end': 'après la fin',
};
export const REASONS = Object.keys(REASON_TEXT) as Reason[];

/** `rejectReason` : pourquoi l'horloge du client n'est pas crue, ou `null`. */
export function rejectReason(accepted: readonly Keystroke[], { at }: Keystroke, arrivedAt: number): Reason | null {
	const previous = accepted[accepted.length - 1];
	if (at < 0) return 'before-start';
	if (at > arrivedAt) return 'after-arrival';
	if (previous && at < previous.at) return 'out-of-order';
	if (at >= ROUND_MS || arrivedAt > ROUND_MS + TOLERANCE_MS) return 'after-end';
	return null;
}

/** `isFlooding` : plus de 40 frappes acceptées en moins d'une seconde. */
export function isFlooding(accepted: readonly Keystroke[]) {
	const last = accepted[accepted.length - 1];
	const first = accepted[accepted.length - 1 - FLOOD];
	return !!last && !!first && last.at - first.at < 1000;
}

// --- Classement (ranked.ts) ---

export interface Standing {
	step: number;
	tp: number;
	shielded: boolean;
}

export const rankName = ({ step }: Standing) =>
	step >= MANIAC_STEP ? 'Maniac' : `${TIERS[Math.floor(step / 4)]} ${ROMAN[3 - (step % 4)]}`;

const expectedScore = (mmr: number, other: number) => 1 / (1 + 10 ** ((other - mmr) / ELO_SCALE));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `tpDelta` : la base Elo poussée vers le rang que le MMR mérite, bornée entre 8 et 35. */
export function tpDelta(standing: Standing, mmr: number, other: number, outcome: number) {
	const score = (outcome + 1) / 2;
	const delta = Math.round(2 * BASE_TP * (score - expectedScore(mmr, other)) + (mmr - (IRON_IV_MMR + standing.step * MMR_PER_DIVISION)) * CATCH_UP);
	if (outcome > 0) return clamp(delta, MIN_TP, MAX_TP);
	if (outcome < 0) return clamp(delta, -MAX_TP, -MIN_TP);
	return clamp(delta, -MAX_TP, MAX_TP);
}

/** `applyTp` : une Division de plus à 100 TP avec bouclier, une de moins à 75 TP sans bouclier. */
export function applyTp(standing: Standing, delta: number): Standing {
	const tp = standing.tp + delta;
	const { step } = standing;
	if (step < MANIAC_STEP && tp >= DIVISION_TP) return { step: step + 1, tp: tp - DIVISION_TP, shielded: true };
	if (tp >= 0) return { step, tp, shielded: standing.shielded && delta >= 0 };
	if (standing.shielded || step === 0) return { step, tp: 0, shielded: false };
	return { step: step - 1, tp: DEMOTED_TP, shielded: false };
}

/** `nextMmr` hors placement : le MMR bouge aussi, mais le banc ne l'affiche jamais. */
const nextMmr = (mmr: number, other: number, outcome: number) => Math.round(mmr + ELO_K * ((outcome + 1) / 2 - expectedScore(mmr, other)));

/** Or II, comme l'attend un MMR de 1 100 (400 + 14 × 50) : A à 90 TP, B à 40 TP. */
export const START: readonly Standing[] = [
	{ step: 14, tp: 90, shielded: false },
	{ step: 14, tp: 40, shielded: false },
];
export const START_MMR = 1100;

// --- Le duel en mémoire ---

/** Phases du duel et sortes d'évènements, en nombres : le module de mouvement reste sous son budget. */
export const COUNTDOWN = 0;
export const RUNNING = 1;
export const PAUSE = 2;
export const OVER = 3;
export type Phase = 0 | 1 | 2 | 3;
const FLUSH = 0;
const AUTO = 1;
const ARRIVE = 2;
const DONE = 3;
const RELAY = 4;
const RESYNC = 5;
const JUDGE = 6;
const BEGIN = 7;

/** Un lot de frappes, de l'envoi à son retour : l'impulsion, le jeton au guichet, la réponse. */
export interface Trip {
	from: number;
	keys: Keystroke[];
	sent: number;
	/** Arrivée au pied de la tour, où le serveur juge le lot. */
	arrive: number;
	/** Entrée du jeton sur le rail : un jeton à la fois à l'entrée, jamais contre un jeton refusé qui revient. */
	enter: number;
	/** Motif du premier refus, ou `null` quand le lot passe. */
	reason: Reason | null;
	/** Le jeton quitte le guichet : relais vers l'adversaire, ou retour à l'expéditeur. */
	done: number;
	/** Lot envoyé pendant le saut du tour : il ne se dessine pas. */
	hidden: boolean;
	/** Frappé par le visiteur : le relevé dit son verdict. */
	visitor: boolean;
}

interface Pending {
	key: Keystroke;
	/** `dropped` : refusée, et le resync l'a ôtée du bandeau de l'expéditeur. */
	state: 'sent' | 'accepted' | 'rejected' | 'dropped';
}

interface Side {
	/** Frappes tapées sur ce clavier, avec ce que le serveur en a fait. */
	log: Pending[];
	outbox: Keystroke[];
	flushAt: number;
	/** Journal accepté par le serveur : le score et la cadence se lisent dessus. */
	accepted: Keystroke[];
	/** Frappes de l'adversaire reçues par ce client. */
	relayed: Keystroke[];
	next: number;
	auto: boolean;
	/** Mot déjà manqué exprès par le pilote, pour ne le manquer qu'une fois. */
	slipped: number;
	/** L'horloge de B a déjà avancé une fois dans la manche 2. */
	skewed: boolean;
	random: () => number;
	mmr: number;
}

type Event =
	| { at: number; kind: typeof FLUSH | typeof AUTO; side: number }
	| { at: number; kind: typeof ARRIVE | typeof DONE | typeof RELAY | typeof RESYNC; trip: Trip }
	| { at: number; kind: typeof JUDGE | typeof BEGIN };

export interface Judged {
	at: number;
	scores: [Score, Score];
	outcome: number;
}

export interface Duel {
	ranked: boolean;
	/** Temps du duel, en ms depuis le début du face-à-face. */
	clock: number;
	phase: Phase;
	round: number;
	/** La manche dont les journaux sont en cours. */
	played: number;
	roundStart: number;
	phaseAt: number;
	sides: [Side, Side];
	judged: Judged[];
	trips: Trip[];
	presses: { side: number; key: string; at: number }[];
	events: Event[];
	/** Fin du duel : vainqueur (1, −1, 0), forfait, rangs avant et après. */
	over: { at: number; outcome: number; forfeit: boolean; before: Standing[]; after: Standing[]; delta: number[]; mmr: number[] } | null;
	standings: Standing[];
	/** Dernier verdict à dire au relevé. */
	note: { until: number; text: string } | null;
	/** Prochain instant où un jeton peut entrer sur le rail du guichet. */
	gate: number;
	/** Le tour pilote A et fait le saut ; le visiteur le reprend à la main. */
	tour: boolean;
	texts: Texts;
}

// Les pilotes ont leurs aléas, fixés par une graine (Park et Miller) : le tour se rejoue à l'identique.
function seeded(seed: number) {
	let state = seed % 2_147_483_647;
	return () => (state = (state * 16_807) % 2_147_483_647) / 2_147_483_647;
}

const newSide = (index: number, mmr: number): Side => ({
	log: [],
	outbox: [],
	flushAt: -1,
	accepted: [],
	relayed: [],
	next: 0,
	auto: true,
	slipped: -1,
	skewed: false,
	random: seeded(0x5eed0001 + index),
	mmr,
});

export function createDuel(texts: Texts, ranked = true, standings: readonly Standing[] = START): Duel {
	const duel: Duel = {
		texts,
		ranked,
		clock: 0,
		phase: COUNTDOWN,
		round: 0,
		played: 0,
		roundStart: COUNTDOWN_MS,
		phaseAt: 0,
		sides: [newSide(0, START_MMR), newSide(1, START_MMR)],
		judged: [],
		trips: [],
		presses: [],
		events: [],
		over: null,
		standings: [...standings],
		note: null,
		gate: 0,
		tour: true,
	};
	schedule(duel, { at: COUNTDOWN_MS, kind: BEGIN });
	return duel;
}

function schedule(duel: Duel, event: Event) {
	const { events } = duel;
	let i = events.length;
	while (i > 0 && events[i - 1].at > event.at) i--;
	events.splice(i, 0, event);
}

export const roundsToWin = (duel: Duel) => (duel.ranked ? 2 : 1);
export const maxRounds = (duel: Duel) => 2 * roundsToWin(duel) - 1;
/** Le texte de la manche dont les claviers portent encore les frappes : pendant la pause, celle qui vient de finir. */
export const textOf = (duel: Duel) => duel.texts[duel.played % duel.texts.length];
export const roundTime = (duel: Duel) => duel.clock - duel.roundStart;

export function roundsWon(duel: Duel): [number, number] {
	const won: [number, number] = [0, 0];
	for (const { outcome } of duel.judged) if (outcome) won[outcome > 0 ? 0 : 1]++;
	return won;
}

/** `isDuelDecided` : deux manches gagnées, ou la dernière manche jouée. */
const isDecided = (duel: Duel) => duel.judged.length >= maxRounds(duel) || roundsWon(duel).some((won) => won >= roundsToWin(duel));

/** La frappe que le pilote, ou un clic, envoie : la lettre attendue, l'espace, ou retour arrière sur une faute. */
export function expectedKey(run: Run): string {
	const { target, typed } = current(run);
	if (!target.startsWith(typed)) return 'Backspace';
	return typed.length < target.length ? target[typed.length] : ' ';
}

/** La frappe d'un pilote : en manche 2, A rate la deuxième lettre d'un mot sur quatre et la corrige. */
function autoKey(duel: Duel, side: number): string {
	const player = duel.sides[side];
	const run = clientRun(duel, side);
	const key = expectedKey(run);
	const { typed } = current(run);
	if (side === 0 && duel.round === 1 && run.index % 4 === 2 && typed.length === 1 && player.slipped !== run.index && key !== ' ') {
		player.slipped = run.index;
		return key === 'e' ? 'r' : 'e';
	}
	return key;
}

/**
 * Les pilotes marquent un temps autour du seul refus du duel, pour que le guichet le montre seul :
 * A hésite de 1,9 à 3,4 s en manche 2, et B s'arrête 0,7 s après sa frappe mal datée.
 */
function pause(duel: Duel, side: number, at: number) {
	if (duel.round !== 1) return at;
	const t = at - duel.roundStart;
	if (side === 0 && t >= 1900 && t < 3400) return duel.roundStart + 3400 + (t - 1900) / 10;
	if (side === 1 && duel.sides[1].skewed && t < 3300) return duel.roundStart + 3300;
	return at;
}

/** Chaque frappe d'un pilote suit sa Pace, à ±25 % près. */
const interval = (side: Side, pace: number) => (60_000 / (pace * 5)) * (0.75 + side.random() * 0.5);

export const clientRun = (duel: Duel, side: number) =>
	replay(
		textOf(duel),
		duel.sides[side].log.filter((pending) => pending.state !== 'dropped').map((pending) => pending.key),
	);

export const opponentRun = (duel: Duel, side: number) => replay(textOf(duel), duel.sides[side].relayed);

/** Une touche frappée sur un clavier : datée, appliquée tout de suite, puis mise en lot. */
export function press(duel: Duel, side: number, name: string) {
	duel.presses.push({ side, key: name === ' ' ? 'space' : name === 'Backspace' || name === 'deleteWord' ? 'back' : name, at: duel.clock });
	if (duel.phase !== RUNNING) return;
	let at = Math.round(roundTime(duel));
	if (at >= ROUND_MS) return;
	const player = duel.sides[side];
	// Le seul refus du duel : l'horloge de B prend une demi-seconde d'avance, une fois, en manche 2.
	if (side === 1 && duel.round === 1 && at >= 2400 && !player.skewed) {
		player.skewed = true;
		at += 500;
	}
	const key: Keystroke =
		name === 'Backspace' ? { kind: 'backspace', at } : name === 'deleteWord' ? { kind: 'deleteWord', at } : { kind: 'char', char: name, at };
	player.log.push({ key, state: 'sent' });
	player.outbox.push(key);
	if (player.flushAt < 0) {
		player.flushAt = duel.clock + BATCH_MS;
		schedule(duel, { at: player.flushAt, kind: FLUSH, side });
	}
}


/** Le tour fait le saut avoué : au milieu de chaque manche, le temps file. Cadence, et jusqu'à quand. */
function rate(duel: Duel): [speed: number, until: number] {
	const t = roundTime(duel);
	if (!duel.tour || duel.phase !== RUNNING || t >= JUMP[1]) return [1, Infinity];
	return t < JUMP[0] ? [1, duel.roundStart + JUMP[0]] : [JUMP_RATE, duel.roundStart + JUMP[1]];
}

/** Avance le duel de `wall` ms de temps réel ; le saut du tour les multiplie. */
export function advance(duel: Duel, wall: number) {
	let left = wall;
	while (left > 1e-9) {
		const [speed, until] = rate(duel);
		const start = duel.clock;
		const end = Math.min(start + left * speed, until);
		run(duel, end);
		left -= (end - start) / speed;
		duel.clock = end;
	}
	prune(duel);
}

function run(duel: Duel, until: number) {
	while (duel.events.length && duel.events[0].at <= until) {
		const event = duel.events.shift() as Event;
		duel.clock = event.at;
		handle(duel, event);
	}
}

function handle(duel: Duel, event: Event) {
	const { sides } = duel;
	switch (event.kind) {
		case BEGIN: {
			duel.phase = RUNNING;
			duel.phaseAt = event.at;
			duel.roundStart = event.at;
			duel.played = duel.round;
			sides.forEach((side, index) => {
				Object.assign(side, { log: [], outbox: [], accepted: [], relayed: [], flushAt: -1, slipped: -1, skewed: false });
				if (side.auto) planAuto(duel, index, event.at + interval(side, PACE[index]));
			});
			schedule(duel, { at: event.at + ROUND_MS + TOLERANCE_MS, kind: JUDGE });
			break;
		}
		case AUTO: {
			const side = sides[event.side];
			if (!side.auto || side.next !== event.at || duel.phase !== RUNNING) break;
			press(duel, event.side, autoKey(duel, event.side));
			planAuto(duel, event.side, pause(duel, event.side, event.at + interval(side, PACE[event.side])));
			break;
		}
		case FLUSH: {
			const side = sides[event.side];
			side.flushAt = -1;
			if (!side.outbox.length) break;
			const sent = event.at;
			const trip: Trip = {
				from: event.side,
				keys: side.outbox,
				sent,
				arrive: sent + CABLE_MS,
				reason: null,
				enter: Infinity,
				done: Infinity,
				hidden: rate(duel)[0] > 1,
				// Le pilote de A coupé, chaque frappe de A est celle du visiteur.
				visitor: !event.side && !side.auto,
			};
			side.outbox = [];
			duel.trips.push(trip);
			schedule(duel, { at: trip.arrive, kind: ARRIVE, trip });
			break;
		}
		case ARRIVE: {
			// Le serveur juge chaque frappe à son arrivée, contre la manche en cours (`receive`).
			const { trip } = event;
			const side = sides[trip.from];
			const arrivedAt = event.at - duel.roundStart;
			for (const key of trip.keys) {
				const reason = rejectReason(side.accepted, key, arrivedAt);
				const pending = side.log.find((p) => p.key === key);
				if (pending) pending.state = reason ? 'rejected' : 'accepted';
				if (reason) trip.reason ??= reason;
				else side.accepted.push(key);
				if (duel.phase === RUNNING && isFlooding(side.accepted)) {
					finish(duel, trip.from ? 1 : -1, true);
					break;
				}
			}
			// Le jeton attend son tour à l'entrée, caché derrière le montant de l'embrasure : le
			// serveur a déjà jugé, le guichet montre le verdict jeton par jeton.
			trip.enter = Math.max(event.at, duel.gate);
			trip.done = trip.enter + railTime(trip.reason);
			duel.gate = trip.reason ? trip.done : trip.enter + GATE_MS;
			schedule(duel, { at: trip.done, kind: DONE, trip });
			break;
		}
		case DONE: {
			const { trip } = event;
			const last = trip.keys[trip.keys.length - 1];
			// Le relevé dit le verdict 1,2 s : celui de chaque frappe du visiteur, et tout refus.
			if (trip.visitor || (trip.reason && !trip.hidden)) {
				const verdict = trip.reason ? `refusée : ${REASON_TEXT[trip.reason]}` : `« ${last.kind === 'char' ? last.char.replace(' ', '␣') : '⌫'} » acceptée à ${formatMs(last.at)} ms`;
				duel.note = { until: event.at + 1200, text: `${head(duel)} · ${verdict}` };
			}
			schedule(duel, { at: event.at + CABLE_MS, kind: trip.reason ? RESYNC : RELAY, trip });
			break;
		}
		case RELAY: {
			const { trip } = event;
			const accepted = sides[trip.from].accepted;
			sides[1 - trip.from].relayed.push(...trip.keys.filter((key) => accepted.includes(key)));
			break;
		}
		case RESYNC:
			// Le client repart de l'état du serveur : la frappe refusée disparaît de son bandeau.
			for (const pending of sides[event.trip.from].log) if (pending.state === 'rejected') pending.state = 'dropped';
			break;
		case JUDGE: {
			if (duel.phase !== RUNNING) break;
			const text = textOf(duel);
			const scores = sides.map((side, index) => computeScore(text, side.accepted, PACE[index])) as [Score, Score];
			duel.judged.push({ at: event.at, scores, outcome: roundOutcome(...scores) });
			duel.note = { until: event.at + 2000, text: `manche ${duel.round + 1} jugée · A ${scores[0].score} pts – ${scores[1].score} pts B` };
			if (isDecided(duel)) {
				const won = roundsWon(duel);
				finish(duel, Math.sign(won[0] - won[1] || totalScore(duel)), false);
			} else {
				duel.phase = PAUSE;
				duel.phaseAt = event.at;
				schedule(duel, { at: event.at + BREAK_MS, kind: BEGIN });
				duel.round++;
			}
			break;
		}
	}
}

/** `duelOutcome` : le plus de manches gagnées, puis le score cumulé, puis la précision. */
function totalScore(duel: Duel) {
	let lead = 0;
	for (const { scores } of duel.judged) lead += scores[0].score - scores[1].score;
	if (lead) return lead;
	for (const { scores } of duel.judged) lead += scores[0].accuracy - scores[1].accuracy;
	return lead;
}

function finish(duel: Duel, outcome: number, forfeit: boolean) {
	duel.phase = OVER;
	duel.phaseAt = duel.clock;
	duel.events = duel.events.filter((event) => event.kind !== JUDGE && event.kind !== BEGIN && event.kind !== AUTO);
	const before = duel.standings;
	const mmr = duel.sides.map((side) => side.mmr);
	const delta = before.map((standing, i) => (duel.ranked ? tpDelta(standing, mmr[i], mmr[1 - i], i ? -outcome : outcome) : 0));
	duel.over = {
		at: duel.clock,
		outcome,
		forfeit,
		before,
		after: before.map((standing, i) => (duel.ranked ? applyTp(standing, delta[i]) : standing)),
		delta,
		mmr: duel.ranked ? mmr.map((value, i) => nextMmr(value, mmr[1 - i], i ? -outcome : outcome)) : mmr,
	};
}

function planAuto(duel: Duel, side: number, at: number) {
	duel.sides[side].next = at;
	schedule(duel, { at, kind: AUTO, side });
}

/** Mouvement réduit : les lots en cours traversent tout de suite câble et guichet, sans trajet ni temps qui passe. */
export function rush(duel: Duel) {
	for (let pass = 0; pass < 5; pass++) {
		for (const event of duel.events) if (event.kind !== JUDGE && event.kind !== BEGIN && event.kind !== AUTO) event.at = Math.min(event.at, duel.clock);
		duel.events.sort((a, b) => a.at - b.at);
		const clock = duel.clock;
		run(duel, clock);
		duel.clock = clock;
	}
}

/** Le visiteur prend A à la main : le pilote s'arrête et le temps passe en temps réel. */
export function takeOver(duel: Duel) {
	duel.tour = false;
	duel.sides[0].auto = false;
}

/** Après 5 s sans frappe, le tour reprend là où en est le duel. */
export function resumeTour(duel: Duel) {
	duel.tour = true;
	const side = duel.sides[0];
	if (side.auto) return;
	side.auto = true;
	if (duel.phase === RUNNING) planAuto(duel, 0, duel.clock + interval(side, PACE[0]));
}

// --- Trajets visibles : impulsions, jeton, bras ---

/** Durée du passage au guichet : traverser le rail, ou buter contre un bras et revenir. */
function railTime(reason: Reason | null) {
	if (!reason) return 1000 / RAIL_RATE;
	return ((2 * (ARMS[REASONS.indexOf(reason)] - STOP)) / RAIL_RATE) * 1000;
}

/** Position du jeton sur le rail (0 : entrée, 1 : sortie), ou `null` hors du guichet. */
export function tokenAt(trip: Trip, clock: number) {
	if (trip.hidden || clock < trip.enter || clock >= trip.done) return null;
	const travelled = ((clock - trip.enter) / 1000) * RAIL_RATE;
	const stop = trip.reason ? ARMS[REASONS.indexOf(trip.reason)] - STOP : 1;
	const at = travelled <= stop ? travelled : 2 * stop - travelled;
	// Aux deux bouts, le jeton est dans l'épaisseur des parois : il ne se dessine qu'entre elles.
	return at >= RAIL_ENDS[0] && at <= RAIL_ENDS[1] ? at : null;
}

/** Les impulsions d'un câble : leur position du clavier (0) à la tour (1). */
export function pulsesOn(duel: Duel, cable: number) {
	const pulses: number[] = [];
	for (const trip of duel.trips) {
		if (trip.hidden) continue;
		const { clock } = duel;
		if (trip.from === cable && clock >= trip.sent && clock < trip.arrive) pulses.push((clock - trip.sent) / CABLE_MS);
		const back = trip.reason ? trip.from : 1 - trip.from;
		if (back === cable && clock >= trip.done && clock < trip.done + CABLE_MS) pulses.push(1 - (clock - trip.done) / CABLE_MS);
	}
	return pulses;
}

/**
 * Ouverture d'un bras (0 : en travers du rail, 1 : le long), d'un coup sec devant chaque jeton
 * qui doit le franchir. Le bras du motif d'un refus reste en travers.
 */
export function armOpening(duel: Duel, arm: number) {
	const t = duel.clock;
	let open = 0;
	let shut = 0;
	for (const trip of duel.trips) {
		if (trip.hidden) continue;
		const blocked = trip.reason ? REASONS.indexOf(trip.reason) : 4;
		if (blocked === arm) {
			// Le jeton refusé est arrivé : son bras retombe en travers avant qu'il ne bute.
			shut = Math.max(shut, Math.min(1, Math.max(0, (t - trip.enter) / ARM_MS), Math.max(0, 1 - (t - trip.done) / ARM_MS)));
		}
		if (blocked <= arm) continue;
		// Tant que les jetons se suivent de près, le bras reste ouvert : le flux passe.
		const reach = trip.enter + ((ARMS[arm] - 0.45) / RAIL_RATE) * 1000;
		const pass = trip.enter + ((ARMS[arm] + 0.2) / RAIL_RATE) * 1000;
		open = Math.max(open, Math.min(1, Math.max(0, (t - reach) / ARM_MS), Math.max(0, 1 - (t - pass) / ARM_MS)));
	}
	return Math.min(open, 1 - shut);
}

/** Oublie les trajets finis : le duel tourne en boucle sans grossir. */
function prune(duel: Duel) {
	duel.trips = duel.trips.filter((trip) => duel.clock < trip.done + CABLE_MS);
	duel.presses = duel.presses.filter((p) => p.at > duel.clock - 1000);
}

/** Position du curseur d'un run dans le texte de la manche, espaces comprises. */
function cursorOf(run: Run) {
	const word = current(run);
	return run.words.slice(0, run.index).reduce((sum, w) => sum + w.target.length + 1, 0) + Math.min(word.typed.length, word.target.length);
}

/**
 * Le bandeau d'un clavier : `span` caractères autour du curseur, dont `before` déjà tapés (le mot
 * en cours tel qu'il est tapé, fautes comprises), et la case du curseur de l'adversaire, ou −1.
 */
export function bandeau(duel: Duel, side: number, before: number, span: number) {
	const own = clientRun(duel, side);
	const text = textOf(duel).join(' ');
	const at = cursorOf(own);
	const word = current(own);
	const wordStart = at - Math.min(word.typed.length, word.target.length);
	let chars = '';
	for (let i = at - before; i < at - before + span; i++) chars += i >= wordStart && i < at ? word.typed[i - wordStart] : (text[i] ?? ' ');
	const offset = cursorOf(opponentRun(duel, side)) - at;
	return { chars, opponent: offset >= -before && offset < span - before ? before + offset : -1 };
}

// --- Pose des pièces, lue sur l'état du duel ---

/** Après la fin : le classement se lit 3,1 s, puis le banc revient au repos et un duel recommence à 5,1 s. */
export const RETURN_MS = 3100;
export const LOOP_MS = 5100;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const since = (duel: Duel, at: number) => duel.clock - at;
const returning = (duel: Duel) => (duel.over ? ease(since(duel, duel.over.at + RETURN_MS) / 900) : 0);

/** Lampe `index` d'un joueur : elle chauffe 250 ms à la manche gagnée, et s'éteint au retour au repos. */
export function lampLevel(duel: Duel, side: number, index: number) {
	let wins = 0;
	for (const judged of duel.judged) {
		if (judged.outcome !== (side ? -1 : 1)) continue;
		if (wins++ === index) return Math.min(1, Math.max(0, since(duel, judged.at) / 250)) * (1 - returning(duel));
	}
	return 0;
}

/** Barres de verrouillage : 0 levées, 1 posées sur les touches ; elles tombent sec, avec un petit rebond. */
export function barLevel(duel: Duel) {
	const t = since(duel, duel.phaseAt);
	if (duel.phase === RUNNING) return 1 - ease(t / 260);
	if (t < 110) return (t / 110) ** 2;
	return 1 - 0.08 * Math.sin(((t - 110) / 70) * Math.PI) * Math.exp(-(t - 110) / 60);
}

/** Temps lu par le tambour, en s : il suit la manche, puis revient à zéro pendant la pause. */
export function drumTime(duel: Duel) {
	if (duel.phase === RUNNING) return Math.min(Math.max(roundTime(duel), 0), ROUND_MS + TOLERANCE_MS) / 1000;
	if (duel.phase === COUNTDOWN) return 0;
	const judged = duel.judged[duel.judged.length - 1];
	return judged ? 30.4 * (1 - ease(since(duel, judged.at + 600) / 1400)) : 0;
}

/** Enfoncement d'une touche frappée : sec à l'aller, rappel en ressort raide. */
export function keyDepth(duel: Duel, side: number, key: string) {
	let depth = 0;
	for (const press of duel.presses) {
		if (press.side !== side || press.key !== key) continue;
		const t = since(duel, press.at);
		depth = Math.max(depth, t < 0 ? 0 : t < 25 ? t / 25 : 1 - Math.max(0, (t - 70) / 60));
	}
	return depth;
}


/** Position d'un joueur sur le mât, en crans : `step + tp / 100`, qui glisse au classement puis revient. */
export function mastProgress(duel: Duel, side: number) {
	const start = duel.standings[side];
	const v0 = start.step + start.tp / DIVISION_TP;
	if (!duel.over || !duel.ranked) return v0;
	const end = duel.over.after[side];
	const v1 = end.step + end.tp / DIVISION_TP;
	// Le vernier glisse à vitesse constante : le franchissement d'une Division tombe à un instant connu.
	const v = v0 + (v1 - v0) * Math.min(1, Math.max(0, since(duel, duel.over.at + 600) / 1600));
	return v + (v0 - v) * returning(duel);
}

/** Le curseur monte d'un cran quand la position franchit une Division ; le drapeau de bouclier bascule. */
export function sliderPose(duel: Duel, side: number) {
	const start = duel.standings[side];
	const v = mastProgress(duel, side);
	let climb = 0;
	let shield = start.shielded ? 1 : 0;
	const end = duel.over && duel.ranked ? duel.over.after[side] : start;
	if (duel.over && end.step !== start.step) {
		// Le vernier franchit la Division : le curseur gagne le cran en 400 ms, le drapeau se dresse.
		const v0 = start.step + start.tp / DIVISION_TP;
		const v1 = end.step + end.tp / DIVISION_TP;
		const cross = duel.over.at + 600 + (1600 * (Math.max(end.step, start.step) - v0)) / (v1 - v0);
		const t = Math.max(0, since(duel, cross));
		climb = t > 0 ? (end.step - start.step) * (1 - Math.exp(-t / 400)) : 0;
		if (end.shielded) shield = ease(t / 300);
	}
	const back = 1 - returning(duel);
	return { step: start.step + climb * back, tp: (((v % 1) + 1) % 1) * DIVISION_TP, shield: shield * back };
}

/** MMR de A, qui tire le contrepoids : il bouge au classement sans qu'aucun chiffre ne le dise. */
export function mmrOf(duel: Duel) {
	if (!duel.over || !duel.ranked) return START_MMR;
	const v = START_MMR + (duel.over.mmr[0] - START_MMR) * ease(since(duel, duel.over.at + 600) / 1600);
	return v + (START_MMR - v) * returning(duel);
}

// --- Relevé ---

const decimal = (value: number) => value.toFixed(1).replace('.', ',');
const formatMs = (ms: number) => String(ms).replace(/\B(?=(\d{3})+$)/g, ' ');

/** Le relevé, lu sur l'état du duel à son instant. */
export function releveOf(duel: Duel): string {
	const { clock, note, over } = duel;
	const [a, b] = roundsWon(duel);
	if (over) {
		const since = clock - over.at;
		if (over.forfeit && since < 2000) return 'forfait : plus de 40 frappes en 1 s';
		const who = over.outcome > 0 ? 'A gagne' : over.outcome < 0 ? 'B gagne' : 'égalité';
		if (!duel.ranked) return `fin · ${who}`;
		const after = over.after[0];
		if (since >= 2000 && after.step !== over.before[0].step) return `${rankName(over.before[0])} → ${rankName(after)}${after.shielded ? ' · bouclier' : ''}`;
		return `fin · ${who}${over.forfeit ? '' : ` ${a}–${b}`} · ${signed(over.delta[0])} TP`;
	}
	if (note && clock < note.until) return note.text;
	if (duel.phase === COUNTDOWN) {
		const left = Math.ceil((COUNTDOWN_MS - clock) / 1000);
		return clock < FACE_OFF_MS ? `face-à-face · ${head(duel)}` : `${head(duel)} · départ dans ${Math.min(left, 3)} s`;
	}
	if (duel.phase === PAUSE) return `pause · reprise dans ${Math.max(1, Math.ceil((duel.phaseAt + BREAK_MS - clock) / 1000))} s`;
	const t = Math.min(Math.max(roundTime(duel), 0), ROUND_MS + TOLERANCE_MS) / 1000;
	return `${head(duel)} · ${decimal(t)} s · A ${a}–${b} B`;
}

const head = (duel: Duel) => (duel.ranked ? `manche ${duel.round + 1}/${maxRounds(duel)}` : 'défi');
const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

// --- Pose au repos ---

/** Manche 2 à 18,6 s, A mène 1–0 : la pose du SVG au repos, et le départ du mouvement. */
const REST_MS = 18_600;

/** Le duel du tour mené en temps réel jusqu'à la pose au repos : même chemin au build et au montage. */
export function restDuel(texts: Texts): Duel {
	const duel = createDuel(texts);
	duel.tour = false;
	for (;;) {
		const left = duel.round === 1 && duel.phase === RUNNING ? REST_MS - roundTime(duel) : Infinity;
		if (left <= 0) break;
		advance(duel, Math.min(1000 / 60, left));
	}
	duel.tour = true;
	return duel;
}
