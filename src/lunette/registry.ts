// Le registre des commandes de la Lunette (ADR 0007) : un module pur, sans DOM, que les tests importent
// sous Node. La Lunette lui passe la ligne tapée et le contexte de la page ; il lui rend la liste à
// afficher, meilleur résultat en tête, et l'action que la ligne résout. Chaque commande déclare son nom,
// ses alias, sa portée, son aide et son argument : en ajouter une ne touche ni au filtre ni à la Lunette.
import { identity, pages, projects, sectionKeys, sections, type SectionKey } from '../data/profile.ts';
import { smile } from './smile.ts';
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
 * Ce que fait une commande : la Lunette l'exécute. `show` garde la Lunette ouverte sur ce Volet. `yank`
 * copie `text` dans le presse-papiers, puis fait écho de la copie (`copied`) ou de son échec (`failed`).
 * `aim` vise une pièce, `lecture` coche la lecture des notes, `tour` lance ou arrête le tour de la règle.
 */
export type Action =
	| { kind: 'go'; path: string }
	| { kind: 'show'; pane: Pane }
	| { kind: 'yank'; text: string; copied: string; failed: string }
	/** Une adresse hors du site, ouverte dans un nouvel onglet. */
	| { kind: 'open'; url: string }
	| { kind: 'aim'; piece: string }
	| { kind: 'lecture'; value: 'clair' | 'code' }
	| { kind: 'tour'; play: boolean }
	/** L'écran fermé sous un aplat d'encre (`:q!` sur l'accueil), jusqu'à Échap ou `:e`. */
	| { kind: 'quit' };

/** L'action d'une commande, ou l'erreur que répondrait Vim, écrite dans l'écho. */
export type Result = Action | { error: string };

/**
 * Ce que montre le Volet pour un résultat : l'Aperçu d'un projet, la note d'une pièce, ou l'aide d'une
 * commande ; celle de `:help` seul liste en plus les commandes de la page. La sortie de `:checkhealth` et
 * de `:version` se lit dans le navigateur et dans le build : la Lunette la compose, le registre ne fait
 * que la nommer.
 */
export type Pane =
	| { kind: 'project'; slug: string }
	| { kind: 'note'; name: string; title: string; text: string }
	| { kind: 'help'; name: string; text: string; commands?: { name: string; text: string }[] }
	| { kind: 'health' }
	| { kind: 'version' }
	/** Un dessin en mono, réduit à la largeur du Volet (`:smile`). */
	| { kind: 'art'; title: string; lines: string[] }
	/** L'arbre de netrw (`:Ex`) ; `at` est la ligne de la page sélectionnée. */
	| { kind: 'tree'; title: string; lines: string[]; at: number }
	/** La stack façon lazy.nvim (`:Lazy`). */
	| { kind: 'plugins'; title: string; plugins: Plugin[] };

/**
 * Un outil de la stack : « loaded » s'il sert au premier rendu, « lazy » s'il ne charge qu'à la demande.
 * La Lunette lit la version de `package` dans les valeurs du build ; le registre, sous Node, ne la voit pas.
 */
export interface Plugin {
	name: string;
	package?: string;
	role: string;
	state: 'loaded' | 'lazy';
}

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
	/** Une aide qui dépend de la page cite ce qui n'existe que sur certaines (la lecture des notes). */
	help: Localized<string> | ((context: Context) => string);
	/**
	 * Une liste à choisir : Tab sur la commande y passe, Entrée aussi si la commande ne se lance pas
	 * seule. `unknown` est l'erreur d'une valeur qui ne répond à aucun choix ; absente ou sans erreur (une
	 * option hors de sa portée), le E492 de la ligne.
	 */
	argument?: {
		title: Localized<string>;
		enter: Localized<string>;
		choices: (context: Context) => Choice[];
		unknown?: (value: string, context: Context) => string | undefined;
	};
	/** Sans argument. Absente, la commande en exige un. */
	run?: (context: Context) => Result;
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
	action?: Result;
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

/** Le nom du champ où l'on tape une commande, dans la Lunette comme sur l'écran de `:q!`. */
export const commandLabel: Localized<string> = { fr: 'Commande', en: 'Command' };

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

/** Un nom dans la langue de la page, qu'il en change ou non. */
const localized = (name: string | Localized<string>, locale: Locale) => (typeof name === 'string' ? name : name[locale]);

/** Ce que `pick` donne dans chaque langue autre que celle de la page : les noms que le filtre accepte aussi. */
const inOthers = (locale: Locale, pick: (other: Locale) => string) => locales.filter((other) => other !== locale).map(pick);

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

