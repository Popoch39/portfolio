// Modèle de la rampe à cadran : les vraies règles de `statusline.ts` (Popoch39/claude-status-line,
// au commit lu), rejouées sur un scénario d'entrées d'exemple. La status line ne calcule pas
// l'usage, elle le lit : les pourcentages et les instants de reset viennent du README (68 %, 2h14 ;
// 41 %, 3j), tout ce que la machine en fait est le traitement du code. Le temps simulé `t` est en
// minutes depuis le lancement de la session ; Claude Code relance la commande toutes les
// `refreshInterval` secondes (60), donc un rendu par minute entière. Fonction pure de `t` : revenir
// en arrière rejoue exactement le même état, comme le code, sans état en mémoire hors du cache.

import type { Locale, Localized } from '../../lib/i18n.ts';
import type { Timeline } from '../contract.ts';

export const SHA = 'f77fa09f17d4781dbdefbff2542ae951852b67d0';
export const VERSION = '1.0.0';

/** `BAR_WIDTH` (L62) : dix cases, dix lames par peigne. */
export const BAR_WIDTH = 10;
/** `FETCH_TIMEOUT_MS` (L158) : un tour de la bague de temporisation. */
export const FETCH_TIMEOUT_MS = 2500;
/** `refreshInterval: 60` (L284), en secondes d'après la doc de Claude Code : un rendu par cran. */
export const REFRESH_SECONDS = 60;
/** Un tour de volant : soixante crans de croix de Malte, soit soixante rendus. */
export const MINUTES_PER_TURN = 60;

export type Source = 'stdin' | 'API' | 'cache';
export const SOURCES: Source[] = ['stdin', 'API', 'cache'];

interface Window {
	used_percentage?: number;
	/** Epoch en secondes ; ici, secondes depuis le lancement de la session. */
	resets_at?: number;
}

interface RateLimits {
	five_hour?: Window;
	seven_day?: Window;
}

/** `colorFor` (L53–L57) : 0 vert (< 50), 1 jaune (50 à 80 inclus), 2 rouge (> 80). */
export const zoneOf = (pct: number) => (pct > 80 ? 2 : pct >= 50 ? 1 : 0);

/** `bar` (L64–L69) : bornage, cases pleines, pourcentage affiché. */
export function bar(pct: number) {
	const clamped = Math.max(0, Math.min(100, pct));
	return { clamped, filled: Math.round((clamped / 100) * BAR_WIDTH), shown: Math.round(clamped), zone: zoneOf(clamped) };
}

/** `fmtReset` (L74–L85), avec l'instant présent en paramètre au lieu de `Date.now()`. */
export function fmtReset(epochSec: number | undefined, nowSec: number): string {
	if (epochSec == null) return '';
	const delta = epochSec - nowSec;
	if (delta <= 0) return '0m';
	if (delta >= 86400) return `${Math.floor(delta / 86400)}j`;
	if (delta >= 3600) {
		const h = Math.floor(delta / 3600);
		const m = Math.floor((delta % 3600) / 60);
		return `${h}h${String(m).padStart(2, '0')}`;
	}
	return `${Math.floor(delta / 60)}m`;
}

/** `hasFreshData` (L143–L145) : seule la fenêtre de 5 h compte. */
const hasFreshData = (limits?: RateLimits) => limits?.five_hour?.used_percentage != null;

// --- Scénario d'exemple -------------------------------------------------------------------------

/** Dernière minute simulée : la boucle hors ligne de la seconde session. */
export const LAST = 150;
/** Pose au repos : la première réponse est arrivée, stdin porte les limites. */
export const REST = 1;
/** Début de la seconde session, hors ligne. */
const OFFLINE_FROM = 145;

const minute = 60;
const FIVE_RESET = 135 * minute;
const WEEK_RESET = (3 * 24 + 6) * 60 * minute;
const FIVE_RESTART = 136;
const FIVE_NEXT_RESET = (FIVE_RESTART + 300) * minute;

/** Ce que Claude Code passe sur stdin au rendu de la minute `m` (L35–L38) : rien au premier rendu. */
function stdinAt(m: number): RateLimits | undefined {
	if (m < 1 || m >= OFFLINE_FROM) return undefined;
	const busy = Math.min(m, 41) - 1;
	if (m >= FIVE_RESTART) {
		return { five_hour: { used_percentage: 2, resets_at: FIVE_NEXT_RESET }, seven_day: { used_percentage: 43, resets_at: WEEK_RESET } };
	}
	return {
		five_hour: { used_percentage: 68 + 0.5 * busy, resets_at: FIVE_RESET },
		seven_day: { used_percentage: 41 + 0.05 * busy, resets_at: WEEK_RESET },
	};
}

