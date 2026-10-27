// L'écho de la barre d'état, comme la ligne de message de Neovim : une information (bleu clair) ou une
// erreur (encre sur papier), écrite dans la région live polie de la barre, puis effacée. L'écouteur et la
// Lunette l'appellent ; la Lunette se ferme avant : modale, elle rend la barre inerte, et un écho écrit
// dessous ne serait pas annoncé.

const region = document.querySelector<HTMLElement>('[data-echo]');
let timer: ReturnType<typeof setTimeout> | undefined;

/** Écrit `message` dans la barre d'état quelques secondes ; sans message, efface l'écho en cours. */
export function echo(message = '', kind: 'info' | 'error' = 'info') {
	if (!region) return;
	clearTimeout(timer);
	region.dataset.kind = kind;
	// Le numéro de l'erreur en gras, comme sur la planche « Barre d'état » : `E492: Not an editor command`.
	const [, code, rest] = (kind === 'error' && /^(E\d+)(:[^]*)$/.exec(message)) || [];
	const parts: (Node | string)[] = code ? [Object.assign(document.createElement('b'), { textContent: code }), rest] : [message];
	// De nouveaux nœuds à chaque écho : le même message répété est annoncé de nouveau.
	region.replaceChildren(...(message ? parts : []));
	if (message) timer = setTimeout(echo, 5000);
}
