// Le registre des commandes de la Lunette (ADR 0007) : un module pur, sans DOM, que les tests importent
// sous Node. La Lunette lui passe la ligne tapée et le contexte de la page ; il lui rend la liste à
// afficher, meilleur résultat en tête, et l'action que la ligne résout. Chaque commande déclare son nom,
// ses alias, sa portée, son aide et son argument : en ajouter une ne touche ni au filtre ni à la Lunette.
import { projects, sectionKeys, sections, type SectionKey } from '../data/profile.ts';
import { fiche, home, locales, pathOf, type Locale, type Localized, type Page } from '../lib/i18n.ts';

/** Une pièce de la figure, lue dans la page : son crochet, son nom et sa note en clair. */
export interface FigurePiece {
	id: string;
	name: string;
	note: { title: string; text: string };
}

/** Ce que la page offre aux commandes. */
export interface Context {
	page: Page;
	locale: Locale;
	/** La figure d'une fiche : ses pièces dans l'ordre de la nomenclature, et si elle a une règle de temps. */
	figure?: { pieces: FigurePiece[]; timeline: boolean };
}

/**
 * Ce que fait une commande : la Lunette l'exécute. `show` garde la Lunette ouverte sur ce Volet ; `aim`
 * vise une pièce, `lecture` coche la lecture des notes, `tour` lance ou arrête le tour de la règle.
 */
export type Action =
	| { kind: 'go'; path: string }
	| { kind: 'show'; pane: Pane }
	| { kind: 'aim'; piece: string }
	| { kind: 'lecture'; value: 'clair' | 'code' }
	| { kind: 'tour'; play: boolean };

/**
 * Ce que montre le Volet pour un résultat : l'Aperçu d'un projet, la note d'une pièce, ou l'aide d'une
 * commande ; celle de `:help` seul liste en plus les commandes de la page.
 */
export type Pane =
	| { kind: 'project'; slug: string }
	| { kind: 'note'; name: string; title: string; text: string }
	| { kind: 'help'; name: string; text: string; commands?: { name: string; text: string }[] };

