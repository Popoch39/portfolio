import type { Mode } from './buffer';

/**
 * The statusline's Vim mode, and its `[+]` while in INSERT: written by the Lede's typist as it types, and by the
 * Formulaire du Café while the visitor writes in it. Nothing without a statusline.
 */
export function showVimMode(mode: Mode) {
	const indicator = document.querySelector<HTMLElement>('#statusline [data-vim-mode]');
	const modified = document.querySelector<HTMLElement>('#statusline [data-vim-modified]');
	if (!indicator) return;
	indicator.textContent = mode;
	indicator.dataset.mode = mode;
	if (modified) modified.hidden = mode !== 'INSERT';
}
