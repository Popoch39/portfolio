// Anatomie de claude-tmux-notify.nvim : un tableau d'annonciateur à volets, mural. Les textes sont
// ceux de la fiche de concept validée (`concept.md`, section 8).
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { pieces, releve, SHA } from './model.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'claude-tmux-notify',
		sha: SHA,
		machine: 'Tableau d’annonciateur',
		lede: {
			before: 'Quand Claude Code vous ',
			emphasis: 'attend',
			after: ' dans une autre fenêtre tmux, un toast tombe dans Neovim.',
		},
		title: 'Tableau d’annonciateur à volets',
		consignes: {
			pointer: 'Cliquez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche',
			touch: 'Touchez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche',
		},
		releve,
		caption:
			'Le crochet Notification ou Stop de Claude Code ajoute une ligne JSON au fichier de cache ; toutes les 1000 ms, Neovim lit ce qui dépasse son décalage et lève un toast, sauf si la fenêtre tmux de Claude est déjà au premier plan.',
		label:
			'Tableau d’annonciateur mural. Cinq volets, un par fenêtre tmux, tombent quand une session Claude Code attend ou a fini ; une bande perforée reçoit les événements, un échappement la lit chaque seconde, une sonnette tinte, et une fiche à cordon, branchée dans le jack de la fenêtre au premier plan, retient son volet. Acquitter une fenêtre, c’est y brancher la fiche. Flèches ou chiffres pour choisir une fenêtre, Entrée pour appeler ou acquitter, F pour une fin de tour.',
		pieces,
		seo: {
			title: 'claude-tmux-notify.nvim — anatomie d’un toast Neovim pour Claude Code',
			description:
				'Comment claude-tmux-notify.nvim prévient Neovim qu’une session Claude Code attend dans une autre fenêtre tmux : crochet, fichier JSONL, sondage à 1 s, toast.',
		},
	},
	renderRest,
};
