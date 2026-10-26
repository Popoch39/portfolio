// Modèle de la colonne de sondage : les vrais chiffres de ma_parcelle (commit `SHA`), rejoués sur
// la parcelle de référence de ses tests, 33063 KJ 33. Chaque strate est un bloc de la fiche, aussi
// épaisse que le nombre de requêtes que son bloc envoie ; le relevé, le log, la carotte et
// l'avance du carottier en découlent. Pur : il tourne au build, sous Node et dans le navigateur.
import type { Locale, Localized } from '../../lib/i18n.ts';

/** Commit lu du dépôt `ma_parcelle` : tous les liens et tous les chiffres y sont figés. */
export const SHA = '8d83a60bcf40c7d61355296887bcbdec026b8d4d';

export const PARCEL = '33063 KJ 33';

/** Crans des curseurs du log, dans l'ordre de `src/lib/summary/summary.ts` (L4–7). */
export const LEVELS = ['info', 'vigilance', 'alerte'] as const;
export type Level = (typeof LEVELS)[number];

export interface Stratum {
	id: string;
	name: Localized<string>;
	/** Requêtes HTTP envoyées par le bloc pour KJ 33 : l'épaisseur de la strate. */
	requests: number;
	/** Ce que la strate livre au relevé, nombres au format de chaque langue. */
	value: Localized<string>;
	/** Ligne du log : le niveau que la synthèse en retient, ou rien (ligne vierge). */
	level: Level | null;
}

/** Les six blocs dans l'ordre de `BLOCKS` (`src/components/report/blocks.ts` L18–25). */
export const STRATA: readonly Stratum[] = [
	{ id: 'cadastre', name: { fr: 'Cadastre', en: 'Cadastre' }, requests: 1, value: { fr: '131 m²', en: '131 m²' }, level: 'info' },
	{ id: 'urbanisme', name: { fr: 'Urbanisme', en: 'Planning' }, requests: 8, value: { fr: 'aucune zone publiée', en: 'no zone published' }, level: 'vigilance' },
	{ id: 'risques', name: { fr: 'Risques', en: 'Hazards' }, requests: 11, value: { fr: 'vigilance au plus', en: 'caution at most' }, level: null },
	{ id: 'ventes', name: { fr: 'Ventes', en: 'Sales' }, requests: 5, value: { fr: '4 125 €/m² (7)', en: '€4,125/m² (7)' }, level: 'info' },
	{ id: 'batiment', name: { fr: 'Bâtiment', en: 'Building' }, requests: 3, value: { fr: '1850 · alt. 7,47 m', en: '1850 · alt. 7.47 m' }, level: 'info' },
	{ id: 'dpe', name: { fr: 'DPE', en: 'DPE' }, requests: 4, value: { fr: '377 annoncés', en: '377 listed' }, level: null },
];

/** La strate que perd un tour sur deux : la BDNB répond 500 (`summary.test.ts` L254–264). */
export const LOST = 4;

export const TOTAL_REQUESTS = STRATA.reduce((sum, stratum) => sum + stratum.requests, 0);

// Dimensions du monde, en unités du kit (z vers le haut, axe de la colonne en x = y = 0).

/** Épaisseur de sol par requête. */
export const UNIT = 6;
/** Dessus de la bride de fond : le fond du forage. */
export const SOIL_BOTTOM = 12;
export const SOIL_TOP = SOIL_BOTTOM + TOTAL_REQUESTS * UNIT;

/** Haut et bas de chaque strate, de la croûte au DPE. */
export const BOUNDS: readonly (readonly [top: number, bottom: number])[] = STRATA.map((_, index) => {
	const above = STRATA.slice(0, index).reduce((sum, stratum) => sum + stratum.requests, 0);
	const top = SOIL_TOP - above * UNIT;
	return [top, top - STRATA[index].requests * UNIT] as const;
});

/** Bas de la couronne au repos, au-dessus du tubage. */
export const BIT_REST = 228;
/** Course du carottier, du repos au fond du forage. */
export const DEPTH = BIT_REST - SOIL_BOTTOM;

export const bitAt = (depth: number) => BIT_REST - depth;
export const depthAt = (z: number) => BIT_REST - z;

/** La profondeur où la couronne a traversé toute la strate `index`. */
export const depthThrough = (index: number) => depthAt(BOUNDS[index][1]);

/**
 * La strate où se trouve la couronne : -1 au-dessus de la croûte. Une interface appartient à la
 * strate du dessus, que la couronne vient de traverser.
 */
export function stratumAt(depth: number) {
	const z = bitAt(depth);
	if (z >= SOIL_TOP) return -1;
	const index = BOUNDS.findIndex(([, bottom]) => z >= bottom);
	return index < 0 ? STRATA.length - 1 : index;
}

