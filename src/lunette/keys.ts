// L'écouteur de la Lunette (ADR 0007), importé par le module de chaque page : c'est tout ce qu'elle coûte
// avant la première commande. Il ouvre la Lunette sur `:`, Ctrl/Cmd+K et les boutons de la barre d'état,
// et joue les séquences du mode normal ; la Lunette n'est importée qu'à sa première ouverture.

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

/**
 * Les séquences du mode normal, touche après touche : une séquence entière agit, un début de
 * séquence attend la suite dans le showcmd. Une séquence s'ajoute ici, sans toucher à l'écouteur.
 */
const sequences: Record<string, () => void> = { ':': open };

const showcmd = document.querySelector('[data-showcmd]');
let pending = '';
let timer: ReturnType<typeof setTimeout> | undefined;

/** Les touches en attente, montrées dans la barre d'état comme le showcmd de Neovim. */
function wait(keys: string) {
	clearTimeout(timer);
	pending = keys;
	if (showcmd) showcmd.textContent = keys;
	// Le `timeoutlen` de Vim : une séquence laissée en plan s'efface.
	if (keys) timer = setTimeout(wait, 1000, '');
}

/** Une frappe destinée à un champ de saisie, pas au mode normal. */
const typing = (target: EventTarget | null) =>
	target instanceof HTMLElement && (target.isContentEditable || target.matches('input:not([type=radio],[type=checkbox]),textarea,select'));

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
	if (key === 'Shift') return;
	const keys = pending + key;
	if (sequences[keys]) {
		event.preventDefault();
		wait('');
		sequences[keys]();
	} else if (Object.keys(sequences).some((sequence) => sequence.startsWith(keys))) {
		event.preventDefault();
		wait(keys);
	} else wait('');
});

for (const button of document.querySelectorAll('[data-lunette]')) button.addEventListener('click', open);
