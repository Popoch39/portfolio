// Anatomie de trekker : un meuble à fiches surmonté d'un gabarit Zod. Chaque tiroir est une page de
// `GET /api/v1/treks`, et la fiche de demande passe d'abord au gabarit du contrat partagé.
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { pieces, readout, SHA } from './model.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'trekker',
		sha: SHA,
		machine: 'Meuble à fiches et gabarit Zod',
		lede: {
			before: 'Une API de randonnées où chaque requête passe d’abord au ',
			emphasis: 'gabarit',
			after: ' du contrat partagé.',
		},
		title: 'Meuble à fiches et gabarit Zod',
		hints: {
			pointer: 'Tirez une poignée pour demander sa page',
			touch: 'Faites glisser un tiroir vers vous pour demander sa page',
		},
		readout,
		caption:
			'Chaque tiroir est une page de 20 itinéraires sur les 100 de la fixture livrée. La fiche de demande passe d’abord au gabarit, trekListQuerySchema, le contrat Zod que partagent l’API, le web et le mobile : une proximité incomplète ou une page de plus de 100 fiches finit au bac de rejet, en 422. Les fiches tiennent sur la tige dans l’ordre name, id, que suit l’index treks_name_id_idx (0,9 ms au lieu de 130 sur 2 442 treks), et sortent sans leur tracé.',
		label:
			'Meuble à fiches en bois à six tiroirs, vu de trois quarts depuis le bas. Sur le dessus, une fiche de demande traverse un gabarit à broches avant d’entrer dans une fente à serrure ; un tiroir sort sur ses glissières, ses vingt fiches se soulèvent et laissent leur tracé au fond, pendant qu’un totalisateur sur le flanc affiche 100 fiches en 5 pages.',
		pieces,
		seo: {
			title: 'trekker — anatomie d’une API de randonnées NestJS, Zod et Drizzle',
			description:
				'Un meuble à fiches explique trekker : chaque requête passe au gabarit Zod partagé, puis NestJS et Drizzle sortent de Postgres 20 itinéraires par page.',
		},
	},
	renderRest,
};
