// Le registre des commandes de la Lunette (ADR 0007) : un module pur, sans DOM, que les tests importent
// sous Node. La Lunette lui passe la ligne tapée et le contexte de la page ; il lui rend la liste à
// afficher, meilleur résultat en tête, et l'action que la ligne résout. Chaque commande déclare son nom,
// ses alias, sa portée, son aide et son argument : en ajouter une ne touche ni au filtre ni à la Lunette.
import { projects, sections } from '../data/profile.ts';
import { fiche, home, locales, pathOf, type Locale, type Localized, type Page } from '../lib/i18n.ts';

/** Ce que la page offre aux commandes. Les tickets suivants y ajoutent la figure (temps, pièces). */
export interface Context {
	page: Page;
	locale: Locale;
}

/** Ce que fait une commande : la Lunette l'exécute. */
export type Action = { kind: 'go'; path: string };

/** Ce que montre le Volet pour un résultat : l'Aperçu d'un projet, ou l'aide d'une commande. */
export type Pane = { kind: 'project'; slug: string } | { kind: 'help'; name: string; text: string };

/** Une valeur proposée à l'argument d'une commande (un projet pour `:e`). */
interface Choice {
	label: string;
	/** Acceptés tapés en entier, sans être affichés (le slug d'un projet). */
	aliases?: string[];
	/** À droite de la ligne, en gris : le rang d'un projet. */
	detail?: string;
	pane?: Pane;
	action: Action;
}

interface Command {
	/** Le nom affiché ; une commande dont le nom change avec la langue l'a dans les deux. */
	name: string | Localized<string>;
	/** Les autres noms acceptés tapés en entier, comme le nom long de Vim (`edit` pour `e`). */
	aliases?: string[];
	/** Où la commande a un sens ; absente, partout. Hors de sa portée, elle n'existe pas. */
	scope?: (context: Context) => boolean;
	help: Localized<string>;
	/** Une liste à choisir : Entrée sur la commande y passe, au lieu de l'exécuter. */
	argument?: { title: Localized<string>; enter: Localized<string>; choices: (context: Context) => Choice[] };
	run?: (context: Context) => Action;
}

/** Une ligne de résultat : `hits` sont les positions des lettres trouvées dans `label`. */
export interface Entry {
	label: string;
	hits: number[];
	detail?: string;
	pane?: Pane;
	/** La ligne qu'écrit Tab sur ce résultat. */
	line: string;
	/** Absente quand Entrée passe à l'argument de la commande. */
	action?: Action;
}

export interface Listing {
	/** Le titre du cadre des résultats (« Projets »). */
	title: string;
	/** Le titre du cadre du prompt : la commande en cours (`:e`). */
	prompt: string;
	/** La saisie de l'argument, sans la commande : ce que montre le prompt sous son titre. */
	argument?: string;
	/** Ce que fait Entrée, pour la rangée d'aide. */
	enter: string;
	/** Filtrés, le meilleur en tête. */
	entries: Entry[];
	/** Le nombre de résultats avant le filtre. */
	total: number;
}

const go = (path: string): Action => ({ kind: 'go', path });

const rank = (index: number) => String(index + 1).padStart(2, '0');

const commands: Command[] = [
	{
		name: 'e',
		aliases: ['edit'],
		help: { fr: 'Ouvre la fiche d’un projet : :e trekker.', en: 'Opens a project page: :e trekker.' },
		argument: {
			title: sections.projects.label,
			enter: { fr: 'ouvrir la fiche', en: 'open the page' },
			choices: ({ locale }) =>
				projects.map((p, i) => ({
					label: p.repo,
					aliases: [p.slug],
					detail: rank(i),
					pane: { kind: 'project', slug: p.slug },
					action: go(pathOf(fiche(p.slug), locale)),
				})),
		},
	},
];

const commandsTitle: Localized<string> = { fr: 'Commandes', en: 'Commands' };
const runLabel: Localized<string> = { fr: 'lancer', en: 'run' };

const nameOf = (command: Command, locale: Locale) => (typeof command.name === 'string' ? command.name : command.name[locale]);

const inScope = (context: Context) => commands.filter((command) => command.scope?.(context) ?? true);

/** La commande d'un nom tapé en entier, dans l'une ou l'autre langue, si la page la permet. */
const find = (name: string, context: Context) =>
	inScope(context).find((command) => [...locales.map((locale) => nameOf(command, locale)), ...(command.aliases ?? [])].includes(name));

/** La ligne sans le `:` que tape un vimiste par réflexe. */
const clean = (line: string) => line.replace(/^\s*:*/, '').trimEnd();

/**
 * Le nom de la commande, puis son argument s'il a commencé : après une espace, ou tout de suite derrière
 * un nom fait d'un signe (`:!github`). Sans argument, la ligne est un nom en cours de frappe.
 */
function parse(line: string): { name: string; argument?: string } {
	const [, name = '', space, rest] = line.replace(/^\s*:*/, '').match(/^([A-Za-z]+!?|[^\sA-Za-z])?(\s*)(.*)$/) ?? [];
	return { name, argument: space || /^[^A-Za-z]/.test(name) ? rest : undefined };
}

const separator = /[-_. /]/;

