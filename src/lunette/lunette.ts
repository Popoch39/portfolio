// La Lunette (ADR 0007, maquette A · Telescope fidèle), importée par l'écouteur à la première commande :
// un <dialog> modal qu'elle construit, et sa CSS qu'elle injecte. Elle ne décide de rien : pour la ligne
// tapée et la page, le registre lui donne la liste et l'action ; elle les montre et les exécute.
import css from './lunette.css?inline';
import { el } from './dom.ts';
import { echo } from './echo.ts';
import { closed, health, opened } from './health.ts';
import { version } from './version.ts';
import { draw, drawn, quit } from './oeufs.ts';
import { recall } from './recall.ts';
import { commandLabel, contextAt, list, run, type Action, type Context, type Entry, type Listing, type Pane } from './registry.ts';
import { projects, restFigurePath } from '../data/profile.ts';
import { defaultLocale, home, locales, type Locale, type Localized } from '../lib/i18n.ts';
import type { Text } from '../anatomies/contract.ts';

const machines = import.meta.glob<Text>('../anatomies/*/machine.ts', { eager: true, import: 'machine' });

/** La note d'une pièce, sur la figure de la fiche. */
const noteOf = (id: string) => document.querySelector(`.note[data-piece="${CSS.escape(id)}"]`);

/**
 * La figure de la fiche, lue dans la page : les pièces dans l'ordre de la nomenclature, la note en clair
 * de chacune, et la règle de temps si la figure en a une. Hors d'une fiche, rien.
 */
function figureOf(): Context['figure'] {
	const items = [...document.querySelectorAll<HTMLElement>('.nomenclature [data-piece]')];
	if (!items.length) return undefined;
	const read = (node: Element | null, selector: string) => node?.querySelector(selector)?.textContent?.trim() ?? '';
	const pieces = items.map((item) => {
		const id = item.dataset.piece ?? '';
		const note = noteOf(id);
		return { id, name: read(item, '.name'), note: { title: read(note, '.plain .t'), text: read(note, '.text') } };
	});
	return { pieces, timeline: document.querySelector('[data-tour]') !== null };
}

const context: Context = {
	...(contextAt(location.pathname) ?? {
		page: home,
		locale: locales.find((locale) => locale === document.documentElement.lang) ?? defaultLocale,
	}),
	figure: figureOf(),
};
const { locale } = context;

const words = {
	telescope: { fr: 'Lunette', en: 'Telescope' },
	preview: { fr: 'Aperçu', en: 'Preview' },
	help: { fr: 'Aide', en: 'Help' },
	note: { fr: 'Note', en: 'Note' },
	move: { fr: 'déplacer', en: 'move' },
	complete: { fr: 'compléter', en: 'complete' },
	history: { fr: 'historique', en: 'history' },
	escape: { fr: 'échap', en: 'esc' },
	close: { fr: 'fermer', en: 'close' },
} satisfies Record<string, Localized<string>>;

const say = (word: keyof typeof words) => words[word][locale];

const attrs = (node: Element, values: Record<string, string>) => {
	for (const [name, value] of Object.entries(values)) node.setAttribute(name, value);
};

const showcmd = document.querySelector('[data-showcmd]');
const bar = showcmd?.closest('footer');

// La structure de la maquette A : les résultats sur le prompt à gauche, le Volet à droite, la rangée
// d'aide sous la fenêtre.
const dialog = el('dialog', 'lunette');
attrs(dialog, { 'aria-label': say('telescope') });
const win = el('div', 'window');

const results = el('div', 'frame results');
const resultsTitle = el('span', 'title');
resultsTitle.id = 'lunette-results';
const listbox = el('ul');
listbox.id = 'lunette-list';
attrs(listbox, { role: 'listbox', 'aria-labelledby': resultsTitle.id });
results.append(resultsTitle, listbox);

