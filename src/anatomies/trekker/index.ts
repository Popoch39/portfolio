// Anatomie de trekker : un meuble à fiches surmonté d'un gabarit Zod. Chaque tiroir est une page de
// `GET /api/v1/treks`, et la fiche de demande passe d'abord au gabarit du contrat partagé.
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { pieces, releve, SHA } from './model.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'trekker',
		sha: SHA,
		machine: { fr: 'Meuble à fiches et gabarit Zod', en: 'Card cabinet and Zod gauge' },
		lede: {
			before: { fr: 'Une API de randonnées où chaque requête passe d’abord au ', en: 'A hiking API where every request first goes through the ' },
			emphasis: { fr: 'gabarit', en: 'gauge' },
			after: { fr: ' du contrat partagé.', en: ' of the shared contract.' },
		},
		title: { fr: 'Meuble à fiches et gabarit Zod', en: 'Card cabinet and Zod gauge' },
		consignes: {
			pointer: { fr: 'Tirez une poignée pour demander sa page', en: 'Pull a handle to request its page' },
			touch: { fr: 'Faites glisser un tiroir vers vous pour demander sa page', en: 'Drag a drawer towards you to request its page' },
		},
		releve,
		caption: {
			fr: 'Chaque tiroir est une page de 20 itinéraires sur les 100 de la fixture livrée. La fiche de demande passe d’abord au gabarit, trekListQuerySchema, le contrat Zod que partagent l’API, le web et le mobile : une proximité incomplète ou une page de plus de 100 fiches finit au bac de rejet, en 422. Les fiches tiennent sur la tige dans l’ordre name, id, que suit l’index treks_name_id_idx (0,9 ms au lieu de 130 sur 2 442 treks), et sortent sans leur tracé.',
			en: 'Each drawer is a page of 20 routes out of the 100 in the bundled fixture. The request card first goes through the gauge, trekListQuerySchema, the Zod contract that the API, the web app and the mobile app share: an incomplete proximity search or a page of more than 100 cards ends up in the reject tray, as a 422. The cards sit on the rod in name, id order, which the treks_name_id_idx index follows (0.9 ms instead of 130 across 2,442 treks), and come out without their track.',
		},
		label: {
			fr: 'Meuble à fiches en bois à six tiroirs, vu de trois quarts depuis le bas. Sur le dessus, une fiche de demande traverse un gabarit à broches avant d’entrer dans une fente à serrure ; un tiroir sort sur ses glissières, ses vingt fiches se soulèvent et laissent leur tracé au fond, pendant qu’un totalisateur sur le flanc affiche 100 fiches en 5 pages.',
			en: 'Wooden card cabinet with six drawers, seen in three-quarter view from below. On top, a request card passes through a pin gauge before entering a lock slot; a drawer slides out on its runners, its twenty cards lift and leave their track at the bottom, while a totaliser on the side reads 100 cards over 5 pages.',
		},
		pieces,
		seo: {
			title: { fr: 'trekker — anatomie d’une API de randonnées NestJS, Zod et Drizzle', en: 'trekker — anatomy of a hiking API built with NestJS, Zod and Drizzle' },
			description: {
				fr: 'Un meuble à fiches explique trekker : chaque requête passe au gabarit Zod partagé, puis NestJS et Drizzle sortent de Postgres 20 itinéraires par page.',
				en: 'A card cabinet explains trekker: every request goes through the shared Zod gauge, then NestJS and Drizzle pull 20 routes per page out of Postgres.',
			},
		},
	},
	renderRest,
};