/**
 * Le filtre flou, façon Telescope : les lettres de `query` dans l'ordre, pas forcément voisines, sans
 * tenir compte de la casse. Parmi les alignements possibles, le meilleur : le début du texte vaut 3,
 * un début de mot ou une lettre voisine de la précédente 2, une lettre au milieu d'un mot 0. À score
 * égal, la lettre la plus à gauche.
 */
function fuzzy(query: string, text: string): { score: number; hits: number[] } | undefined {
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	const bonus = (j: number) => (j === 0 ? 3 : separator.test(t[j - 1]) ? 2 : 0);
	// `row[j]` : le meilleur score de la lettre courante posée en `j` ; `back` : où était la précédente.
	let row: number[] = [];
	const backs: number[][] = [];
	for (let i = 0; i < q.length; i++) {
		const next: number[] = [];
		const back: number[] = [];
		// Le meilleur score de la lettre précédente posée au moins deux cases avant `j`.
		let best = -Infinity;
		let at = -1;
		for (let j = 0; j < t.length; j++) {
			if (j >= 2 && row[j - 2] > best) [best, at] = [row[j - 2], j - 2];
			next[j] = -Infinity;
			if (t[j] !== q[i]) continue;
			if (i === 0) {
				next[j] = bonus(j);
				continue;
			}
			const glued = (row[j - 1] ?? -Infinity) + Math.max(bonus(j), 2);
			const apart = best + bonus(j);
			[next[j], back[j]] = glued >= apart ? [glued, j - 1] : [apart, at];
		}
		row = next;
		backs.push(back);
	}
	let end = -1;
	for (let j = 0; j < t.length; j++) if (row[j] > (row[end] ?? -Infinity)) end = j;
	if (end < 0) return q ? undefined : { score: 0, hits: [] };
	const hits = [end];
	for (let i = q.length - 1; i > 0; i--) hits.unshift(backs[i][hits[0]]);
	return { score: row[end], hits };
}

/** Distance de la lettre à son début de mot : « s[t]atus » passe avant « poin[t]cloud ». */
const wordGap = (text: string, at: number) => {
	let start = at;
	while (start > 0 && !separator.test(text[start - 1])) start--;
	return at - start;
};

/**
 * Les éléments qui répondent à `query`, le meilleur en tête : le score, puis la première lettre la plus
 * près de son début de mot, puis le texte le plus court. Sans saisie, l'ordre d'origine.
 */
function filter<T extends { label: string }>(items: T[], query: string): (T & { hits: number[] })[] {
	const found = items.flatMap((item, index) => {
		const match = fuzzy(query, item.label);
		return match ? [{ item, index, ...match }] : [];
	});
	if (query) {
		found.sort(
			(a, b) =>
				b.score - a.score ||
				wordGap(a.item.label, a.hits[0]) - wordGap(b.item.label, b.hits[0]) ||
				a.item.label.length - b.item.label.length ||
				a.index - b.index,
		);
	}
	return found.map(({ item, hits }) => ({ ...item, hits }));
}

/** Ce que la Lunette affiche pour une ligne : les commandes de la page, ou les choix de l'argument. */
export function list(line: string, context: Context): Listing {
	const { locale } = context;
	const { name, argument } = parse(line);
	const command = argument === undefined ? undefined : find(name, context);
	if (command?.argument && argument !== undefined) {
		const choices = command.argument.choices(context);
		const prefix = `${nameOf(command, locale)} `;
		return {
			title: command.argument.title[locale],
			prompt: `:${nameOf(command, locale)}`,
			argument,
			enter: command.argument.enter[locale],
			entries: filter(choices, argument.trim()).map(({ label, hits, detail, pane, action }) => ({ label, hits, detail, pane, line: prefix + label, action })),
			total: choices.length,
		};
	}
	const available = inScope(context).map((command) => ({ command, label: nameOf(command, locale) }));
	return {
		title: commandsTitle[locale],
		prompt: argument === undefined ? ':' : `:${name}`,
		enter: runLabel[locale],
		// Une ligne qui a déjà un argument n'est plus un nom à compléter.
		entries: (argument === undefined ? filter(available, clean(line)) : []).map(({ command, label, hits }) => ({
			label,
			hits,
			pane: { kind: 'help', name: label, text: command.help[locale] },
			line: command.argument ? `${label} ` : label,
			action: command.argument ? undefined : command.run?.(context),
		})),
		total: available.length,
	};
}

/** L'action d'une ligne entière, validée sans choisir de résultat ; ou l'erreur que répondrait Vim. */
export function run(line: string, context: Context): Action | { error: string } {
	const unknown = { error: `E492: Not an editor command: ${clean(line)}` };
	const { name, argument } = parse(line);
	const command = find(name, context);
	if (!command) return unknown;
	if (!command.argument) return command.run?.(context) ?? unknown;
	const wanted = argument?.trim().toLowerCase();
	if (!wanted) return { error: 'E471: Argument required' };
	const choices = command.argument.choices(context);
	const exact = choices.find((choice) => [choice.label, ...(choice.aliases ?? [])].some((value) => value.toLowerCase() === wanted));
	return (exact ?? filter(choices, wanted)[0])?.action ?? unknown;
}

/** Le contexte d'une page d'après son adresse, ou rien hors des pages du site. */
export function contextAt(pathname: string): Context | undefined {
	for (const locale of locales) {
		for (const page of [home, ...projects.map((p) => fiche(p.slug))]) {
			if (pathOf(page, locale) === pathname) return { page, locale };
		}
	}
	return undefined;
}