const prompt = el('div', 'frame prompt');
const promptTitle = el('span', 'title');
const chevron = el('span', 'chevron', '>');
const input = el('input');
Object.assign(input, { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, autofocus: true });
attrs(input, { role: 'combobox', 'aria-label': commandLabel[locale], 'aria-controls': listbox.id, 'aria-autocomplete': 'list' });
const cursor = el('span', 'cursor');
const count = el('span', 'count');
const close = el('button', 'close', say('close'));
close.type = 'button';
for (const node of [chevron, cursor]) attrs(node, { 'aria-hidden': 'true' });
prompt.append(promptTitle, chevron, input, cursor, count, close);

const pane = el('section', 'frame pane');
const paneTitle = el('span', 'title');
paneTitle.id = 'lunette-pane';
attrs(pane, { 'aria-labelledby': paneTitle.id });
const help = el('p', 'help');
const helpIndex = el('dl', 'index');
const figure = el('div', 'figure');
// Paresseuse : sur téléphone, le Volet n'est pas affiché et sa figure n'est jamais demandée.
const image = Object.assign(el('img'), { alt: '', decoding: 'async', loading: 'lazy' });
figure.append(image);
const about = el('div', 'about');
const head = el('div', 'head');
const name = el('span', 'name');
const rank = el('span', 'rank');
const machine = el('span', 'machine');
const desc = el('p', 'desc');
const stack = el('span', 'stack');
head.append(name, rank);
about.append(head, machine, desc, stack);
// La sortie d'une commande, comme le tampon qu'ouvre Neovim : :checkhealth, :version.
const report = el('div', 'report');
// Les easter eggs : :smile, :Ex, :Lazy.
const egg = el('div', 'egg');
pane.append(paneTitle, help, helpIndex, figure, about, report, egg);

const keys = el('p', 'keys');
const enterLabel = el('span');
const hint = (key: string, label: string | Node) => {
	const span = el('span');
	span.append(el('kbd', '', key), ' ', label);
	return span;
};
keys.append(hint('↵', enterLabel), hint('⌃n ⌃p', say('move')), hint('⇥', say('complete')), hint('↑', say('history')), hint(say('escape'), say('close')));

win.append(results, prompt, pane, keys);
dialog.append(win);

/** La commande dont on tape l'argument (`e `), montrée en titre du prompt plutôt que dans la saisie. */
let command = '';
let listing: Listing;
let selected = 0;

const line = () => command + input.value;

function option({ label, hits, detail }: Entry, index: number) {
	const li = el('li');
	li.id = `lunette-${index}`;
	li.dataset.index = String(index);
	attrs(li, { role: 'option' });
	const text = el('span', 'label');
	let at = 0;
	for (const hit of hits) {
		text.append(label.slice(at, hit), el('b', '', label[hit]));
		at = hit + 1;
	}
	text.append(label.slice(at));
	li.append(text);
	if (detail) li.append(el('span', 'detail', detail));
	return li;
}

/** Les sorties de commande, composées à l'instant : leur titre au Volet, et leur contenu. */
const reports: Partial<Record<Pane['kind'], { title: string; render: (locale: Locale) => Node[] }>> = {
	health: { title: ':checkhealth', render: health },
	version: { title: ':version', render: version },
};

