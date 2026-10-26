// Les deux langues du site et l'adresse de chaque page dans chacune (ADR 0002). Sans import :
// la config d'Astro et les scripts Node le lisent tel quel.

export const locales = ['fr', 'en'] as const;

export type Locale = (typeof locales)[number];

/** Le français, à la racine : ses URL sont celles d'avant l'anglais. */
export const defaultLocale: Locale = 'fr';

/** Une valeur par langue : le typecheck refuse un texte qui n'a pas ses deux langues. */
export type Localized<T> = Record<Locale, T>;

/**
 * La langue d'une page, d'après `Astro.currentLocale`. Astro la déduit du préfixe de l'URL et
 * retombe sur la langue par défaut sans préfixe : une autre valeur est une erreur de config.
 */
export function localeOf(currentLocale: string | undefined): Locale {
	const locale = locales.find((candidate) => candidate === currentLocale);
	if (!locale) throw new Error(`Langue inconnue : ${currentLocale}. L'i18n d'astro.config.mjs doit reprendre \`locales\`.`);
	return locale;
}

/** Une page du site, sans sa langue. `slug` est le segment de la fiche, commun aux deux langues. */
export type Page = { kind: 'home' } | { kind: 'fiche'; slug: string };

export const home: Page = { kind: 'home' };

export const fiche = (slug: string): Page => ({ kind: 'fiche', slug });

/** La version désignée par `x-default` : l'anglais, pour qui ne lit aucune des deux langues (ADR 0002). */
const xDefaultLocale: Locale = 'en';

/** Segment des fiches : Astro ne traduit pas les segments, ce module s'en charge. */
const ficheSegment: Localized<string> = { fr: 'projets', en: 'projects' };

/**
 * L'adresse d'une page dans une langue, slash final compris : c'est son URL canonique. Seule source
 * des liens internes, de la canonique, des `hreflang` et du sitemap, pour qu'ils ne divergent jamais.
 */
export function pathOf(page: Page, locale: Locale): string {
	const prefix = locale === defaultLocale ? '/' : `/${locale}/`;
	return page.kind === 'home' ? prefix : `${prefix}${ficheSegment[locale]}/${page.slug}/`;
}

/**
 * Les alternatives d'une page, pour ses `hreflang` et le sitemap : chaque version, elle-même
 * comprise, puis `x-default`.
 */
export const alternatesOf = (page: Page): { hreflang: string; path: string }[] => [
	...locales.map((locale) => ({ hreflang: formats[locale].lang, path: pathOf(page, locale) })),
	{ hreflang: 'x-default', path: pathOf(page, xDefaultLocale) },
];

/** Les formats de chaque langue : `Intl`, `og:locale`, et `lang` du document comme des `hreflang`. */
export const formats: Localized<{ intl: string; ogLocale: string; lang: string }> = {
	fr: { intl: 'fr-FR', ogLocale: 'fr_FR', lang: 'fr' },
	en: { intl: 'en-GB', ogLocale: 'en_GB', lang: 'en' },
};

/**
 * La copie d'interface des composants (titres de section, mentions, libellés ARIA, boutons). Une
 * entrée est un texte, ou une fonction quand le texte compose des valeurs ; chacune a ses deux langues.
 */
