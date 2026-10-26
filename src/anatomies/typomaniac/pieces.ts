// Nomenclature du banc de duel : sept pièces, liées au code de typomaniac au commit lu. Les
// claviers A et B portent le même identifiant : c'est le même code, monté deux fois.
import type { Piece } from '../contract.ts';

/** Commit lu de Popoch39/typomaniac (branche `main`) : tous les liens y sont figés. */
export const SHA = '183f5a8de9fce3f371ad9dc2b315071218bfbbeb';

export const pieces: Piece[] = [
	{
		id: 'socle',
		name: 'Socle',
		role: 'Bun + Elysia : un seul process porte la file, les duels en mémoire et toutes les routes de l’API.',
		code: { path: 'apps/api/src/app.ts', lines: [97, 182] },
	},
	{
		id: 'claviers',
		name: 'Claviers A et B',
		role: 'Clients React 19 : la frappe est datée, appliquée tout de suite à l’écran, puis mise en lot.',
		code: { path: 'apps/frontend/src/stores/duel-store.ts', lines: [792, 823] },
	},
	{
		id: 'cables',
		name: 'Câbles',
		role: 'La WebSocket /api/duel, une par onglet : lots de frappes à l’aller, frappes de l’adversaire et resync au retour.',
		code: { path: 'apps/api/src/modules/duel/index.ts', lines: [17, 52] },
	},
	{
		id: 'tour',
		name: 'Tour d’arbitrage',
		role: 'Le duel en cours, en mémoire : reçoit chaque lot, coupe au forfait une cadence inhumaine, juge la manche à 30,4 s et ouvre la suivante 7 s plus tard.',
		code: { path: 'apps/api/src/modules/duel/running-duel.ts', lines: [423, 522] },
		master: true,
	},
	{
		id: 'guichet',
		name: 'Guichet',
		role: 'Les quatre contrôles de date d’une frappe : avant le départ, après son arrivée, hors d’ordre, après la fin.',
		code: { path: 'packages/typing-engine/src/acceptance.ts', lines: [21, 68] },
	},
	{
		id: 'lampes',
		name: 'Lampes de manche',
		role: 'Le meilleur score gagne la manche, puis la précision ; deux manches gagnées ou trois jouées décident le duel.',
		code: { path: 'packages/typing-engine/src/outcome.ts', lines: [21, 67] },
	},
	{
		id: 'mat',
		name: 'Mât',
		role: 'Les TP du duel, bornés entre 8 et 35 ; montée à 100 TP avec bouclier, descente à 75 TP ; le MMR reste caché.',
		code: { path: 'packages/ranked/src/ranked.ts', lines: [164, 206] },
	},
];