/** Le nom de l'option dans chaque langue : `lecture`, `view`. */
const lectureNames = locales.map((locale) => lectureOf.clair.label[locale].split('=')[0]);

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
					others: inOthers(locale, (other) => label[other]),
					pane: { kind: 'help', name: label[locale], text: help[locale] },
					action: { kind: 'lecture', value },
				};
			})
		: [];

const yankHelp: Localized<string> = {
	fr: 'Copie l’adresse mail de Louis dans le presse-papiers, comme yy : :yank mail.',
	en: 'Copies Louis’s email address to the clipboard, like yy: :yank mail.',
};

const shellHelp: Localized<string> = {
	fr: 'Ouvre le profil GitHub ou la config Neovim de Louis, dans un nouvel onglet : :!github, :!nvim.',
	en: 'Opens Louis’s GitHub profile or Neovim config, in a new tab: :!github, :!nvim.',
};

/** La copie de l'adresse, et ses deux échos : l'échec la donne en clair, pour la copier à la main. */
const yankMail = ({ locale }: Context): Action => {
	const { email } = identity;
	return {
		kind: 'yank',
		text: email,
		copied: { fr: `"${email}" copiée dans le presse-papiers`, en: `"${email}" copied to the clipboard` }[locale],
		failed: { fr: `Copie impossible, l’adresse à la main : ${email}`, en: `Couldn’t copy, the address by hand: ${email}` }[locale],
	};
};

/** Sur une figure, l'aide cite aussi la lecture des notes, sous son nom dans la langue de la page. */
const setHelp = ({ figure, locale }: Context) => {
	const lecture = `:set ${lectureOf.clair.label[locale]}|${lectureOf.code.label[locale].split('=')[1]}`;
	return figure
		? {
				fr: `Change une option : :set lang=en ouvre cette page en anglais, ${lecture} lit les notes de la figure en clair ou en code.`,
				en: `Sets an option: :set lang=fr opens this page in French, ${lecture} reads the figure notes in plain words or as code.`,
			}[locale]
		: {
				fr: 'Change une option : :set lang=en ouvre cette page en anglais.',
				en: 'Sets an option: :set lang=fr opens this page in French.',
			}[locale];
};

/**
 * Les pages du site en arborescence, façon netrw : le français à la racine, l'anglais sous `en/`. Les
 * mêmes que celles du sitemap ; chacune montre au Volet l'arbre entier, elle-même marquée.
 */
function explorer(): Choice[] {
	const paths = locales.flatMap((locale) => pages.map((page) => pathOf(page, locale)));
	// La ligne de chaque dossier de l'arbre, par son chemin relatif (`en/projects/`) ; la racine d'abord.
	const rows = new Map([['', 0]]);
	const lines = ['./'];
	const relative = (path: string) => path.slice(1);
	for (const path of paths) {
		let dir = '';
		relative(path)
			.split('/')
			.filter(Boolean)
			.forEach((part, depth) => {
				dir += `${part}/`;
				if (rows.has(dir)) return;
				rows.set(dir, lines.length);
				lines.push(`${'| '.repeat(depth + 1)}${part}/`);
			});
	}
	return paths.map((path) => ({
		label: relative(path) || './',
		pane: { kind: 'tree', title: 'netrw', lines, at: rows.get(relative(path)) ?? 0 },
		action: go(path),
	}));
}