export const ui = {
	// Héros : l'accroche, son mot en bleu, et les faits.
	heroLede: {
		fr: { before: 'Je conçois des applications web ', emphasis: 'de bout en bout', after: ' — l’API, l’interface, et les outils qui rendent le tout agréable à développer.' },
		en: { before: 'I build web applications ', emphasis: 'end to end', after: ' — the API, the interface, and the tooling that makes it all a pleasure to work on.' },
	},
	role: { fr: 'Rôle', en: 'Role' },
	languages: { fr: 'Langages', en: 'Languages' },
	today: { fr: 'Aujourd’hui', en: 'Currently' },
	languagesLine: {
		fr: (main: string[], side: string[]) => `${main.join(', ')} — un peu de ${side.join(' et de ')}`,
		en: (main: string[], side: string[]) => `${main.join(', ')} — plus some ${side.join(' and ')}`,
	},
	employerLine: {
		fr: (name: string, city: string, since: number) => `${name}, ${city} — depuis ${since}`,
		en: (name: string, city: string, since: number) => `${name}, ${city} — since ${since}`,
	},
	write: { fr: 'Écrire', en: 'Email me' },
	// Projets.
	projectsNote: {
		fr: (count: number, repos: number) => `${count} sélectionnés · ${repos} dépôts publics`,
		en: (count: number, repos: number) => `${count} selected · ${repos} public repos`,
	},
	openFiche: { fr: 'Ouvrir la fiche →', en: 'Open project page →' },
	openFicheLabel: {
		fr: (repo: string) => `Ouvrir la fiche ${repo}`,
		en: (repo: string) => `Open the ${repo} project page`,
	},
	// Parcours.
	education: { fr: 'Formation', en: 'Education' },
	// Activité.
	activityTotal: { fr: 'contributions sur GitHub, ces 12 derniers mois', en: 'contributions on GitHub in the last 12 months' },
	activeDays: {
		fr: (days: string) => `jours actifs, sur ${days}`,
		en: (days: string) => `active days, out of ${days}`,
	},
	longestStreak: { fr: 'plus longue série', en: 'longest streak' },
	recordDay: {
		fr: (day: string) => `record, le ${day}`,
		en: (day: string) => `best day, ${day}`,
	},
	perDay: { fr: 'Contributions par jour', en: 'Contributions per day' },
	hoverCell: { fr: 'survolez une case', en: 'hover over a square' },
	perDayLegend: { fr: 'contributions / jour', en: 'contributions / day' },
	perMonth: { fr: 'Contributions par mois', en: 'Contributions per month' },
	monthlyData: { fr: 'Voir les données par mois', en: 'Show monthly data' },
	month: { fr: 'Mois', en: 'Month' },
	contributions: { fr: 'Contributions', en: 'Contributions' },
	// Stack.
	dailyTool: {
		fr: (role: string, name: string) => `${role} : ${name}`,
		en: (role: string, name: string) => `${role}: ${name}`,
	},
	configOnGitHub: { fr: 'la config est sur GitHub', en: 'the config is on GitHub' },
	// Contact.
	pitch: {
		fr: 'Une API, une interface, un outil à construire ? Écrivez-moi. Ouvert au remote.',
		en: 'An API, an interface, a tool that needs building? Drop me a line. Open to remote.',
	},
	nvimConfig: { fr: 'Config Neovim ↗', en: 'Neovim config ↗' },
	// Barre d'état : le total de l'activité, et la position façon Neovim (« Bot » en anglais).
	statusContributions: {
		fr: (total: string) => `${total} contributions · 12 mois`,
		en: (total: string) => `${total} contributions · 12 months`,
	},
	statusBottom: { fr: 'Bas', en: 'Bot' },
	// Fiche : héros, en-tête de l'anatomie, nomenclature, repère, règle de temps, autres projets et
	// barre d'état. Les textes de l'anatomie elle-même viennent de son module.
	ficheFile: {
		fr: (repo: string) => `~/projets/${repo}.md`,
		en: (repo: string) => `~/projects/${repo}.md`,
	},
	ficheRank: {
		fr: (rank: string, total: string) => `projet ${rank} / ${total}`,
		en: (rank: string, total: string) => `project ${rank} / ${total}`,
	},
	year: { fr: 'Année', en: 'Year' },
	repository: { fr: 'Dépôt', en: 'Repository' },
	anatomy: { fr: 'Anatomie', en: 'Anatomy' },
	anatomyNote: {
		fr: (parts: number) => `${parts} pièces · une seule les compte`,
		en: (parts: number) => `${parts} parts · only one counts`,
	},
	// La césure conditionnelle coupe « Nomenclature » sur un téléphone étroit plutôt que déborder.
	partsList: { fr: 'Nomen­clature', en: 'Parts list' },
	keyPart: { fr: 'pièce maîtresse', en: 'key part' },
	codeLink: {
		fr: (path: string, first: number, last: number) => `Code : ${path}, lignes ${first}–${last} ↗`,
		en: (path: string, first: number, last: number) => `Code: ${path}, lines ${first}–${last} ↗`,
	},
	calloutLines: {
		fr: (file: string, first: number, last: number) => `${file}, lignes ${first}–${last}`,
		en: (file: string, first: number, last: number) => `${file}, lines ${first}–${last}`,
	},
	calloutTotal: {
		fr: (lines: number) => ` · ${lines} lignes en tout`,
		en: (lines: number) => ` · ${lines} lines in total`,
	},
	startTour: { fr: 'Lancer le tour', en: 'Start the tour' },
	otherProjects: { fr: 'Autres projets', en: 'Other projects' },
	previous: {
		fr: (rank: string) => `← précédent · ${rank}`,
		en: (rank: string) => `← previous · ${rank}`,
	},
	next: {
		fr: (rank: string) => `${rank} · suivant →`,
		en: (rank: string) => `${rank} · next →`,
	},
	statusFiche: {
		fr: (repo: string) => `~/louis/projets/${repo}.md`,
		en: (repo: string) => `~/louis/projects/${repo}.md`,
	},
	statusParts: {
		fr: (fig: number, parts: number) => `Fig. ${fig} · ${parts} pièces`,
		en: (fig: number, parts: number) => `Fig. ${fig} · ${parts} parts`,
	},
} satisfies Record<string, Localized<unknown>>;
