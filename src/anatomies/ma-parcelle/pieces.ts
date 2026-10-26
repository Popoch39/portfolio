// Nomenclature de la colonne de sondage : sept pièces, chacune liée à son code au commit lu.
import type { Piece } from '../contract.ts';

export const pieces: Piece[] = [
	{
		id: 'plateau',
		name: { fr: 'Plateau parcellaire', en: 'Parcel plate' },
		role: {
			fr: 'Le plan cadastral gravé. On choisit la parcelle en la touchant : l’IDU est lu dans la tuile déjà affichée, sans appel réseau.',
			en: 'The engraved cadastral map. You pick a parcel by touching it: its ID (IDU) is read from the tile already on screen, with no network call.',
		},
		code: { path: 'src/map/layers/PciLayer.tsx', lines: [9, 45] },
	},
	{
		id: 'tubage',
		name: { fr: 'Tubage de tête', en: 'Surface casing' },
		role: {
			fr: 'Un seul tubage pour un seul trou : la sélection retient une parcelle à la fois.',
			en: 'One casing for one hole: the selection holds a single parcel at a time.',
		},
		code: { path: 'src/stores/selection-store.ts', lines: [3, 20] },
	},
	{
		id: 'croute',
		name: { fr: 'Croûte cadastrale', en: 'Cadastral crust' },
		role: {
			fr: 'La première couche à percer : la parcelle désignée par son IDU, d’où partent toutes les autres.',
			en: 'The first layer to break through: the parcel named by its IDU, from which all the others start.',
		},
		code: { path: 'src/api/cadastre.ts', lines: [63, 74] },
	},
	{
		id: 'carottier',
		name: { fr: 'Carottier', en: 'Core barrel' },
		role: {
			fr: 'Il emporte la parcelle sortie du cache du Cadastre jusque dans chaque strate. Si la croûte casse, il ne remonte rien.',
			en: 'It carries the parcel, taken from the Cadastre cache, down into every stratum. If the crust breaks, it brings nothing back up.',
		},
		code: { path: 'src/queries/block.ts', lines: [6, 15] },
		master: true,
	},
	{
		id: 'couronne',
		name: { fr: 'Couronne diamantée', en: 'Diamond bit' },
		role: {
			fr: 'Elle mord chaque source : un GET avec un délai de 15 s et une erreur typée (HTTP, délai, réseau, JSON invalide).',
			en: 'It bites into each source: a GET with a 15 s timeout and a typed error (HTTP, timeout, network, invalid JSON).',
		},
		code: { path: 'src/api/fetch-json.ts', lines: [61, 91] },
	},
	{
		id: 'viroles',
		name: { fr: 'Viroles des strates', en: 'Stratum rings' },
		role: {
			fr: 'Six viroles boulonnées, une par bloc, dans l’ordre de la fiche. Chacune charge et échoue seule.',
			en: 'Six bolted rings, one per block, in the order of the report. Each one loads and fails on its own.',
		},
		code: { path: 'src/components/report/blocks.ts', lines: [14, 25] },
	},
	{
		id: 'log',
		name: { fr: 'Log de sondage', en: 'Borehole log' },
		role: {
			fr: 'La synthèse : elle s’écrit avec ce qui est remonté. Une strate perdue ou encore en cours laisse sa ligne vierge, et le témoin reste allumé tant qu’une strate charge.',
			en: 'The summary: it is written from whatever has come up. A lost stratum, or one still loading, leaves its line blank, and the indicator stays lit while any stratum is loading.',
		},
		code: { path: 'src/lib/summary/summary.ts', lines: [59, 68] },
	},
];