/** La stack du site, ce qui sert au premier rendu d'abord, comme les « Loaded » de lazy.nvim. */
const stack: (Omit<Plugin, 'name' | 'role'> & { name: string | Localized<string>; role: Localized<string> })[] = [
	{ name: 'astro', package: 'astro', role: { fr: 'les pages, rendues au build', en: 'the pages, rendered at build time' }, state: 'loaded' },
	{ name: 'typescript', package: 'typescript', role: { fr: 'les types, vérifiés au build', en: 'the types, checked at build time' }, state: 'loaded' },
	{ name: 'Archivo', role: { fr: 'les titres et le texte', en: 'headings and text' }, state: 'loaded' },
	{ name: 'Fragment Mono', role: { fr: 'la barre d’état et les commandes', en: 'the status bar and commands' }, state: 'loaded' },
	{ name: { fr: 'écouteur', en: 'listener' }, role: { fr: ':, gg, ]] et yy, avec la page', en: ':, gg, ]] and yy, with the page' }, state: 'loaded' },
	{ name: { fr: 'aperçu', en: 'preview' }, role: { fr: 'la figure à côté des projets, sur grand écran', en: 'the figure next to the projects, on wide screens' }, state: 'lazy' },
	{ name: 'figures', role: { fr: 'les anatomies animées des fiches', en: 'the animated anatomies of project pages' }, state: 'lazy' },
	{ name: { fr: 'Lunette', en: 'Telescope' }, role: { fr: 'cette fenêtre, à la première commande', en: 'this window, on the first command' }, state: 'lazy' },
];

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
			choices: (context) =>
				sectionKeys.map((key, i) => ({
					label: sections[key].label[context.locale],
					others: inOthers(context.locale, (other) => sections[key].label[other]),
					aliases: namesOf(sectionCommands[i]),
					detail: `:${sections[key].id[context.locale]}`,
					pane: helpOf(sectionCommands[i], context),
					action: go(sectionPath(key, context.locale)),
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
		name: 'yank',
		aliases: ['y'],
		help: yankHelp,
		argument: {
			title: { fr: 'À copier', en: 'To copy' },
			enter: { fr: 'copier', en: 'copy' },
			choices: (context) => [
				{
					label: 'mail',
					aliases: ['email'],
					detail: identity.email,
					pane: { kind: 'help', name: 'yank', text: yankHelp[context.locale] },
					action: yankMail(context),
				},
			],
		},
		// Le `:yank` de Vim copie la ligne courante ; ici, il n'y a que l'adresse à copier.
		run: yankMail,
	},
	{
		// Le `:!` de Vim lance une commande du shell ; ici, il ouvre les liens de Louis.
		name: '!',
		help: shellHelp,
		argument: {
			title: { fr: 'Liens', en: 'Links' },
			enter: { fr: 'ouvrir dans un onglet', en: 'open in a tab' },
			choices: ({ locale }) =>
				Object.entries({ github: identity.links.github, nvim: identity.links.nvimConfig }).map(([label, url]) => ({
					label,
					detail: url.replace(/^https:\/\//, ''),
					pane: { kind: 'help', name: '!', text: shellHelp[locale] },
					action: { kind: 'open', url },
				})),
		},
	},
	{
		// « Écrire, puis partir » : le `:wq` de la section contact, que celui de la barre d'état annonce.
		name: 'wq',
		aliases: ['x', 'xit'],
		help: {
			fr: 'Écrire, puis partir : descend jusqu’au contact, ou y ramène depuis une fiche. :x aussi.',
			en: 'Write, then quit: scrolls down to the contact, or takes you back there from a project page. :x too.',
		},
		run: ({ locale }) => go(sectionPath('contact', locale)),
	},
	{
		name: 'q',
		aliases: ['quit'],
		help: { fr: 'Quitte la page : d’une fiche, revient à l’accueil.', en: 'Quits the page: from a project page, goes back home.' },
		// Sur l'accueil, il n'y a nulle part où revenir : Vim refuse de quitter un tampon modifié.
		// Ailleurs, un simple changement d'adresse : le nom de la fiche vole jusqu'à sa ligne (ADR 0004).
		run: ({ page, locale }) => (page.kind === 'home' ? { error: 'E37: No write since last change (add ! to override)' } : go(pathOf(home, locale))),
	},
	{
		name: 'q!',
		aliases: ['quit!'],
		help: { fr: 'Quitte sans enregistrer : d’une fiche, revient à l’accueil.', en: 'Quits without saving: from a project page, goes back home.' },
		run: ({ page, locale }) => (page.kind === 'home' ? { kind: 'quit' } : go(pathOf(home, locale))),
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
							pane: { kind: 'help', name: 'set', text: setHelp(context) },
							action: go(pathOf(context.page, locale)),
						}),
					),
				...lectures(context),
			],
			// Hors d'une figure, l'option de lecture n'existe pas, comme les commandes de la fiche.
			unknown: (value, { figure }) => (figure || !lectureNames.includes(value.split('=')[0]) ? `E474: Invalid argument: ${value}` : undefined),
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
		name: 'checkhealth',
		aliases: ['che'],
		help: {
			fr: 'Mesure la visite en cours : LCP, CLS et INP, avec leur seuil et un verdict.',
			en: 'Measures the current visit: LCP, CLS and INP, with their threshold and a verdict.',
		},
		run: () => ({ kind: 'show', pane: { kind: 'health' } }),
	},
	{
		name: 'version',
		aliases: ['ve'],
		help: {
			fr: 'Montre le commit et la date du build, et la version d’Astro.',
			en: 'Shows the commit and date of the build, and the Astro version.',
		},
		run: () => ({ kind: 'show', pane: { kind: 'version' } }),
	},
	{
		name: 'smile',
		help: { fr: 'L’easter egg de Neovim.', en: 'Neovim’s easter egg.' },
		run: () => ({ kind: 'show', pane: { kind: 'art', title: 'smile', lines: smile } }),
	},
	{
		name: 'Ex',
		aliases: ['Explore'],
		help: { fr: 'Parcourt les pages du site, façon netrw.', en: 'Browses the pages of the site, netrw style.' },
		argument: {
			title: { fr: 'Pages', en: 'Pages' },
			enter: { fr: 'ouvrir la page', en: 'open the page' },
			choices: explorer,
		},
	},
	{
		name: 'Lazy',
		// Le gestionnaire des outils de Neovim : ici, les mêmes.
		aliases: ['Mason'],
		help: { fr: 'La stack du site, façon gestionnaire de plugins.', en: 'The stack of the site, plugin manager style.' },
		run: ({ locale }) => ({
			kind: 'show',
			pane: {
				kind: 'plugins',
				title: 'lazy.nvim',
				plugins: stack.map(({ name, role, ...rest }) => ({ ...rest, name: localized(name, locale), role: role[locale] })),
			},
		}),
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
					const pane = helpOf(command, context);
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
				commands: inScope(context).map((command) => helpOf(command, context)),
			},
		}),
	},
];