/** Le Volet du résultat sélectionné : l'Aperçu d'un projet, la note d'une pièce, ou l'aide d'une commande. */
function show(content?: Pane) {
	const project = content?.kind === 'project' ? projects.find((p) => p.slug === content.slug) : undefined;
	const output = content && reports[content.kind];
	help.hidden = content?.kind !== 'help' && content?.kind !== 'note';
	helpIndex.hidden = !(content?.kind === 'help' && content.commands);
	figure.hidden = about.hidden = !project;
	report.hidden = !output;
	egg.hidden = !drawn(content);
	if (drawn(content)) {
		paneTitle.textContent = content.title;
		egg.replaceChildren(...draw(content, locale));
	} else if (output) {
		paneTitle.textContent = output.title;
		report.replaceChildren(...output.render(locale));
	} else if (content?.kind === 'help') {
		paneTitle.textContent = `${say('help')} — ${content.name}`;
		help.textContent = content.text;
		helpIndex.replaceChildren(...(content.commands ?? []).flatMap(({ name, text }) => [el('dt', '', `:${name}`), el('dd', '', text)]));
	} else if (content?.kind === 'note') {
		// La note en clair, comme sur la figure : son titre, puis ce que fait la pièce.
		paneTitle.textContent = `${say('note')} — ${content.name}`;
		help.replaceChildren(el('strong', '', content.title), content.text);
	} else if (project) {
		paneTitle.textContent = `${say('preview')} — ${project.repo}`;
		// La figure au repos, déjà servie par le site : demandée à la sélection de son projet seulement.
		image.src = restFigurePath(project, locale);
		name.textContent = project.repo;
		rank.textContent = `${String(projects.indexOf(project) + 1).padStart(2, '0')} · ${project.year}`;
		machine.textContent = machines[`../anatomies/${project.slug}/machine.ts`]?.[locale] ?? '';
		desc.textContent = project.description[locale];
		stack.textContent = project.stack.join(' · ');
	} else paneTitle.textContent = say('preview');
}

function select(index: number) {
	selected = index;
	const options = [...listbox.children];
	options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
	const active = options[index];
	if (active) {
		input.setAttribute('aria-activedescendant', active.id);
		active.scrollIntoView({ block: 'nearest' });
	} else input.removeAttribute('aria-activedescendant');
	show(listing.entries[index]?.pane);
}

/** La ligne a changé : nouvelle liste, meilleur résultat sélectionné d'office. */
function update() {
	// Le Volet montré par une commande (`:help`) cède à la frappe suivante.
	delete dialog.dataset.pane;
	listing = list(line(), context);
	// Une commande qui attend son argument passe dans le titre du prompt ; la saisie garde l'argument.
	if (listing.argument !== undefined && !command) {
		command = line().slice(0, line().length - listing.argument.length);
		input.value = listing.argument;
	}
	const { title, prompt: current, enter, entries, total } = listing;
	resultsTitle.textContent = title;
	promptTitle.textContent = current;
	enterLabel.textContent = enter;
	count.textContent = `${entries.length} / ${total}`;
	listbox.replaceChildren(...entries.map(option));
	input.setAttribute('aria-expanded', String(entries.length > 0));
	if (showcmd) showcmd.textContent = `:${line()}`;
	select(0);
}

/**
 * L'historique des commandes lancées, le plus récent en dernier, gardé pour l'onglet : il suit le
 * visiteur d'une page à l'autre et part avec l'onglet. Chaque accès au stockage est protégé : bloqué
 * (navigation privée stricte, cookies refusés), il lève une exception, et la Lunette se passe d'historique.
 */
const storageKey = 'lunette-history';

function guarded<T>(access: () => T): T | undefined {
	try {
		return access();
	} catch {
		return undefined;
	}
}

function past(): string[] {
	const lines: unknown = guarded(() => JSON.parse(sessionStorage.getItem(storageKey) ?? '[]'));
	return Array.isArray(lines) ? lines.filter((line): line is string => typeof line === 'string') : [];
}

let history: string[] = [];
/** La ligne rappelée par ↑, tant que la frappe ne l'a pas changée. */
let recalled: number | undefined;

/** Comme Vim : une ligne relancée remonte en tête au lieu d'être doublée, et les plus vieilles tombent. */
function remember(typed: string) {
	history = [...history.filter((line) => line !== typed), typed].slice(-50);
	guarded(() => sessionStorage.setItem(storageKey, JSON.stringify(history)));
}

function write(text: string) {
	command = '';
	recalled = undefined;
	input.value = text;
	update();
}

/**
 * Le presse-papiers manque hors contexte sécurisé, et refuse sans geste récent du visiteur ou sans
 * permission : l'écho d'erreur donne alors l'adresse à copier à la main.
 */
async function copy({ text, copied, failed }: Extract<Action, { kind: 'yank' }>) {
	try {
		await navigator.clipboard.writeText(text);
		echo(copied);
	} catch {
		echo(failed, 'error');
	}
}