/** La réponse de l'API au jeton (L183–L209) : 0,68 et 0,41 au lancement, rien une fois hors ligne. */
function apiAt(m: number): { limits?: RateLimits; ms: number } {
	if (m >= OFFLINE_FROM) return { ms: FETCH_TIMEOUT_MS };
	return { limits: { five_hour: { used_percentage: 0.68 * 100, resets_at: FIVE_RESET }, seven_day: { used_percentage: 0.41 * 100, resets_at: WEEK_RESET } }, ms: 900 };
}

export interface Render {
	m: number;
	source: Source;
	limits?: RateLimits;
	/** Requête à l'API pendant ce rendu, et sa durée (temporisation comprise). */
	fetch?: { ok: boolean; ms: number };
	/** `writeCache` pendant ce rendu. */
	wrote: boolean;
}

/** `resolveRateLimits` (L214–L227), avec le cache disque en argument. */
function resolve(m: number, cache: RateLimits | undefined): Render {
	const fromStdin = stdinAt(m);
	if (hasFreshData(fromStdin)) return { m, source: 'stdin', limits: fromStdin, wrote: true };
	const { limits: fetched, ms } = apiAt(m);
	if (fetched) return { m, source: 'API', limits: fetched, fetch: { ok: true, ms }, wrote: true };
	return { m, source: 'cache', limits: cache ?? fromStdin, fetch: { ok: false, ms }, wrote: false };
}

/** Tous les rendus du scénario, de la minute 0 à `LAST` : le cache est le seul état qui traverse. */
export const RENDERS: Render[] = (() => {
	const out: Render[] = [];
	let cache: RateLimits | undefined;
	for (let m = 0; m <= LAST; m++) {
		const render = resolve(m, cache);
		if (render.wrote) cache = render.limits;
		out.push(render);
	}
	return out;
})();

/** Ce que montre la rampe : une fenêtre par module, ou rien tant qu'aucune ligne n'est sortie. */
export interface Shown {
	/** Pourcentage reçu (avant bornage), ou `null` : la fenêtre s'écrit alors « — ». */
	pct: number | null;
	/** Délai avant reset, au format de `fmtReset`. */
	reset: string;
}

export interface Output {
	five: Shown;
	week: Shown;
}

const shownOf = (window: Window | undefined, nowSec: number): Shown => ({
	pct: window?.used_percentage ?? null,
	reset: window?.used_percentage == null ? '' : fmtReset(window.resets_at, nowSec),
});

const BLANK: Output = { five: { pct: null, reset: '' }, week: { pct: null, reset: '' } };

export const outputOf = (render: Render): Output => ({
	five: shownOf(render.limits?.five_hour, render.m * minute),
	week: shownOf(render.limits?.seven_day, render.m * minute),
});

// --- Pose de la machine à l'instant t -------------------------------------------------------------

/**
 * Échelle de la sonde : 2,5 s de requête durent 0,4 minute simulée, pour que la bague se voie
 * tourner (le tour au repos ralentit autour de ces rendus).
 */
export const FETCH_SPAN = 0.4;
const FETCH_START = 0.04;
const STROKE_IN = 0.04;
/** La croix de Malte avance pendant le dernier tiers de chaque minute et verrouille au rendu. */
const STEP_FROM = 2 / 3;
const HAMMER_AT = 0.02;
const HAMMER_SPAN = 0.12;

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export interface Pose {
	t: number;
	m: number;
	render: Render;
	/** Sortie visible : celle du rendu, une fois la requête terminée s'il y en a une. */
	output: Output;
	/** Cran visé par le levier d'aiguillage : 0 stdin, 1 API, 2 cache. */
	lever: number;
	/** Sortie du plongeur de la sonde, de 0 à 1, et tours de sa bague (1 tour = 2,5 s). */
	probe: number;
	ring: number;
	/** Frappe du tampon d'écriture sur la capsule, de 0 à 1. */
	hammer: number;
	/** Tours du volant, tours du doigt et angle de la croix de Malte (degrés). */
	wheel: number;
	driver: number;
	cross: number;
}

/** Angle de la croix de Malte à six fentes pour un angle du doigt φ engagé (|φ| ≤ 60°), en degrés. */
const genevaOf = (phi: number) => (Math.atan2(Math.sin(phi), 2 - Math.cos(phi)) * 180) / Math.PI;

