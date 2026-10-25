// Textes de la figure témoin, déclinés pour le projet dont elle tient la place.
import type { Project } from '../../data/profile.ts';
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { pieces, readout, SHA } from './model.ts';

export { REPO } from './model.ts';

/** Le dossier de son module de mouvement (`motion.ts`), pour le chargeur. */
export const MOTION = '_temoin';

export const witnessFor = (project: Project): Anatomy => ({
	content: {
		slug: project.slug,
		sha: SHA,
		machine: 'Figure témoin',
		lede: {
			before: `${project.description} Sa machine est en `,
			emphasis: 'chantier',
			after: ' : une figure témoin tient sa place.',
		},
		title: 'Le portfolio en six blocs, en attendant la machine',
		hints: {
			pointer: 'Pointez un bloc : il se lève et sa pièce s’éclaire',
			touch: 'Touchez un bloc : il se lève et sa pièce s’éclaire',
		},
		readout,
		caption: `Chaque bloc est une pièce du portfolio, aussi haut que son code compte de lignes ; le bloc bleu, les données de profil, porte toutes les fiches. La machine de ${project.repo} prendra sa place.`,
		label: `Figure témoin de ${project.repo} : six blocs posés sur un socle, un par pièce du portfolio, chacun aussi haut que son code compte de lignes. Le bloc bleu, les données de profil, est la pièce maîtresse.`,
		pieces,
		seo: {
			title: `${project.repo} — anatomie du projet · Louis Pocheron`,
			description: `${project.description} Son anatomie, et la nomenclature de ses pièces reliée au code.`,
		},
	},
	renderRest,
});
