// Les easter eggs de la Lunette (#62) : ce que montrent au Volet `:smile`, `:Ex` et `:Lazy`, et l'aplat
// d'encre de `:q!`. Le registre décide ; ce module ne fait que dessiner, avec sa CSS, injectée au premier
// dessin comme celle de la Lunette.
import css from './oeufs.css?inline';
import type { Pane } from './registry.ts';
import type { Locale, Localized } from '../lib/i18n.ts';

/** Les Volets que dessine ce module : chacun porte son titre. */
type Drawn = Extract<Pane, { kind: 'art' | 'tree' | 'plugins' }>;

export const drawn = (pane?: Pane): pane is Drawn => pane?.kind === 'art' || pane?.kind === 'tree' || pane?.kind === 'plugins';

const words = {
	// Le « NOPE » de `:smile`, que les lettres de caractères ne disent pas à un lecteur d'écran.
	nope: { fr: 'NOPE, en lettres de caractères', en: 'NOPE, in letters made of characters' },
	closed: { fr: 'Portfolio fermé, sans enregistrer.', en: 'Portfolio closed, without saving.' },
	reopen: { fr: 'Échap, ou :e puis ↵, pour le rouvrir.', en: 'Esc, or :e then ↵, to reopen it.' },
	command: { fr: 'Commande', en: 'Command' },
} satisfies Record<string, Localized<string>>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	node.textContent = text;
	return node;
}

let styled = false;

function style() {
	if (styled) return;
	styled = true;
	document.head.append(el('style', '', css));
}

/** Le contenu du Volet d'un easter egg, sous son titre. */
export function draw(pane: Drawn, locale: Locale): Node[] {
	style();
	if (pane.kind === 'art') {
		const art = el('div', 'art');
		art.setAttribute('role', 'img');
		art.setAttribute('aria-label', words.nope[locale]);
		art.append(el('pre', '', pane.lines.join('\n')));
		return [art];
	}
	if (pane.kind === 'tree') {
		// La page sélectionnée marquée dans l'arbre, comme la ligne du curseur de netrw.
		const tree = el('pre', 'tree');
		tree.append(...pane.lines.flatMap((line, i) => [i === pane.at ? el('b', '', line) : line, '\n']));
		return [tree];
	}
	const list = el('ul', 'plugins');
	list.append(
		...pane.plugins.map(({ name, package: from, role, state }) => {
			const li = el('li');
			li.dataset.state = state;
			const mark = el('span', 'mark', state === 'loaded' ? '●' : '○');
			mark.setAttribute('aria-hidden', 'true');
			// La version installée, injectée au build ; un outil sans paquet (une police) n'en a pas.
			li.append(mark, el('b', '', name), el('span', 'version', from ? __BUILD__.versions[from] : ''), el('span', 'state', state), el('span', 'role', role));
			return li;
		}),
	);
	return [list];
}

let screen: HTMLDialogElement | undefined;

/**
 * `:q!` sur l'accueil : l'écran « fermé » sous un aplat d'encre, une boîte de dialogue modale qui garde
 * le focus. Échap, ou `:e` suivi d'Entrée, la ferme et rend la page telle quelle, focus compris.
 */
export function quit(locale: Locale) {
	style();
	screen ??= closedScreen(locale);
	screen.showModal();
}

function closedScreen(locale: Locale) {
	const dialog = el('dialog', 'quit');
	const message = el('p', '', words.closed[locale]);
	message.id = 'quit-message';
	const hint = el('p', 'hint', words.reopen[locale]);
	hint.id = 'quit-hint';
	dialog.setAttribute('aria-labelledby', message.id);
	dialog.setAttribute('aria-describedby', hint.id);
	const line = el('p', 'line');
	const chevron = el('span', 'chevron', '>');
	chevron.setAttribute('aria-hidden', 'true');
	// Un vrai champ : sur téléphone, sans Échap, c'est par lui qu'on tape `:e`.
	const input = Object.assign(el('input'), { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, autofocus: true });
	input.setAttribute('aria-label', words.command[locale]);
	line.append(chevron, input);
	dialog.append(message, hint, line);
	input.addEventListener('keydown', (event) => {
		// L'écran est fermé : Ctrl/Cmd+K n'ouvre pas la Lunette dessus (l'écouteur ignore une touche traitée).
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') event.preventDefault();
		if (event.key !== 'Enter') return;
		event.preventDefault();
		// Le `:e` seul de Vim recharge le fichier courant : ici, il rouvre la page telle qu'elle était.
		if (/^\s*:*\s*e(dit)?!?\s*$/.test(input.value)) dialog.close();
		input.value = '';
	});
	dialog.addEventListener('close', () => (input.value = ''));
	document.body.append(dialog);
	return dialog;
}
