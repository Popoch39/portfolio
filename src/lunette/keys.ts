// L'écouteur de la Lunette (ADR 0007), importé par le module de chaque page : c'est tout ce qu'elle coûte
// avant la première commande. Il ouvre la Lunette sur `:`, Ctrl/Cmd+K et les boutons de la barre d'état,
// et joue les séquences du mode normal ; la Lunette n'est importée qu'à sa première ouverture, ou au
// premier `yy`, qui lui laisse la copie et son écho.
import { modified, motions, normalMode, type Sequences } from './normal.ts';

let lunette: Promise<typeof import('./lunette.ts')> | undefined;

/** La frappe tapée pendant le premier chargement de la Lunette (`:e t` d'un trait), qu'elle reprend. */
let typed: string | undefined;

/**
 * Appelle l'export `name` de la Lunette, importée à la première commande qui en a besoin. Par son nom,
 * pas par une fonction : chaque octet de l'écouteur part avec chaque page.
 */
const load = (name: 'open' | 'yank' | 'gd') =>
	(lunette ??= import('./lunette.ts')).then(
		(module) => module[name](typed),
		// Hors ligne, par exemple : la prochaine commande retentera l'import.
		() => (lunette = undefined),
	);

function open() {
	if (typed !== undefined) return;
	typed = '';
	void load('open').finally(() => (typed = undefined));
}

/** Les séquences du mode normal : une séquence s'ajoute ici, sans toucher à l'écouteur. */
const sequences: Sequences = { ':': open, yy: () => load('yank'), gd: () => load('gd'), ...motions };

const showcmd = document.querySelector('[data-showcmd]');

/** Une frappe du mode normal ; les touches en attente vont au showcmd de la barre d'état, comme dans Neovim. */
const press = normalMode(sequences, (keys) => {
	if (showcmd) showcmd.textContent = keys;
});

/** Une frappe destinée à un champ de saisie ou à la Lunette ouverte, pas au mode normal. */
const typing = (target: EventTarget | null) =>
	target instanceof HTMLElement && (target.isContentEditable || target.matches('dialog *,input:not([type=radio],[type=checkbox]),textarea,select'));

addEventListener('keydown', (event) => {
	const { key } = event;
	if (event.defaultPrevented || event.isComposing) return;
	// Le raccourci qui ouvre la liste des commandes d'autres éditeurs, avant celui du navigateur (sa barre
	// de recherche). Maj+K ou Verr. Maj donnent `K`.
	if ((event.ctrlKey || event.metaKey) && !event.altKey && /^k$/i.test(key)) {
		event.preventDefault();
		return open();
	}
	if (modified(event) || typing(event.target)) return;
	// Une touche du mode normal, ou un caractère gardé pour la Lunette qui charge, n'atteint pas le
	// navigateur. Maj seule ne compte pas : c'est elle qui tape `:` sur un clavier QWERTY.
	if (typed === undefined ? key !== 'Shift' && press(key) : key.length === 1 && (typed += key)) event.preventDefault();
});

for (const button of document.querySelectorAll('[data-lunette]')) button.addEventListener('click', open);
