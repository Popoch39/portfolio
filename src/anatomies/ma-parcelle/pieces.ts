// Nomenclature de la colonne de sondage : sept pièces, chacune liée à son code au commit lu.
import type { Piece } from '../contract.ts';

export const pieces: Piece[] = [
	{
		id: 'plateau',
		name: 'Plateau parcellaire',
		role: 'Le plan cadastral gravé. On choisit la parcelle en la touchant : l’IDU est lu dans la tuile déjà affichée, sans appel réseau.',
		code: { path: 'src/map/layers/PciLayer.tsx', lines: [9, 45] },
	},
	{
		id: 'tubage',
		name: 'Tubage de tête',
		role: 'Un seul tubage pour un seul trou : la sélection retient une parcelle à la fois.',
		code: { path: 'src/stores/selection-store.ts', lines: [3, 20] },
	},
	{
		id: 'croute',
		name: 'Croûte cadastrale',
		role: 'La première couche à percer : la parcelle désignée par son IDU, d’où partent toutes les autres.',
		code: { path: 'src/api/cadastre.ts', lines: [63, 74] },
	},
	{
		id: 'carottier',
		name: 'Carottier',
		role: 'Il emporte la parcelle sortie du cache du Cadastre jusque dans chaque strate. Si la croûte casse, il ne remonte rien.',
		code: { path: 'src/queries/block.ts', lines: [6, 15] },
		master: true,
	},
	{
		id: 'couronne',
		name: 'Couronne diamantée',
		role: 'Elle mord chaque source : un GET avec un délai de 15 s et une erreur typée (HTTP, délai, réseau, JSON invalide).',
		code: { path: 'src/api/fetch-json.ts', lines: [61, 91] },
	},
	{
		id: 'viroles',
		name: 'Viroles des strates',
		role: 'Six viroles boulonnées, une par bloc, dans l’ordre de la fiche. Chacune charge et échoue seule.',
		code: { path: 'src/components/report/blocks.ts', lines: [14, 25] },
	},
	{
		id: 'log',
		name: 'Log de sondage',
		role: 'La synthèse : elle s’écrit avec ce qui est remonté. Une strate perdue ou encore en cours laisse sa ligne vierge, et le témoin reste allumé tant qu’une strate charge.',
		code: { path: 'src/lib/summary/summary.ts', lines: [59, 68] },
	},
];
