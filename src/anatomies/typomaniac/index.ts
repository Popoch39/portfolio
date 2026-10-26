// Anatomie de typomaniac : un banc de duel. Deux claviers datent chaque frappe, deux câbles les
// portent à une tour d'arbitrage qui les filtre au guichet, juge les manches et fait bouger le mât.
import type { Anatomy, RestFigure } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { releveOf, restDuel } from './model.ts';
import { pieces, SHA } from './pieces.ts';
import { TEXTS } from './texts.ts';

// Le réglage de l'ordre de peinture coûte quelques secondes : la fiche, l'accueil et le SVG
// autonome partagent un seul calcul, dans les deux langues (la figure ne dessine que les textes de
// la machine, les mots anglais tapés sur le banc).
let rest: RestFigure | null = null;

export const anatomy: Anatomy = {
	content: {
		slug: 'typomaniac',
		sha: SHA,
		machine: { fr: 'Banc de duel', en: 'Duel bench' },
		lede: {
			before: {
				fr: 'Deux claviers face à une tour : chaque lettre est datée chez le joueur, mais c’est le serveur qui ',
				en: 'Two keyboards facing a tower: every letter is timestamped on the player’s side, but it’s the server that ',
			},
			emphasis: { fr: 'tranche', en: 'decides' },
			after: { fr: '.', en: '.' },
		},
		title: { fr: 'Banc de duel à tour d’arbitrage', en: 'Duel bench with a referee tower' },
		consignes: {
			pointer: {
				fr: 'Cliquez le clavier A ou tapez une lettre : elle file vers la tour.',
				en: 'Click keyboard A or type a letter: it races to the tower.',
			},
			touch: {
				fr: 'Touchez le clavier A : chaque appui envoie une lettre à la tour.',
				en: 'Tap keyboard A: each press sends a letter to the tower.',
			},
		},
		releve: { fr: releveOf(restDuel(TEXTS, 'fr')), en: releveOf(restDuel(TEXTS, 'en')) },
		caption: {
			fr: 'Chaque frappe part datée du clavier, par lots de 50 ms. La tour la refuse si sa date précède le départ, suit son arrivée, recule, ou dépasse les 30 s de la manche (400 ms de tolérance). Elle juge la manche au score puis à la précision, et le premier à deux manches gagnées fait bouger les TP ; le MMR, lui, reste caché.',
			en: 'Each keystroke leaves its keyboard timestamped, in 50 ms batches. The tower rejects it if its timestamp comes before the start or after its arrival, goes backwards, or runs past the round’s 30 s (with 400 ms of tolerance). It judges each round on score, then on accuracy, and the first to win two rounds moves the TP; the MMR stays hidden.',
		},
		label: {
			fr: 'Banc de duel en vue isométrique : deux claviers aux extrémités d’un long banc, reliés par deux câbles à une tour d’arbitrage centrale. Par la porte ouverte de la tour, un guichet à quatre bras de barrière contrôle la date de chaque frappe et renvoie à l’expéditeur celle qu’il refuse. Sur ses côtés, deux paires de lampes comptent les manches gagnées, et un mât porte le rang de chaque joueur.',
			en: 'Duel bench in isometric view: two keyboards at either end of a long bench, linked by two cables to a central referee tower. Through the tower’s open door, a checkpoint with four barrier arms checks the timestamp of every keystroke and sends any it rejects back to its sender. On either side, two pairs of lamps count the rounds won, and a mast carries each player’s rank.',
		},
		pieces,
		seo: {
			title: {
				fr: 'typomaniac — banc de duel, serveur autoritaire en WebSocket · Louis Pocheron',
				en: 'typomaniac — duel bench, authoritative WebSocket server · Louis Pocheron',
			},
			description: {
				fr: 'Anatomie de typomaniac, jeu de dactylo en duel : clients React 19, WebSocket et serveur Bun + Elysia qui date, filtre et juge chaque frappe, en Bo3 classé.',
				en: 'Anatomy of typomaniac, a head-to-head typing game: React 19 clients, WebSocket and a Bun + Elysia server that timestamps, filters and judges every keystroke, in ranked best-of-three.',
			},
		},
	},
	renderRest: () => (rest ??= renderRest()),
};
