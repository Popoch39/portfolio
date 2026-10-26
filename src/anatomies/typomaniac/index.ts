// Anatomie de typomaniac : un banc de duel. Deux claviers datent chaque frappe, deux câbles les
// portent à une tour d'arbitrage qui les filtre au guichet, juge les manches et fait bouger le mât.
import type { Anatomy, RestFigure } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { releveOf, restDuel } from './model.ts';
import { pieces, SHA } from './pieces.ts';
import { TEXTS } from './texts.ts';

// Le réglage de l'ordre de peinture coûte quelques secondes : la fiche, l'accueil et le SVG
// autonome partagent un seul calcul.
let rest: RestFigure | null = null;

export const anatomy: Anatomy = {
	content: {
		slug: 'typomaniac',
		sha: SHA,
		machine: 'Banc de duel',
		lede: {
			before: 'Deux claviers face à une tour : chaque lettre est datée chez le joueur, mais c’est le serveur qui ',
			emphasis: 'tranche',
			after: '.',
		},
		title: 'Banc de duel à tour d’arbitrage',
		consignes: {
			pointer: 'Cliquez le clavier A ou tapez une lettre : elle file vers la tour.',
			touch: 'Touchez le clavier A : chaque appui envoie une lettre à la tour.',
		},
		releve: releveOf(restDuel(TEXTS)),
		caption:
			'Chaque frappe part datée du clavier, par lots de 50 ms. La tour la refuse si sa date précède le départ, suit son arrivée, recule, ou dépasse les 30 s de la manche (400 ms de tolérance). Elle juge la manche au score puis à la précision, et le premier à deux manches gagnées fait bouger les TP ; le MMR, lui, reste caché.',
		label:
			'Banc de duel en vue isométrique : deux claviers aux extrémités d’un long banc, reliés par deux câbles à une tour d’arbitrage centrale. Par la porte ouverte de la tour, un guichet à quatre bras de barrière contrôle la date de chaque frappe et renvoie à l’expéditeur celle qu’il refuse. Sur ses côtés, deux paires de lampes comptent les manches gagnées, et un mât porte le rang de chaque joueur.',
		pieces,
		seo: {
			title: 'typomaniac — banc de duel, serveur autoritaire en WebSocket · Louis Pocheron',
			description:
				'Anatomie de typomaniac, jeu de dactylo en duel : clients React 19, WebSocket et serveur Bun + Elysia qui date, filtre et juge chaque frappe, en Bo3 classé.',
		},
	},
	renderRest: () => (rest ??= renderRest()),
};