const runLabel: Localized<string> = { fr: 'lancer', en: 'run' };

const nameOf = (command: Command, locale: Locale) => localized(command.name, locale);

/** Tous les noms qu'accepte une commande tapée en entier : les deux langues et les alias. */
const namesOf = (command: Command) => [...locales.map((locale) => nameOf(command, locale)), ...(command.aliases ?? [])];

/** Ses noms dans les autres langues, que le filtre accepte aussi (`career` sur une page française). */
const othersOf = (command: Command, locale: Locale) => inOthers(locale, (other) => nameOf(command, other));

const helpOf = (command: Command, context: Context) => ({
	kind: 'help' as const,
	name: nameOf(command, context.locale),
	text: typeof command.help === 'function' ? command.help(context) : command.help[context.locale],
});

const inScope = (context: Context) => commands.filter((command) => command.scope?.(context) ?? true);

/** La commande d'un nom tapé en entier, dans l'une ou l'autre langue, si la page la permet. */
const find = (name: string, context: Context) => inScope(context).find((command) => namesOf(command).includes(name));

/** La ligne sans le `:` que tape un vimiste par réflexe ; comme Vim, les espaces autour ne comptent pas. */
const unprefixed = (line: string) => line.replace(/^[\s:]*/, '');

/** Sans les espaces de fin non plus : la ligne telle que la cite une erreur, ou que le filtre cherche. */
const clean = (line: string) => unprefixed(line).trimEnd();

/**
 * Le nom de la commande, puis son argument s'il a commencé : après une espace, ou tout de suite derrière
 * un nom fait d'un signe (`:!github`). Sans argument, la ligne est un nom en cours de frappe.
 */
function parse(line: string): { name: string; argument?: string } {
	const [, name = '', space, rest] = unprefixed(line).match(/^([A-Za-z]+!?|[^\sA-Za-z])?(\s*)(.*)$/) ?? [];
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
		// Derrière un nom fait d'un signe, l'argument suit sans espace, comme dans Vim (`:!github`).
		const prefix = nameOf(command, locale).replace(/[A-Za-z]$/, '$& ');
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
			pane: helpOf(command, context),
			line: command.argument ? `${label} ` : label,
			action: command.run?.(context),
		})),
		total: available.length,
	};
}

/** L'action d'une ligne entière, validée sans choisir de résultat ; ou l'erreur que répondrait Vim. */
export function run(line: string, context: Context): Result {
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
	const error = command.argument.unknown?.(value, context);
	return error ? { error } : unknown;
}

/**
 * Vrai si la ligne est la commande `name` seule, sous l'un de ses noms, sans argument et le `!` de Vim
 * admis : le `:e` qui rouvre l'écran de `:q!`.
 */
export function bare(line: string, name: string): boolean {
	const typed = parse(line);
	const command = commands.find((command) => namesOf(command).includes(name));
	return !!command && !typed.argument?.trim() && namesOf(command).includes(typed.name.replace(/!$/, ''));
}

/** Le contexte d'une page d'après son adresse, ou rien hors des pages du site. */
export function contextAt(pathname: string): Context | undefined {
	for (const locale of locales) {
		for (const page of pages) {
			if (pathOf(page, locale) === pathname) return { page, locale };
		}
	}
	return undefined;
}
