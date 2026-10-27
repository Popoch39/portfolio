// L'écouteur de la Lunette (ADR 0007), importé par le module de chaque page : c'est tout ce qu'elle coûte
// avant la première commande. Il ouvre la Lunette sur `:`, Ctrl/Cmd+K et les boutons de la barre d'état,
// et joue les séquences du mode normal ; la Lunette n'est importée qu'à sa première ouverture.
import { motions, normalMode, type Sequences } from './normal.ts';

let lunette: Promise<typeof import('./lunette.ts')> | undefined;

/** La frappe tapée pendant le premier chargement de la Lunette (`:e t` d'un trait), qu'elle reprend. */
let typed: string | undefined;

function open() {
	if (typed !== undefined) return;
	typed = '';
	void (lunette ??= import('./lunette.ts'))
		.then(
			({ open }) => open(typed),
			// Hors ligne, par exemple : la prochaine ouverture retentera l'import.
			() => (lunette = undefined),
		)
		.finally(() => (typed = undefined));
}

/** Les séquences du mode normal : une séquence s'ajoute ici, sans toucher à l'écouteur. */
const sequences: Sequences = { ':': open, ...motions };

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
	// Le raccourci des palettes de commandes, avant celui du navigateur (sa barre de recherche).
	if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === 'k') {
		event.preventDefault();
		return open();
	}
	if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
	if (typed !== undefined) {
		if (key.length === 1) {
			event.preventDefault();
			typed += key;
		}
		return;
	}
	// Maj seule ne compte pas : c'est elle qui tape `:` sur un clavier QWERTY.
	if (key !== 'Shift' && press(key)) event.preventDefault();
});

for (const button of document.querySelectorAll('[data-lunette]')) button.addEventListener('click', open);