export function poseAt(t: number): Pose {
	const clamped = Math.max(0, Math.min(LAST + 0.999, t));
	const m = Math.min(LAST, Math.floor(clamped));
	const f = clamped - m;
	const render = RENDERS[m];
	let output = outputOf(render);
	let lever = SOURCES.indexOf(render.source);
	let probe = 0;
	let ring = 0;
	let hammer = 0;
	if (render.fetch) {
		const span = (render.fetch.ms / FETCH_TIMEOUT_MS) * FETCH_SPAN;
		const done = FETCH_START + span;
		const sameSession = m > 0 && m !== OFFLINE_FROM;
		if (f < done) {
			output = sameSession ? outputOf(RENDERS[m - 1]) : BLANK;
			lever = 1;
		}
		probe = smooth((f - FETCH_START) / STROKE_IN) * (1 - smooth((f - done) / STROKE_IN));
		ring = (Math.min(Math.max(f - FETCH_START, 0), span) / FETCH_SPAN) * probe;
		if (render.wrote) hammer = Math.sin(Math.PI * smooth((f - done) / HAMMER_SPAN));
	} else if (render.wrote) {
		hammer = Math.sin(Math.PI * smooth((f - HAMMER_AT) / HAMMER_SPAN));
	}
	const engaged = f >= STEP_FROM;
	const phi = engaged ? (f - (STEP_FROM + 1) / 2) * 2 * Math.PI : 0;
	return {
		t: clamped,
		m,
		render,
		output,
		lever,
		probe,
		ring,
		hammer,
		wheel: clamped / MINUTES_PER_TURN,
		driver: f,
		cross: 60 * m + 30 + (engaged ? genevaOf(phi) : -30),
	};
}

/** Le 5h que porte le cache disque à l'instant t, borné, de 0 à 1 (0 tant que rien n'est écrit). */
export function cacheLevel(t: number) {
	const clamped = Math.max(0, Math.min(LAST + 0.999, t));
	const m = Math.min(LAST, Math.floor(clamped));
	const f = clamped - m;
	const render = RENDERS[m];
	const written = render.fetch ? FETCH_START + (render.fetch.ms / FETCH_TIMEOUT_MS) * FETCH_SPAN : HAMMER_AT;
	const last = RENDERS.slice(0, render.wrote && f >= written ? m + 1 : m).filter((r) => r.wrote).pop();
	return bar(last?.limits?.five_hour?.used_percentage ?? 0).clamped / 100;
}

/**
 * Instants où il se passe quelque chose : requête, lame, seuil, format, reset, et la session hors
 * ligne une fois la temporisation écoulée (le levier sur le cache).
 */
export const EVENTS = [0, 15, 26, 35, 76, 135, 136, OFFLINE_FROM + 0.5];

// --- Relevé ---------------------------------------------------------------------------------------

/** Espace fine insécable avant « % ». */
const THIN = ' ';

/** Avant « % » : l'espace fine en français ; rien en anglais, comme la ligne du binaire. */
const BEFORE_PERCENT: Localized<string> = { fr: THIN, en: '' };

/** Relevé de la carte, au format de la fiche : `{source} · 5h {p5} % · reset {r5} · sem {p7} % · {r7}`. */
// Libellés et délais sont ceux que le binaire écrit : seule la typographie du pourcentage suit la langue.
export function releveOf(source: Source, five: Shown, week: Shown, locale: Locale) {
	const segment = (pct: number) => `${bar(pct).shown}${BEFORE_PERCENT[locale]}%`;
	const first = five.pct == null ? '5h —' : `5h ${segment(five.pct)}${five.reset ? ` · reset ${five.reset}` : ''}`;
	const second = week.pct == null ? 'sem —' : `sem ${segment(week.pct)}${week.reset ? ` · ${week.reset}` : ''}`;
	return `${source} · ${first} · ${second}`;
}

export const restPose = poseAt(REST);
const restReleve = (locale: Locale) => releveOf(SOURCES[restPose.lever], restPose.output.five, restPose.output.week, locale);
export const releve: Localized<string> = { fr: restReleve('fr'), en: restReleve('en') };

// --- Règle de temps -------------------------------------------------------------------------------

// « 1 h 30 » se lit en français ; l'anglais dit « 1½ h », aussi court, pour tenir à 390 px.
const hourLabel = (m: number, locale: Locale) =>
	m === 0 ? '0' : m < 60 ? `${m} min` : locale === 'en' && m % 60 === 30 ? `${Math.floor(m / 60)}½ h` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`;

/**
 * La minute du rendu affiché, comme le relevé : « minute 12 » se dit pareil dans les deux langues.
 * Le mouvement l'importe seule, pour laisser la règle et ses consignes hors de son morceau.
 */
export const minuteReading = (t: number) => `minute ${Math.floor(t)}`;

/** La règle de la fiche : la session minute par minute, graduée toutes les 5 minutes, légendée toutes les 30. */
export const timeline: Timeline = {
	last: LAST,
	rest: REST,
	events: EVENTS,
	tick: 5,
	marks: [0, 30, 60, 90, 120, 150].map((at) => ({ at, text: { fr: hourLabel(at, 'fr'), en: hourLabel(at, 'en') } })),
	reading: minuteReading,
	consignes: {
		pointer: {
			fr: 'Glissez la règle ou la figure pour faire avancer le temps ; les triangles marquent les événements',
			en: 'Drag the ruler or the figure to move time forward; the triangles mark the events',
		},
		touch: {
			fr: 'Glissez la règle ou la figure du doigt ; les triangles marquent les événements',
			en: 'Drag the ruler or the figure with your finger; the triangles mark the events',
		},
	},
};