/** Une valeur proposée à l'argument d'une commande (un projet pour `:e`). */
interface Choice {
	label: string;
	/** Acceptés tapés en entier, sans être affichés (le slug d'un projet). */
	aliases?: string[];
	/** Le libellé dans l'autre langue : le filtre l'accepte aussi, et le montre s'il le trouve. */
	others?: string[];
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
	/**
	 * Une liste à choisir : Tab sur la commande y passe, Entrée aussi si la commande ne se lance pas
	 * seule. `unknown` est l'erreur d'une valeur qui ne répond à aucun choix (E492 de la ligne sinon).
	 */
	argument?: {
		title: Localized<string>;
		enter: Localized<string>;
		choices: (context: Context) => Choice[];
		unknown?: (value: string) => string;
	};
	/** Sans argument. Absente, la commande en exige un. */
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

const commandsTitle: Localized<string> = { fr: 'Commandes', en: 'Commands' };

const indexText: Localized<string> = {
	fr: 'Les commandes de cette page. :help <commande> en explique une.',
	en: 'The commands of this page. :help <command> explains one.',
};

const onFiche = ({ page }: Context) => page.kind === 'fiche';

/** La fiche voisine de la page, dans la boucle de « Autres projets » : après la sixième, la première. */
const neighbour =
	(step: number) =>
	({ page, locale }: Context): Action => {
		const at = projects.findIndex((p) => page.kind === 'fiche' && p.slug === page.slug);
		return go(pathOf(fiche(projects[(at + step + projects.length) % projects.length].slug), locale));
	};

const withFigure = ({ figure }: Context) => figure !== undefined;

const withTimeline = ({ figure }: Context) => figure?.timeline === true;

/**
 * Les deux lectures des notes, nommées comme la ligne de commande de la carte. Recopiées de
 * `ui.viewOption`, `ui.viewPlain` et `ui.viewCode` : importer `ui` mettrait toute la table des textes
 * dans le morceau d'i18n que l'aperçu de l'accueil partage avec la Lunette.
 */
const lectureOf = {
	clair: {
		label: { fr: 'lecture=clair', en: 'view=plain' },
		help: { fr: 'Lit les notes de la figure en clair : ce que fait chaque pièce.', en: 'Reads the figure notes in plain words: what each part does.' },
	},
	code: {
		label: { fr: 'lecture=code', en: 'view=code' },
		help: { fr: 'Lit les notes de la figure en code : le symbole et la signature de chaque pièce.', en: 'Reads the figure notes as code: the symbol and signature of each part.' },
	},
} satisfies Record<string, Record<'label' | 'help', Localized<string>>>;

/**
 * La lecture des notes, réglée comme la ligne de commande de la carte : `lecture=clair` sur une page
 * française, `view=plain` sur une page anglaise, le nom de l'autre langue accepté aussi.
 */
const lectures = ({ figure, locale }: Context): Choice[] =>
	figure
		? (['clair', 'code'] as const).map((value) => {
				const { label, help } = lectureOf[value];
				return {
					label: label[locale],
					others: locales.filter((other) => other !== locale).map((other) => label[other]),
					pane: { kind: 'help', name: label[locale], text: help[locale] },
					action: { kind: 'lecture', value },
				};
			})
		: [];

const setHelp: Localized<string> = {
	fr: 'Change une option : :set lang=en ouvre cette page en anglais.',
	en: 'Sets an option: :set lang=fr opens this page in French.',
};

/** L'ancre d'une section dans l'accueil de la page : depuis une fiche, on y revient. */
const sectionPath = (key: SectionKey, locale: Locale) => `${pathOf(home, locale)}#${sections[key].id[locale]}`;

/** Une commande par section de l'accueil, nommée comme son ancre : `:parcours`, `:career`. */
const sectionCommands = sectionKeys.map(
	(key): Command => ({
		name: sections[key].id,
		help: {
			fr: `Va à la section ${sections[key].label.fr} de l’accueil.`,
			en: `Goes to the ${sections[key].label.en} section of the home page.`,
		},
		run: ({ locale }) => go(sectionPath(key, locale)),
	}),
);

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
	...sectionCommands,
	{
		name: 'marks',
		help: { fr: 'Liste les sections de l’accueil, pour aller à l’une d’elles.', en: 'Lists the sections of the home page, to go to one.' },
		argument: {
			title: { fr: 'Sections', en: 'Sections' },
			enter: { fr: 'aller à la section', en: 'go to the section' },
			choices: ({ locale }) =>
				sectionKeys.map((key, i) => ({
					label: sections[key].label[locale],
					others: locales.filter((other) => other !== locale).map((other) => sections[key].label[other]),
					aliases: namesOf(sectionCommands[i]),
					detail: `:${sections[key].id[locale]}`,
					pane: helpOf(sectionCommands[i], locale),
					action: go(sectionPath(key, locale)),
				})),
		},
	},
	{
		name: 'bn',
		aliases: ['bnext'],
		scope: onFiche,
		help: { fr: 'Passe au projet suivant, dans la boucle des autres projets.', en: 'Goes to the next project, looping like Other projects.' },
		run: neighbour(1),
	},
	{
		name: 'bp',
		aliases: ['bprevious'],
		scope: onFiche,
		help: { fr: 'Revient au projet précédent, dans la boucle des autres projets.', en: 'Goes back to the previous project, looping like Other projects.' },
		run: neighbour(-1),
	},
	{
		name: 'q',
		aliases: ['quit'],
		// Sur l'accueil, `:q` n'a nulle part où revenir : sa réponse y est un easter egg (E37), pas un
		// retour. D'ici là, il n'y existe pas.
		scope: onFiche,
		help: { fr: 'Revient à l’accueil.', en: 'Goes back to the home page.' },
		// Un simple changement d'adresse : le nom de la fiche vole jusqu'à sa ligne de l'accueil (ADR 0004).
		run: ({ locale }) => go(pathOf(home, locale)),
	},
	{
		name: 'set',
		aliases: ['se'],
		help: setHelp,
		argument: {
			title: { fr: 'Options', en: 'Options' },
			enter: { fr: 'appliquer', en: 'apply' },
			// L'autre version d'abord, sélectionnée d'office : c'est la seule qui change quelque chose.
			choices: (context) => [
				...[...locales]
					.sort((a, b) => Number(a === context.locale) - Number(b === context.locale))
					.map(
						(locale): Choice => ({
							label: `lang=${locale}`,
							pane: { kind: 'help', name: 'set', text: setHelp[context.locale] },
							action: go(pathOf(context.page, locale)),
						}),
					),
				...lectures(context),
			],
			unknown: (value) => `E474: Invalid argument: ${value}`,
		},
	},
	{
		name: 'pieces',
		scope: withFigure,
		help: {
			fr: 'Liste les pièces de la figure ; Entrée vise la pièce choisie, avec son viseur et sa note.',
			en: 'Lists the parts of the figure; Enter aims at the chosen part, with its viewfinder and note.',
		},
		argument: {
			title: { fr: 'Pièces', en: 'Parts' },
			enter: { fr: 'viser la pièce', en: 'aim at the part' },
			// Numérotées comme la nomenclature, et visables par ce numéro tapé en entier (`:pieces 03`).
			choices: ({ figure }) =>
				(figure?.pieces ?? []).map(({ id, name, note }, i) => ({
					label: name,
					aliases: [rank(i), id],
					detail: rank(i),
					pane: { kind: 'note', name, ...note },
					action: { kind: 'aim', piece: id },
				})),
			unknown: (value) => `E426: Tag not found: ${value}`,
		},
	},
	{
		name: 'play',
		scope: withTimeline,
		help: { fr: 'Lance le tour de la règle de temps.', en: 'Starts the tour of the time ruler.' },
		run: () => ({ kind: 'tour', play: true }),
	},
	{
		name: 'pause',
		scope: withTimeline,
		help: { fr: 'Arrête le tour de la règle de temps.', en: 'Stops the tour of the time ruler.' },
		run: () => ({ kind: 'tour', play: false }),
	},
	{
		name: 'help',
		aliases: ['h'],
		help: {
			fr: 'Liste les commandes de la page, ou explique l’une d’elles : :help e.',
			en: 'Lists the commands of this page, or explains one: :help e.',
		},
		argument: {
			title: commandsTitle,
			enter: { fr: 'lire l’aide', en: 'read the help' },
			// Les commandes de la page seulement : une commande hors de portée n'existe pas, son aide non plus.
			choices: (context) =>
				inScope(context).map((command) => {
					const pane = helpOf(command, context.locale);
					return { label: pane.name, others: othersOf(command, context.locale), aliases: namesOf(command), pane, action: { kind: 'show', pane } };
				}),
			unknown: (value) => `E149: Sorry, no help for ${value}`,
		},
		run: (context) => ({
			kind: 'show',
			pane: {
				kind: 'help',
				name: 'help',
				text: indexText[context.locale],
				commands: inScope(context).map((command) => helpOf(command, context.locale)),
			},
		}),
	},
];

