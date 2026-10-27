// Nomenclature du banc de duel : sept pièces, liées au code de typomaniac au commit lu. Les
// claviers A et B portent le même identifiant : c'est le même code, monté deux fois.
import type { Piece } from '../contract.ts';

/** Commit lu de Popoch39/typomaniac (branche `main`) : tous les liens y sont figés. */
export const SHA = '183f5a8de9fce3f371ad9dc2b315071218bfbbeb';

export const pieces: Piece[] = [
	{
		id: 'socle',
		name: { fr: 'Socle', en: 'Base' },
		role: {
			fr: 'Bun + Elysia : un seul process porte la file, les duels en mémoire et toutes les routes de l’API.',
			en: 'Bun + Elysia: a single process holds the queue, the in-memory duels and every API route.',
		},
		code: { path: 'apps/api/src/app.ts', lines: [97, 182] },
		note: {
			title: 'Servir tout le jeu',
			text: 'Un seul serveur Bun garde la file d’attente, les duels en mémoire et toute l’API.',
			tech: ['bun', 'typescript'],
			clue:'Elysia',
			symbol: 'DuelQueue',
		},
	},
	{
		id: 'claviers',
		name: { fr: 'Claviers A et B', en: 'Keyboards A and B' },
		role: {
			fr: 'Clients React 19 : la frappe est datée, appliquée tout de suite à l’écran, puis mise en lot.',
			en: 'React 19 clients: each keystroke is timestamped, shown on screen straight away, then batched.',
		},
		code: { path: 'apps/frontend/src/stores/duel-store.ts', lines: [792, 823] },
		note: {
			title: 'Dater chaque frappe',
			text: 'Chaque lettre est datée, affichée aussitôt, puis envoyée par lots de 50 ms.',
			tech: ['react', 'typescript'],
			clue:'BATCH_MS',
			symbol: 'pressed()',
		},
	},
	{
		id: 'cables',
		name: { fr: 'Câbles', en: 'Cables' },
		role: {
			fr: 'La WebSocket /api/duel, une par onglet : lots de frappes à l’aller, frappes de l’adversaire et resync au retour.',
			en: 'The /api/duel WebSocket, one per tab: keystroke batches on the way out, the opponent’s keystrokes and resyncs on the way back.',
		},
		code: { path: 'apps/api/src/modules/duel/index.ts', lines: [17, 52] },
		note: {
			title: 'Relier les deux joueurs',
			text: 'Une WebSocket par onglet : on envoie ses frappes, on reçoit celles de l’adversaire.',
			tech: ['bun'],
			clue:'/api/duel',
			symbol: 'duelModule()',
		},
	},
	{
		id: 'tour',
		name: { fr: 'Tour d’arbitrage', en: 'Referee tower' },
		role: {
			fr: 'Le duel en cours, en mémoire : reçoit chaque lot, coupe au forfait une cadence inhumaine, juge la manche à 30,4 s et ouvre la suivante 7 s plus tard.',
			en: 'The live duel, in memory: takes in every batch, forfeits an inhuman typing rate, judges the round at 30.4 s and opens the next one 7 s later.',
		},
		code: { path: 'apps/api/src/modules/duel/running-duel.ts', lines: [423, 522] },
		note: {
			title: 'Arbitrer le duel',
			text: 'Le serveur garde le duel en mémoire, juge la manche à 30,4 s et relance 7 s après.',
			tech: ['bun', 'typescript'],
			clue:'RunningDuel',
			symbol: 'endRound()',
		},
		master: true,
	},
	{
		id: 'guichet',
		name: { fr: 'Guichet', en: 'Checkpoint' },
		role: {
			fr: 'Les quatre contrôles de date d’une frappe : avant le départ, après son arrivée, hors d’ordre, après la fin.',
			en: 'The four timestamp checks on a keystroke: before the start, after its arrival, out of order, after the end.',
		},
		code: { path: 'packages/typing-engine/src/acceptance.ts', lines: [21, 68] },
		note: {
			title: 'Vérifier la date des frappes',
			text: 'Refuse une frappe datée avant le départ, après sa réception, à rebours ou trop tard.',
			tech: ['typescript'],
			clue:'acceptance.ts',
			symbol: 'rejectReason()',
		},
	},
	{
		id: 'lampes',
		name: { fr: 'Lampes de manche', en: 'Round lamps' },
		role: {
			fr: 'Le meilleur score gagne la manche, puis la précision ; deux manches gagnées ou trois jouées décident le duel.',
			en: 'The higher score wins the round, then accuracy; two rounds won or three played decide the duel.',
		},
		code: { path: 'packages/typing-engine/src/outcome.ts', lines: [21, 67] },
		note: {
			title: 'Désigner le gagnant',
			text: 'Le meilleur score gagne la manche, puis la précision ; deux manches gagnent le duel.',
			tech: ['typescript'],
			clue:'isDuelDecided()',
			symbol: 'roundOutcome()',
		},
	},
	{
		id: 'mat',
		name: { fr: 'Mât', en: 'Mast' },
		role: {
			fr: 'Les TP du duel, bornés entre 8 et 35 ; montée à 100 TP avec bouclier, descente à 75 TP ; le MMR reste caché.',
			en: 'The duel’s TP, kept between 8 and 35; promotion at 100 TP with a shield, demotion to 75 TP; the MMR stays hidden.',
		},
		code: { path: 'packages/ranked/src/ranked.ts', lines: [164, 206] },
		note: {
			title: 'Faire monter au classement',
			text: 'Une victoire vaut 8 à 35 points de rang, 20 à niveau égal ; 100 points font monter.',
			tech: ['typescript'],
			clue:'applyTp()',
			symbol: 'tpDelta()',
		},
	},
];