function act(action: Action) {
	if (action.kind === 'show') {
		show(action.pane);
		// Sur téléphone, sans Volet à côté, il prend la place des résultats.
		dialog.dataset.pane = '';
		return;
	}
	// Fermée d'abord : le focus qu'elle rend à la page déviserait une pièce visée avant lui.
	dialog.close();
	if (action.kind === 'yank') return void copy(action);
	// Sans `opener`, l'onglet ouvert ne peut pas toucher à celui du site.
	if (action.kind === 'open') return void window.open(action.url, '_blank', 'noopener');
	if (action.kind === 'go') go(action.path);
	else if (action.kind === 'aim') aim(action.piece);
	// Les contrôles de la carte, tels quels : la bascule B4 et le tour jouent comme à la souris. La
	// bascule garde le focus comme un clic : sur la lecture cochée, d'où le mode de la carte se lit.
	else if (action.kind === 'lecture') {
		const radio = document.querySelector<HTMLInputElement>(`input[name^="lecture-"][value="${action.value}"]`);
		radio?.click();
		radio?.focus();
	} else if (action.kind === 'tour') {
		const button = document.querySelector<HTMLButtonElement>('[data-tour]');
		// Le bouton bascule : il ne sert que s'il ne fait pas déjà ce qu'on demande.
		if (button && action.play !== button.hasAttribute('data-touring')) button.click();
	}
	// Après la Lunette fermée : l'aplat rendra le focus à ce qu'elle-même vient de rendre.
	else if (action.kind === 'quit') quit(locale);
}

/**
 * Un simple changement d'adresse : la transition lettre à lettre (ADR 0004) joue d'elle-même. Vers une
 * section de la page même, le navigateur défile sans rien focaliser : la section prend le focus, pour
 * que le clavier et le lecteur d'écran repartent de là, focalisable le temps de l'avoir seulement.
 */
function go(path: string) {
	const { pathname, hash } = new URL(path, location.href);
	location.assign(path);
	const section = pathname === location.pathname && hash ? document.getElementById(hash.slice(1)) : null;
	if (!section) return;
	if (!section.hasAttribute('tabindex')) {
		section.tabIndex = -1;
		section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once: true });
	}
	section.focus({ preventScroll: true });
}

/**
 * Vise une pièce : un événement `aim` sur sa note, que le module de la fiche passe à la mise en avant
 * (`aimPiece`), seule à écrire l'état de visée. Importée d'ici, elle couperait en deux le morceau du
 * chargeur et alourdirait l'écouteur de l'accueil au-delà de son budget (ADR 0007). Puis la figure
 * vient à l'écran, si elle n'y est pas, et le focus va au lien de la pièce qu'on voit : celui de sa note
 * lue en code, sinon celui de la nomenclature. Son `focusin` vise la même pièce : la visée tient.
 */
function aim(piece: string) {
	const note = noteOf(piece);
	if (!note) return;
	note.dispatchEvent(new Event('aim', { bubbles: true }));
	note
		.closest('figure')
		?.querySelector('[data-motion]')
		?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion)').matches ? 'instant' : 'smooth' });
	[...document.querySelectorAll<HTMLElement>(`[data-piece="${CSS.escape(piece)}"] a`)]
		.find((link) => link.checkVisibility({ visibilityProperty: true }))
		?.focus({ preventScroll: true });
}

/**
 * Entrée : la commande qui attend son argument y passe ; sinon le résultat sélectionné, ou la ligne
 * entière, est lancé et entre dans l'historique. Une ligne qui ne résout rien ferme la Lunette sur son
 * erreur, comme la ligne de commande de Vim.
 */
function enter() {
	const entry = listing.entries[selected];
	if (entry && !entry.action) return write(entry.line);
	remember((entry?.line ?? line()).trim());
	perform(entry?.action ?? run(line(), context));
}

function perform(result: Action | { error: string }) {
	if ('kind' in result) return act(result);
	dialog.close();
	echo(result.error, 'error');
}

