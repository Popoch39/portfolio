// Nomenclature de la colonne de sondage : sept pièces, chacune liée à son code au commit lu.
import type { Piece } from '../contract.ts';

export const pieces: Piece[] = [
	{
		id: 'plateau',
		name: 'Plateau parcellaire',
		role: 'Le plan cadastral gravé. On choisit la parcelle en la touchant : l’IDU est lu dans la tuile déjà affichée, sans appel réseau.',
		code: { path: 'src/map/layers/PciLayer.tsx', lines: [9, 45] },
		note: {
			title: 'Choisir une parcelle',
			text: 'Un clic lit l’identifiant de la parcelle dans la carte déjà affichée, sans réseau.',
			tech: ['maplibre', 'react'],
			clue:'useLayerClick',
			symbol: 'PciLayer()',
		},
	},
	{
		id: 'tubage',
		name: 'Tubage de tête',
		role: 'Un seul tubage pour un seul trou : la sélection retient une parcelle à la fois.',
		code: { path: 'src/stores/selection-store.ts', lines: [3, 20] },
		note: {
			title: 'Retenir une seule parcelle',
			text: 'Une seule parcelle ouverte à la fois, repérée par son code cadastral de 14 caractères.',
			tech: ['react', 'typescript'],
			clue:'zustand',
			symbol: 'SelectionState',
		},
	},
	{
		id: 'croute',
		name: 'Croûte cadastrale',
		role: 'La première couche à percer : la parcelle désignée par son IDU, d’où partent toutes les autres.',
		code: { path: 'src/api/cadastre.ts', lines: [63, 74] },
		note: {
			title: 'Charger la parcelle',
			text: 'Demande au cadastre de l’IGN la forme et la surface de la parcelle, en une requête.',
			tech: ['typescript'],
			clue:'API Carto',
			symbol: 'loadParcel()',
		},
	},
	{
		id: 'carottier',
		name: 'Carottier',
		role: 'Il emporte la parcelle sortie du cache du Cadastre jusque dans chaque strate. Si la croûte casse, il ne remonte rien.',
		code: { path: 'src/queries/block.ts', lines: [6, 15] },
		note: {
			title: 'Partir de la parcelle',
			text: 'Chaque bloc part de la parcelle déjà en cache ; si elle manque, tous échouent ensemble.',
			tech: ['react', 'typescript'],
			clue:'fetchQuery',
			symbol: 'parcelBlockQuery()',
		},
		master: true,
	},
	{
		id: 'couronne',
		name: 'Couronne diamantée',
		role: 'Elle mord chaque source : un GET avec un délai de 15 s et une erreur typée (HTTP, délai, réseau, JSON invalide).',
		code: { path: 'src/api/fetch-json.ts', lines: [61, 91] },
		note: {
			title: 'Interroger chaque source',
			text: 'Le navigateur appelle les API publiques sans serveur, 15 s au plus par réponse.',
			tech: ['typescript', 'json'],
			clue:'fetch',
			symbol: 'fetchBody()',
		},
	},
	{
		id: 'viroles',
		name: 'Viroles des strates',
		role: 'Six viroles boulonnées, une par bloc, dans l’ordre de la fiche. Chacune charge et échoue seule.',
		code: { path: 'src/components/report/blocks.ts', lines: [14, 25] },
		note: {
			title: 'Empiler les six blocs',
			text: 'Cadastre, urbanisme, risques, ventes, bâtiment et DPE : chacun charge et échoue seul.',
			tech: ['react'],
			clue:'<Block>Section',
			symbol: 'BLOCKS',
		},
	},
	{
		id: 'log',
		name: 'Log de sondage',
		role: 'La synthèse : elle s’écrit avec ce qui est remonté. Une strate perdue ou encore en cours laisse sa ligne vierge, et le témoin reste allumé tant qu’une strate charge.',
		code: { path: 'src/lib/summary/summary.ts', lines: [59, 68] },
		note: {
			title: 'Composer la synthèse',
			text: 'Résume les blocs reçus, écarte ceux en panne et signale ceux qui chargent encore.',
			tech: ['typescript'],
			clue:'status',
			symbol: 'assembleSummary()',
		},
	},
];
