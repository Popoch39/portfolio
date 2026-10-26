// Anatomie de ma_parcelle : la colonne de sondage (fiche de concept : `concept.md`).
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { REST_RELEVE, SHA } from './model.ts';
import { pieces } from './pieces.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'ma-parcelle',
		sha: SHA,
		machine: 'Colonne de sondage',
		lede: {
			before: 'Cliquez une parcelle : la carte la ',
			emphasis: 'carotte',
			after: ' à travers six couches de données publiques, sans compte ni serveur.',
		},
		title: 'Carotte d’une parcelle',
		consignes: {
			pointer: 'Maintenez le clic sur la colonne pour forer les strates · cliquez le plateau pour relancer le sondage',
			touch: 'Gardez le doigt sur la colonne pour forer les strates · touchez le plateau pour relancer le sondage',
		},
		releve: REST_RELEVE,
		caption:
			'Le carottier part de la parcelle choisie sur le plan cadastral et traverse six strates, une par bloc de la fiche, dans leur ordre d’affichage. Chaque strate est aussi épaisse que le nombre de requêtes que son bloc envoie pour la parcelle 33063 KJ 33 : 32 en tout, du navigateur aux API publiques, sans serveur. Seule la croûte du cadastre conditionne les autres, qui sont interrogées ensemble ; une strate perdue manque au log sans arrêter le sondage.',
		label:
			'Colonne de sondage en écorché. Un carottier bleu descend d’un plateau gravé du plan cadastral à travers six strates de sol, de haut en bas : cadastre, urbanisme, risques, ventes, bâtiment et DPE. Tant qu’on appuie sur la colonne, il fore ; au relâcher, il s’arrête. Un log fixé au mât note ce que chaque strate a livré. Maintenir flèche bas pour forer, flèche haut pour remonter, Entrée pour relancer le sondage.',
		pieces,
		seo: {
			title: 'ma_parcelle — anatomie d’une carte des données publiques · Louis Pocheron',
			description:
				'Comment ma_parcelle réunit ce que les données publiques disent d’une parcelle : une colonne de sondage interactive traverse cadastre, urbanisme, risques, ventes, bâtiment et DPE, chaque pièce reliée au code React et MapLibre.',
		},
	},
	renderRest,
};