input.addEventListener('input', () => {
	recalled = undefined;
	update();
});

input.addEventListener('keydown', (event) => {
	const { key, ctrlKey } = event;
	const arrow = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
	// ↑ dans une Lunette vide remonte l'historique, ↓ en redescend ; ⌃p et ⌃n déplacent toujours la sélection.
	const rewind = arrow ? recall(history, recalled, line(), arrow) : undefined;
	if (rewind) {
		event.preventDefault();
		write(rewind.line);
		recalled = rewind.at;
		return;
	}
	// Le meilleur résultat est en bas : ↑ remonte vers les moins bons.
	const move = arrow || (ctrlKey && key === 'p' ? 1 : ctrlKey && key === 'n' ? -1 : 0);
	const { length } = listing.entries;
	if (move) {
		event.preventDefault();
		if (length) select((selected + move + length) % length);
	} else if (key === 'Enter') {
		event.preventDefault();
		enter();
	} else if (key === 'Tab') {
		// Le focus reste dans la Lunette : Tab complète au lieu d'en sortir.
		event.preventDefault();
		const entry = listing.entries[selected];
		if (entry) write(entry.line);
	} else if (key === 'Backspace' && !input.value && command) {
		// Effacer devant l'argument rend la commande à la saisie.
		event.preventDefault();
		write(command.trimEnd());
	}
});

const optionOf = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>('[role=option]') : null);

// Survoler un résultat le sélectionne (par `aria-selected`, jamais `:hover`) ; au mouvement seulement,
// pour qu'une liste qui change sous un pointeur immobile garde le meilleur résultat.
listbox.addEventListener('pointermove', (event) => {
	const index = Number(optionOf(event)?.dataset.index ?? selected);
	if (index !== selected) select(index);
});

listbox.addEventListener('click', (event) => {
	const target = optionOf(event);
	if (!target) return;
	select(Number(target.dataset.index));
	enter();
});

// Le focus ne quitte pas la saisie : un clic ailleurs dans la Lunette ne le lui prend pas.
dialog.addEventListener('mousedown', (event) => {
	if (event.target !== input) event.preventDefault();
});

// Le voile autour de la fenêtre est le <dialog> lui-même : un clic dessus ferme, comme Échap.
dialog.addEventListener('click', (event) => {
	if (event.target === dialog) dialog.close();
});

close.addEventListener('click', () => dialog.close());

dialog.addEventListener('close', () => {
	closed();
	bar?.removeAttribute('data-mode');
	if (showcmd) showcmd.textContent = '';
});

/** Ouvre la Lunette, avec la frappe déjà tapée ; déjà ouverte, lui rend le focus. */
export function open(typed = '') {
	if (dialog.open) return input.focus();
	// Avant tout : la touche qui ouvre la Lunette n'est pas une interaction de la page (:checkhealth).
	opened();
	if (!dialog.isConnected) {
		document.head.append(el('style', '', css));
		document.body.append(dialog);
	}
	// La ligne de commande recouvre le message précédent, comme dans Vim.
	echo();
	history = past();
	write(typed);
	bar?.setAttribute('data-mode', 'command');
	// Modale : la page est inerte, Échap ferme, et le focus revient où il était.
	dialog.showModal();
}

/** Le `yy` du mode normal : `:yank mail`, sans ouvrir la Lunette ni entrer dans son historique. */
export const yank = () => perform(run('yank mail', context));

/**
 * Le `gd` du mode normal : le code de la pièce visée, à l'adresse de sa note en code, sur GitHub, donc
 * dans un nouvel onglet comme `:!github` ; sans pièce visée, la liste des pièces. Sans figure, la
 * réponse de Vim à un `gd` sans rien sous le curseur.
 */
export function gd() {
	const code = document.querySelector<HTMLAnchorElement>('.note[data-on] a.ref');
	if (code) act({ kind: 'open', url: code.href });
	else if (context.figure) open('pieces ');
	else echo('E349: No identifier under cursor', 'error');
}
