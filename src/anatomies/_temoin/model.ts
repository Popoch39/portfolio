// Modèle de la figure témoin : six blocs, un par pièce du portfolio, chacun aussi haut que son
// code compte de lignes. Le relevé et la géométrie en découlent.
//
// La figure témoin prouve le contrat de bout en bout tant qu'un projet n'a pas son anatomie.
// Elle sera retirée avec le repli du registre (#29) : rien en dehors de ce dossier n'en dépend,
// à part ce repli.
import type { Piece } from '../contract.ts';

/** Dépôt et commit lus : le portfolio lui-même, à la fusion de D1 sur `main`. */
export const REPO = 'portfolio';
export const SHA = '7bdc7daa686bc0900933c92db20edd56425a1036';

export const pieces: Piece[] = [
	{
		id: 'socle',
		name: 'Mise en page',
		role: 'Le cadre de toute page : le <head>, les polices et les couleurs.',
		code: { path: 'src/layouts/Layout.astro', lines: [1, 64] },
	},
	{
		id: 'en-tete',
		name: 'En-tête',
		role: 'Le nom, le rôle et la navigation vers les sections.',
		code: { path: 'src/components/SiteHeader.astro', lines: [1, 12] },
	},
	{
		id: 'heros',
		name: 'Héros',
		role: 'Le nom en très grand, l’accroche et les faits.',
		code: { path: 'src/components/Hero.astro', lines: [1, 41] },
	},
	{
		id: 'projets',
		name: 'Liste des projets',
		role: 'Une ligne par dépôt mis en avant.',
		code: { path: 'src/components/Projects.astro', lines: [1, 28] },
	},
	{
		id: 'barre',
		name: 'Barre d’état',
		role: 'Le mode, la branche et le fichier ouvert, façon Neovim.',
		code: { path: 'src/components/StatusBar.astro', lines: [1, 41] },
	},
	{
		id: 'profil',
		name: 'Données de profil',
		role: 'La source unique : chaque ligne et chaque fiche en dérivent.',
		code: { path: 'src/data/profile.ts', lines: [169, 221] },
		master: true,
	},
];

/** Hauteur d'un bloc par ligne de code, en unités du monde. */
export const UNIT_PER_LINE = 0.6;

export const linesOf = (piece: Piece) => piece.code.lines[1] - piece.code.lines[0] + 1;

export const heightOf = (piece: Piece) => linesOf(piece) * UNIT_PER_LINE;

export const totalLines = pieces.reduce((sum, piece) => sum + linesOf(piece), 0);

export const readout = `${totalLines} lignes · ${pieces.length} blocs`;
