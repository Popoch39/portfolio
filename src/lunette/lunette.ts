// La Lunette (ADR 0007, maquette A · Telescope fidèle), importée par l'écouteur à la première commande :
// un <dialog> modal qu'elle construit, et sa CSS qu'elle injecte. Elle ne décide de rien : pour la ligne
// tapée et la page, le registre lui donne la liste et l'action ; elle les montre et les exécute.
import css from './lunette.css?inline';
import { contextAt, list, run, type Action, type Entry, type Listing, type Pane } from './registry.ts';
import { projects, restFigurePath } from '../data/profile.ts';
import { defaultLocale, home, locales, type Localized } from '../lib/i18n.ts';
import type { Text } from '../anatomies/contract.ts';

const machines = import.meta.glob<Text>('../anatomies/*/machine.ts', { eager: true, import: 'machine' });

const context = contextAt(location.pathname) ?? {
	page: home,
	locale: locales.find((locale) => locale === document.documentElement.lang) ?? defaultLocale,
};
const { locale } = context;

const words = {
	telescope: { fr: 'Lunette', en: 'Telescope' },
	command: { fr: 'Commande', en: 'Command' },
	preview: { fr: 'Aperçu', en: 'Preview' },
	help: { fr: 'Aide', en: 'Help' },
	move: { fr: 'déplacer', en: 'move' },
	complete: { fr: 'compléter', en: 'complete' },
	history: { fr: 'historique', en: 'history' },
	escape: { fr: 'échap', en: 'esc' },
	close: { fr: 'fermer', en: 'close' },
} satisfies Record<string, Localized<string>>;

const say = (word: keyof typeof words) => words[word][locale];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	node.textContent = text;
	return node;
}

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
attrs(input, { role: 'combobox', 'aria-label': say('command'), 'aria-controls': listbox.id, 'aria-autocomplete': 'list' });
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
pane.append(paneTitle, help, figure, about);

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

/** Le Volet du résultat sélectionné : l'Aperçu d'un projet, ou l'aide d'une commande. */
function show(content?: Pane) {
	const project = content?.kind === 'project' ? projects.find((p) => p.slug === content.slug) : undefined;
	help.hidden = content?.kind !== 'help';
	figure.hidden = about.hidden = !project;
	if (content?.kind === 'help') {
		paneTitle.textContent = `${say('help')} — ${content.name}`;
		help.textContent = content.text;
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

function write(text: string) {
	command = '';
	input.value = text;
	update();
}

function act(action: Action) {
	dialog.close();
	// Un simple changement d'adresse : la transition lettre à lettre (ADR 0004) joue d'elle-même.
	location.assign(action.path);
}

/** Entrée : le résultat sélectionné, ou la commande qui attend son argument ; sinon la ligne entière. */
function enter() {
	const entry = listing.entries[selected];
	if (entry && !entry.action) return write(entry.line);
	const result = entry?.action ?? run(line(), context);
	// Une ligne qui ne résout rien laisse la Lunette ouverte, telle quelle.
	if ('kind' in result) act(result);
}

input.addEventListener('input', update);

input.addEventListener('keydown', (event) => {
	const { key, ctrlKey } = event;
	// Le meilleur résultat est en bas : ↑ remonte vers les moins bons.
	const move = key === 'ArrowUp' || (ctrlKey && key === 'p') ? 1 : key === 'ArrowDown' || (ctrlKey && key === 'n') ? -1 : 0;
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
	bar?.removeAttribute('data-mode');
	if (showcmd) showcmd.textContent = '';
});

/** Ouvre la Lunette, avec la frappe déjà tapée ; déjà ouverte, lui rend le focus. */
export function open(typed = '') {
	if (dialog.open) return input.focus();
	if (!dialog.isConnected) {
		document.head.append(el('style', '', css));
		document.body.append(dialog);
	}
	write(typed);
	bar?.setAttribute('data-mode', 'command');
	// Modale : la page est inerte, Échap ferme, et le focus revient où il était.
	dialog.showModal();
}
