// Anatomie de claude-tmux-notify.nvim : un tableau d'annonciateur à volets, mural. Les textes sont
// ceux de la fiche de concept validée (`concept.md`, section 8).
import type { Anatomy } from '../contract.ts';
import { renderRest } from './geometry.ts';
import { NVIM, pieces, relevesOf, SHA } from './model.ts';

export const anatomy: Anatomy = {
	content: {
		slug: 'claude-tmux-notify',
		sha: SHA,
		machine: { fr: 'Tableau d’annonciateur', en: 'Annunciator board' },
		lede: {
			before: { fr: 'Quand Claude Code vous ', en: 'When Claude Code is ' },
			emphasis: { fr: 'attend', en: 'waiting' },
			after: {
				fr: ' dans une autre fenêtre tmux, un toast tombe dans Neovim.',
				en: ' for you in another tmux window, a toast drops into Neovim.',
			},
		},
		title: { fr: 'Tableau d’annonciateur à volets', en: 'Drop-flap annunciator board' },
		consignes: {
			pointer: {
				fr: 'Cliquez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche',
				en: 'Click a window to make Claude wait, a dropped flap to plug into its jack',
			},
			touch: {
				fr: 'Touchez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche',
				en: 'Tap a window to make Claude wait, a dropped flap to plug into its jack',
			},
		},
		releve: { fr: relevesOf('fr').rest(NVIM), en: relevesOf('en').rest(NVIM) },
		caption: {
			fr: 'Le crochet Notification ou Stop de Claude Code ajoute une ligne JSON au fichier de cache ; toutes les 1000 ms, Neovim lit ce qui dépasse son décalage et lève un toast, sauf si la fenêtre tmux de Claude est déjà au premier plan.',
			en: 'Claude Code’s Notification or Stop hook appends a JSON line to the cache file; every 1,000 ms, Neovim reads whatever lies past its offset and raises a toast, unless Claude’s tmux window is already the active one.',
		},
		label: {
			fr: 'Tableau d’annonciateur mural. Cinq volets, un par fenêtre tmux, tombent quand une session Claude Code attend ou a fini ; une bande perforée reçoit les événements, un échappement la lit chaque seconde, une sonnette tinte, et une fiche à cordon, branchée dans le jack de la fenêtre au premier plan, retient son volet. Acquitter une fenêtre, c’est y brancher la fiche. Flèches ou chiffres pour choisir une fenêtre, Entrée pour appeler ou acquitter, F pour une fin de tour.',
			en: 'Wall-mounted annunciator board. Five flaps, one per tmux window, drop when a Claude Code session is waiting or has finished; a punched tape takes in the events, an escapement reads it every second, a bell rings, and a corded plug, sitting in the jack of the active window, holds its flap up. Acknowledging a window means plugging into it. Arrow keys or digits to pick a window, Enter to call or acknowledge, F to end a turn.',
		},
		pieces,
		seo: {
			title: {
				fr: 'claude-tmux-notify.nvim — anatomie d’un toast Neovim pour Claude Code',
				en: 'claude-tmux-notify.nvim — anatomy of a Neovim toast for Claude Code',
			},
			description: {
				fr: 'Comment claude-tmux-notify.nvim prévient Neovim qu’une session Claude Code attend dans une autre fenêtre tmux : crochet, fichier JSONL, sondage à 1 s, toast.',
				en: 'How claude-tmux-notify.nvim tells Neovim that a Claude Code session is waiting in another tmux window: hook, JSONL file, polling every 1 s, toast.',
			},
		},
	},
	renderRest,
};
