// Modèle du meuble à fiches : les vrais chiffres de trekker au commit lu, et le contrôle de la
// fiche de demande par le gabarit. Le relevé, la course des tiroirs et les encoches de la fiche
// en découlent ; il tourne au build, sous Node (audit) et dans le navigateur (mouvement).
import { localize, type Locale, type Localized } from '../../lib/i18n.ts';
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
	| { ok: false; rule: Localized<string>; /** La broche qui bute. */ stuck: Field };

/** Une règle écrite en code, que les deux langues lisent telle quelle. */
const verbatim = (rule: string): Localized<string> => ({ fr: rule, en: rule });

/** Le gabarit : les bornes et les trois `refine` de `trekListQuerySchema` (`treks.ts` L126-185). */
export function check({ params }: Request): Verdict {
	const page = params.page ?? 1;
	const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
	if (pageSize > MAX_PAGE_SIZE) return { ok: false, rule: verbatim(`pageSize ≤ ${MAX_PAGE_SIZE}`), stuck: 'pageSize' };
	const present = PROXIMITY.filter((field) => params[field] !== undefined);
	if (params.bbox !== undefined && present.length) return { ok: false, rule: { fr: 'bbox ou proximité', en: 'bbox or proximity' }, stuck: 'bbox' };
	if (present.length && present.length < PROXIMITY.length) {
		return { ok: false, rule: { fr: 'lat, lon et radiusKm ensemble', en: 'lat, lon and radiusKm together' }, stuck: present[0] };
	}
	const { minDistanceMeters: min, maxDistanceMeters: max } = params;
	if (min !== undefined && max !== undefined && min > max) return { ok: false, rule: verbatim('min ≤ max'), stuck: 'minDistanceMeters' };
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

/** Les fiches d'une page : le français met le singulier jusqu'à 1, l'anglais seulement à 1 (« 0 cards »). */
const cards: Localized<(count: number) => string> = {
	fr: (count) => `${count} fiche${count > 1 ? 's' : ''}`,
	en: (count) => `${count} card${count === 1 ? '' : 's'}`,
};

/** Le relevé d'une requête dans une langue : page servie (200) ou fiche refusée (422). */
export function releveOf(request: Request, locale: Locale) {
	const verdict = check(request);
	if (!verdict.ok) return `GET ?${request.query} → 422 · ${verdict.rule[locale]}`;
	const pages = pagesOf(TOTAL, verdict.pageSize);
	return `GET ?${request.query} → 200 · ${cards[locale](rowsOf(verdict.page, verdict.pageSize))} · p. ${verdict.page}/${pages} · total ${TOTAL}`;
}

/** Au repos : le tiroir 1 sorti, sa page servie. */
export const REST_PAGE = 1;
export const releve = localize((locale) => releveOf(pageRequest(REST_PAGE), locale));

export const pieces: Piece[] = [
	{
		id: 'fente',
		name: { fr: 'Fente à serrure', en: 'Lock slot' },
		role: { fr: 'Reçoit la fiche de demande ; la serrure exige une session.', en: 'Takes in the request card; the lock demands a session.' },
		code: { path: 'apps/api/src/modules/treks/treks.controller.ts', lines: [8, 24] },
		note: {
			title: 'Recevoir la demande',
			text: 'Reçoit la demande de liste ; sans session ouverte, l’API répond 401.',
			tech: ['nestjs'],
			clue:'GET /api/v1/treks',
			symbol: 'TreksController',
		},
	},
	{
		id: 'gabarit',
		name: { fr: 'Gabarit à broches', en: 'Pin gauge' },
		role: {
			fr: 'Vérifie chaque champ de la fiche de demande et ses verrous avant de la laisser passer.',
			en: 'Checks every field of the request card, and its interlocks, before letting it through.',
		},
		code: { path: 'packages/contracts/src/treks.ts', lines: [126, 185] },
		note: {
			title: 'Vérifier chaque paramètre',
			text: 'Un seul contrat pour l’API, le web et le mobile : filtres, position, 100 par page.',
			tech: ['zod', 'typescript'],
			clue:'pageSize ≤ 100',
			symbol: 'trekListQuerySchema',
		},
		master: true,
	},
	{
		id: 'bac-rejet',
		name: { fr: 'Bac de rejet', en: 'Reject tray' },
		role: { fr: 'Recueille la fiche refusée, avec le détail des champs fautifs.', en: 'Catches the refused card, with the details of the faulty fields.' },
		code: { path: 'apps/api/src/common/filters/problem-details.filter.ts', lines: [52, 61] },
		note: {
			title: 'Refuser une demande fausse',
			text: 'Répond 422 avec la liste des champs fautifs, au format standard RFC 9457.',
			tech: ['nestjs', 'zod'],
			clue:'422',
			symbol: 'ZodValidationException',
		},
	},
	{
		id: 'tige',
		name: { fr: 'Tige et presse-fiches', en: 'Rod and follower' },
		role: {
			fr: 'Tient les fiches dans l’ordre name, id ; le presse-fiches en isole vingt, après celles des tiroirs précédents.',
			en: 'Holds the cards in name, id order; the follower sets twenty apart, after those of the earlier drawers.',
		},
		code: { path: 'apps/api/src/modules/treks/treks.service.ts', lines: [127, 151] },
		note: {
			title: 'Découper une page',
			text: 'Trie par nom puis id, saute les pages précédentes et garde 20 itinéraires.',
			tech: ['drizzle'],
			clue:'limit / offset',
			symbol: 'toLimitOffset()',
		},
	},
	{
		id: 'totalisateur',
		name: { fr: 'Totalisateur', en: 'Totaliser' },
		role: {
			fr: 'Compte toutes les fiches qui répondent, pendant que le tiroir sort, et en déduit le nombre de pages.',
			en: 'Counts every matching card while the drawer slides out, and works out the number of pages.',
		},
		code: { path: 'apps/api/src/modules/treks/treks.service.ts', lines: [152, 160] },
		note: {
			title: 'Compter les résultats',
			text: 'Compte tous les résultats en même temps : 100 itinéraires donnent 5 pages.',
			tech: ['drizzle', 'postgresql'],
			clue:'Promise.all',
			symbol: '$count()',
		},
	},
	{
		id: 'fiche-resume',
		name: { fr: 'Fiche résumé', en: 'Summary card' },
		role: { fr: 'Ce qui sort du tiroir : la fiche sans son tracé, qui reste au fond.', en: 'What comes out of the drawer: the card without its track, which stays at the bottom.' },
		code: { path: 'packages/contracts/src/treks.ts', lines: [49, 74] },
		note: {
			title: 'Alléger chaque résultat',
			text: 'Sert nom, distance et dénivelé sans la trace GPS, trop lourde pour une liste.',
			tech: ['zod'],
			clue:'toSummary()',
			symbol: 'trekSummarySchema',
		},
	},
	{
		id: 'glissieres',
		name: { fr: 'Glissières à billes', en: 'Ball-bearing runners' },
		role: { fr: 'Font sortir le tiroir sans qu’on trie le meuble.', en: 'Bring the drawer out without sorting the whole cabinet.' },
		code: { path: 'packages/db/src/schema/treks.ts', lines: [142, 148] },
		note: {
			title: 'Accélérer le tri',
			text: 'Un index sur nom puis id : 0,9 ms au lieu de 130 ms par page, sur 2 442 itinéraires.',
			tech: ['drizzle', 'postgresql'],
			clue:'index(name, id)',
			symbol: 'treks_name_id_idx',
		},
	},
	{
		id: 'corps',
		name: { fr: 'Corps à tiroirs', en: 'Cabinet body' },
		role: { fr: 'Le meuble lui-même : chaque fiche y est rangée une fois.', en: 'The cabinet itself: each card is filed in it once.' },
		code: { path: 'packages/db/src/schema/treks.ts', lines: [57, 91] },
		note: {
			title: 'Stocker les itinéraires',
			text: 'Une table Postgres : une ligne par itinéraire, avec sa trace et son départ.',
			tech: ['drizzle', 'postgresql'],
			clue:'pgTable(\'treks\')',
			symbol: 'treks',
		},
	},
];

export const pieceOf = (id: string) => {
	const piece = pieces.find((candidate) => candidate.id === id);
	if (!piece) throw new Error(`trekker : pièce inconnue « ${id} »`);
	return piece;
};
