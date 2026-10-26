// Modèle du meuble à fiches : les vrais chiffres de trekker au commit lu, et le contrôle de la
// fiche de demande par le gabarit. Le relevé, la course des tiroirs et les encoches de la fiche
// en découlent ; il tourne au build, sous Node (audit) et dans le navigateur (mouvement).
import type { Piece } from '../contract.ts';

/** Commit lu de Popoch39/trekker : tous les liens vers le code y sont figés. */
export const SHA = '0ae7878ca0a422b80644053a50831812fdaf917d';

/** `DEFAULT_PAGE_SIZE` et `MAX_PAGE_SIZE` (`packages/contracts/src/pagination.ts` L3-4). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** Les itinéraires de la fixture insérée par `pnpm seed` sans argument (`apps/api/src/data/README.md`). */
export const TOTAL = 100;
/** Six tiroirs, lus comme un texte : le tiroir n est la page n de la liste par défaut. */
export const DRAWERS = 6;

/** `buildPaginationMeta` : `Math.ceil(total / pageSize)`. */
export const pagesOf = (total: number, pageSize = DEFAULT_PAGE_SIZE) => Math.ceil(total / pageSize);
/** `toLimitOffset` : les fiches sautées avant la page. */
export const offsetOf = (page: number, pageSize = DEFAULT_PAGE_SIZE) => (page - 1) * pageSize;
/** Les lignes que Postgres rend pour la page : `limit` au plus, rien au-delà du total. */
export const rowsOf = (page: number, pageSize = DEFAULT_PAGE_SIZE, total = TOTAL) =>
	Math.max(0, Math.min(pageSize, total - offsetOf(page, pageSize)));

/**
 * Les trous de la fiche de demande, dans l'ordre des broches du gabarit (`trekListQuerySchema`) :
 * une encoche par paramètre présent dans la requête.
 */
export const FIELDS = [
	'page',
	'pageSize',
	'facile',
	'moyen',
	'difficile',
	'tres_difficile',
	'minDistanceMeters',
	'maxDistanceMeters',
	'lat',
	'lon',
	'radiusKm',
	'bbox',
] as const;
export type Field = (typeof FIELDS)[number];

/** Les trois broches que la barre du verrou triple lie : toutes présentes, ou aucune. */
export const PROXIMITY: readonly Field[] = ['lat', 'lon', 'radiusKm'];

export interface Request {
	/** La chaîne de requête, sans le `?`. */
	query: string;
	/** Les paramètres présents, avec leur valeur lue (`z.coerce`). */
	params: Partial<Record<Field, number>>;
}

export type Verdict =
	| { ok: true; page: number; pageSize: number }
	| { ok: false; rule: string; /** La broche qui bute. */ stuck: Field };

/** Le gabarit : les bornes et les trois `refine` de `trekListQuerySchema` (`treks.ts` L126-185). */
export function check({ params }: Request): Verdict {
	const page = params.page ?? 1;
	const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
	if (pageSize > MAX_PAGE_SIZE) return { ok: false, rule: `pageSize ≤ ${MAX_PAGE_SIZE}`, stuck: 'pageSize' };
	const present = PROXIMITY.filter((field) => params[field] !== undefined);
	if (params.bbox !== undefined && present.length) return { ok: false, rule: 'bbox ou proximité', stuck: 'bbox' };
	if (present.length && present.length < PROXIMITY.length) {
		return { ok: false, rule: 'lat, lon et radiusKm ensemble', stuck: present[0] };
	}
	const { minDistanceMeters: min, maxDistanceMeters: max } = params;
	if (min !== undefined && max !== undefined && min > max) return { ok: false, rule: 'min ≤ max', stuck: 'minDistanceMeters' };
	return { ok: true, page, pageSize };
}

/** La fiche que tire le tiroir n : `GET ?page=n`. */
export const pageRequest = (page: number): Request => ({ query: `page=${page}`, params: { page } });

/** Les fiches refusées du tour, deux vrais cas des tests d'intégration (`apps/api/test/treks.spec.ts`). */
export const REFUSED: readonly Request[] = [
	{ query: 'lat=44.93', params: { lat: 44.93 } },
	{ query: 'pageSize=500', params: { pageSize: 500 } },
];

export const notched = (request: Request, field: Field) => request.params[field] !== undefined;

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/** Le relevé d'une requête : page servie (200) ou fiche refusée (422). */
export function releveOf(request: Request) {
	const verdict = check(request);
	if (!verdict.ok) return `GET ?${request.query} → 422 · ${verdict.rule}`;
	const pages = pagesOf(TOTAL, verdict.pageSize);
	return `GET ?${request.query} → 200 · ${plural(rowsOf(verdict.page, verdict.pageSize), 'fiche')} · p. ${verdict.page}/${pages} · total ${TOTAL}`;
}

/** Au repos : le tiroir 1 sorti, sa page servie. */
export const REST_PAGE = 1;
export const releve = releveOf(pageRequest(REST_PAGE));

export const pieces: Piece[] = [
	{
		id: 'fente',
		name: 'Fente à serrure',
		role: 'Reçoit la fiche de demande ; la serrure exige une session.',
		code: { path: 'apps/api/src/modules/treks/treks.controller.ts', lines: [8, 24] },
	},
	{
		id: 'gabarit',
		name: 'Gabarit à broches',
		role: 'Vérifie chaque champ de la fiche de demande et ses verrous avant de la laisser passer.',
		code: { path: 'packages/contracts/src/treks.ts', lines: [126, 185] },
		master: true,
	},
	{
		id: 'bac-rejet',
		name: 'Bac de rejet',
		role: 'Recueille la fiche refusée, avec le détail des champs fautifs.',
		code: { path: 'apps/api/src/common/filters/problem-details.filter.ts', lines: [52, 61] },
	},
	{
		id: 'tige',
		name: 'Tige et presse-fiches',
		role: 'Tient les fiches dans l’ordre name, id ; le presse-fiches en isole vingt, après celles des tiroirs précédents.',
		code: { path: 'apps/api/src/modules/treks/treks.service.ts', lines: [127, 151] },
	},
	{
		id: 'totalisateur',
		name: 'Totalisateur',
		role: 'Compte toutes les fiches qui répondent, pendant que le tiroir sort, et en déduit le nombre de pages.',
		code: { path: 'apps/api/src/modules/treks/treks.service.ts', lines: [152, 160] },
	},
	{
		id: 'fiche-resume',
		name: 'Fiche résumé',
		role: 'Ce qui sort du tiroir : la fiche sans son tracé, qui reste au fond.',
		code: { path: 'packages/contracts/src/treks.ts', lines: [49, 74] },
	},
	{
		id: 'glissieres',
		name: 'Glissières à billes',
		role: 'Font sortir le tiroir sans qu’on trie le meuble.',
		code: { path: 'packages/db/src/schema/treks.ts', lines: [142, 148] },
	},
	{
		id: 'corps',
		name: 'Corps à tiroirs',
		role: 'Le meuble lui-même : chaque fiche y est rangée une fois.',
		code: { path: 'packages/db/src/schema/treks.ts', lines: [57, 91] },
	},
];

export const pieceOf = (id: string) => {
	const piece = pieces.find((candidate) => candidate.id === id);
	if (!piece) throw new Error(`trekker : pièce inconnue « ${id} »`);
	return piece;
};