const runLabel: Localized<string> = { fr: 'lancer', en: 'run' };

const nameOf = (command: Command, locale: Locale) => (typeof command.name === 'string' ? command.name : command.name[locale]);

/** Tous les noms qu'accepte une commande tapée en entier : les deux langues et les alias. */
const namesOf = (command: Command) => [...locales.map((locale) => nameOf(command, locale)), ...(command.aliases ?? [])];

/** Ses noms dans les autres langues, que le filtre accepte aussi (`career` sur une page française). */
const othersOf = (command: Command, locale: Locale) => locales.filter((other) => other !== locale).map((other) => nameOf(command, other));

const helpOf = (command: Command, locale: Locale) => ({ kind: 'help' as const, name: nameOf(command, locale), text: command.help[locale] });

const inScope = (context: Context) => commands.filter((command) => command.scope?.(context) ?? true);

/** La commande d'un nom tapé en entier, dans l'une ou l'autre langue, si la page la permet. */
const find = (name: string, context: Context) => inScope(context).find((command) => namesOf(command).includes(name));

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
 * près de son début de mot, puis le texte le plus court. Sans saisie, l'ordre d'origine. Un élément que
 * son libellé ne trouve pas répond par ses noms dans l'autre langue (`others`), et prend celui trouvé.
 */
function filter<T extends { label: string; others?: string[] }>(items: T[], query: string): (T & { hits: number[] })[] {
	const found = items.flatMap((item, index) => {
		for (const label of [item.label, ...(item.others ?? [])]) {
			const match = fuzzy(query, label);
			if (match) return [{ item: { ...item, label }, index, ...match }];
		}
		return [];
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
	const available = inScope(context).map((command) => ({ command, label: nameOf(command, locale), others: othersOf(command, locale) }));
	return {
		title: commandsTitle[locale],
		prompt: argument === undefined ? ':' : `:${name}`,
		enter: runLabel[locale],
		// Une ligne qui a déjà un argument n'est plus un nom à compléter.
		entries: (argument === undefined ? filter(available, clean(line)) : []).map(({ command, label, hits }) => ({
			label,
			hits,
			pane: helpOf(command, locale),
			line: command.argument ? `${label} ` : label,
			action: command.run?.(context),
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
	const value = argument?.trim() ?? '';
	if (!value) return command.run?.(context) ?? { error: 'E471: Argument required' };
	const wanted = value.toLowerCase();
	const choices = command.argument.choices(context);
	const exact = choices.find((choice) => [choice.label, ...(choice.aliases ?? [])].some((alias) => alias.toLowerCase() === wanted));
	const action = (exact ?? filter(choices, wanted)[0])?.action;
	if (action) return action;
	const { unknown: missing } = command.argument;
	return missing ? { error: missing(value) } : unknown;
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
