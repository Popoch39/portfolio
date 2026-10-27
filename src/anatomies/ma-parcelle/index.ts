// Anatomie de ma_parcelle : la colonne de sondage (fiche de concept : `concept.md`).
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { machine } from './machine.ts';
import { REST_RELEVE, SHA } from './model.ts';
import { pieces } from './pieces.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'ma-parcelle',
		sha: SHA,
		machine,
		lede: {
			before: { fr: 'Cliquez une parcelle : la carte la ', en: 'Click a land parcel and the map ' },
			emphasis: { fr: 'carotte', en: 'cores' },
			after: {
				fr: ' à travers six couches de données publiques, sans compte ni serveur.',
				en: ' it through six layers of French open data, with no account and no server.',
			},
		},
		title: { fr: 'Carotte d’une parcelle', en: 'Core sample of a land parcel' },
		consignes: {
			pointer: {
				fr: 'Maintenez le clic sur la colonne pour forer les strates · cliquez le plateau pour relancer le sondage',
				en: 'Press and hold the column to drill through the strata · click the plate to run the survey again',
			},
			touch: {
				fr: 'Gardez le doigt sur la colonne pour forer les strates · touchez le plateau pour relancer le sondage',
				en: 'Keep your finger on the column to drill through the strata · tap the plate to run the survey again',
			},
		},
		releve: REST_RELEVE,
		caption: {
			fr: 'Le carottier part de la parcelle choisie sur le plan cadastral et traverse six strates, une par bloc de la fiche, dans leur ordre d’affichage. Chaque strate est aussi épaisse que le nombre de requêtes que son bloc envoie pour la parcelle 33063 KJ 33 : 32 en tout, du navigateur aux API publiques, sans serveur. Seule la croûte du cadastre conditionne les autres, qui sont interrogées ensemble ; une strate perdue manque au log sans arrêter le sondage.',
			en: 'The core barrel sets off from the parcel picked on the cadastral map and passes through six strata, one per block of the report, in the order they are shown. Each stratum is as thick as the number of requests its block sends for parcel 33063 KJ 33: 32 in all, from the browser to the public APIs, with no server. Only the cadastral crust gates the others, which are queried together; a lost stratum is missing from the log without stopping the survey.',
		},
		label: {
			fr: 'Colonne de sondage en écorché. Un carottier bleu descend d’un plateau gravé du plan cadastral à travers six strates de sol, de haut en bas : cadastre, urbanisme, risques, ventes, bâtiment et DPE. Tant qu’on appuie sur la colonne, il fore ; au relâcher, il s’arrête. Un log fixé au mât note ce que chaque strate a livré. Maintenir flèche bas pour forer, flèche haut pour remonter, Entrée pour relancer le sondage.',
			en: 'Cutaway coring rig. A blue core barrel descends from a plate engraved with the cadastral map through six soil strata, top to bottom: cadastre, planning, hazards, sales, building and energy ratings (DPE). While the column is pressed, it drills; on release, it stops. A log fixed to the mast records what each stratum yielded. Hold Down arrow to drill, Up arrow to raise the barrel, Enter to run the survey again.',
		},
		pieces,
		seo: {
			title: {
				fr: 'ma_parcelle — anatomie d’une carte des données publiques · Louis Pocheron',
				en: 'ma_parcelle — anatomy of an open-data map · Louis Pocheron',
			},
			description: {
				fr: 'Comment ma_parcelle réunit ce que les données publiques disent d’une parcelle : une colonne de sondage interactive traverse cadastre, urbanisme, risques, ventes, bâtiment et DPE, chaque pièce reliée au code React et MapLibre.',
				en: 'How ma_parcelle gathers what French open data says about a land parcel: an interactive coring rig drills through cadastre, planning, hazards, sales, building and energy ratings, each part linked to the React and MapLibre code.',
			},
		},
	},
	renderRest,
};