/** Nombre de strates entièrement traversées. */
export const strataThrough = (depth: number) => STRATA.filter((_, index) => depth >= depthThrough(index) - 1e-6).length;

/** Requêtes déjà carottées : la longueur de carotte, en requêtes (continue). */
export function coredRequests(depth: number) {
	const z = Math.max(bitAt(depth), SOIL_BOTTOM);
	return Math.min(Math.max((SOIL_TOP - z) / UNIT, 0), TOTAL_REQUESTS);
}

// Avance : une vis d'avance pousse le carottier à vitesse constante, après une rampe courte, et
// l'arrêt est net (pas de suivi amorti).

/** Vitesse du palier, en unités par seconde. */
export const FEED = 32;
/** Durée de la rampe de départ. */
export const RAMP = 0.16;
/** Remontée du tour, plus lente que la descente. */
export const RISE = 26;
/** Relance depuis le cache (12 h, `src/queries/query-client.ts` L4–18) : quatre fois plus vite. */
export const CACHED = 4;
/** Pas de la vis d'avance (vis à quatre filets de 6) : la manivelle fait un tour par pas. */
export const LEAD = 24;
export const THREAD = LEAD / 4;
/** Rotation des tiges pendant le forage, en tours par seconde. */
export const SPIN = 1.1;
/** Remontée du tube intérieur par le treuil, au fond. */
export const HOIST = 5;
export const HOIST_TIME = 1.3;

/** Un pas d'avance : la vitesse monte sur `RAMP`, puis reste au palier ; la position ne dépasse jamais la cible. */
export function feed(depth: number, speed: number, target: number, dt: number, top = FEED) {
	const next = Math.min(top, speed + (top / RAMP) * dt);
	const step = next * dt;
	const remaining = target - depth;
	if (Math.abs(remaining) <= step) return { depth: target, speed: 0, arrived: true };
	return { depth: depth + Math.sign(remaining) * step, speed: next, arrived: false };
}

// Relevé.

export interface Sounding {
	depth: number;
	/** Profondeur la plus basse atteinte par ce sondage : ce qui est carotté le reste en remontant. */
	reached: number;
	/** La parcelle a été choisie : le sondage est en cours ou fini. */
	selected: boolean;
	/** Ce sondage perd la strate Bâtiment. */
	lost: boolean;
	/** Relancé depuis le cache : aucune requête. */
	cached: boolean;
	/** Arrivé au fond, la carotte remonte ou est remontée. */
	done: boolean;
}

/** Les mots du relevé ; la parcelle, les nombres et « req. » sont les mêmes dans les deux langues. */
const WORDS: Localized<{ ready: string; cached: string; lost: string; servers: string }> = {
	fr: { ready: 'prêt', cached: 'en cache', lost: 'strate perdue', servers: '0 serveur' },
	en: { ready: 'ready', cached: 'cached', lost: 'stratum lost', servers: '0 servers' },
};

export const REST_RELEVE: Localized<string> = { fr: `${PARCEL} · ${WORDS.fr.ready} · 0/6`, en: `${PARCEL} · ${WORDS.en.ready} · 0/6` };

export function releveOf({ depth, selected, lost, cached, done }: Sounding, locale: Locale) {
	const words = WORDS[locale];
	if (cached && selected) return `${PARCEL} · ${words.cached} · 0 req.`;
	if (done) return `6/6 · ${lost ? `1 ${words.lost}` :`${TOTAL_REQUESTS} req.`} · ${words.servers}`;
	const index = stratumAt(depth);
	if (index < 0 || !selected) return REST_RELEVE[locale];
	const stratum = STRATA[index];
	const head = `${index + 1}/6 ${stratum.name[locale]}`;
	if (lost && index === LOST) return `${head} · BDNB 500 · ${words.lost}`;
	return `${head} · ${stratum.requests} req. · ${stratum.value[locale]}`;
}

/** Le cran de chaque ligne du log : 0 vierge, 1 à 3 pour info, vigilance, alerte. */
export function logOf({ reached, selected, lost, cached }: Sounding) {
	return STRATA.map((stratum, index) => {
		const read = selected && (cached || reached >= depthThrough(index) - 1e-6);
		if (!read || !stratum.level || (lost && index === LOST)) return 0;
		return LEVELS.indexOf(stratum.level) + 1;
	});
}

/** Le témoin « en cours » : allumé dès la croûte percée, tant qu'une strate reste à lire. */
export const pendingOf = ({ reached, selected, cached, done }: Sounding) =>
	selected && !cached && !done && reached >= depthThrough(0) - 1e-6 && reached < DEPTH - 1e-6;

/** Longueur de carotte remontée, en requêtes : ce que la couronne a déjà traversé. */
export const coreOf = ({ reached, selected }: Sounding) => (selected ? coredRequests(reached) : 0);
