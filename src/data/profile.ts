// Contenus du portfolio, séparés du balisage : modifier ce fichier suffit à mettre
// la page à jour. Règle de contenu : ni téléphone, ni adresse, ni date de naissance.
// Chaque texte affiché a ses deux langues côte à côte (`Localized`), le français au-dessus ;
// les faits (années, stack, dépôts, entreprises, villes, liens) restent écrits une seule fois.
import { defaultLocale, fiche, home, pathOf, type Locale, type Localized, type Page } from '../lib/i18n.ts';

export interface Employer {
	name: string;
	city: string;
	since: number;
}

export interface Identity {
	givenName: string;
	familyName: string;
	name: string;
	/** Intitulé court, affiché dans l'en-tête du site. */
	role: Localized<string>;
	/** Intitulé complet, affiché dans le héros. */
	roleDetail: Localized<string>;
	city: string;
	country: string;
	/** Langages principaux, dans l'ordre d'affichage. */
	languages: string[];
	/** Langages pratiqués ponctuellement (« un peu de … »). */
	sideLanguages: string[];
	/** Compétences déclarées aux moteurs de recherche (JSON-LD `knowsAbout`). */
	skills: Localized<string[]>;
	employer: Employer;
	email: string;
	github: {
		/** « Popoch39 » */
		handle: string;
		/** URL du profil sans protocole, pour l'affichage : « github.com/Popoch39 ». */
		profile: string;
	};
	links: {
		github: string;
		nvimConfig: string;
	};
}

export interface StackCategory {
	label: Localized<string>;
	items: string[];
}

/** Stack par catégorie, dans l'ordre d'affichage (section Stack, et compétences du JSON-LD). */
export const stack: StackCategory[] = [
	{ label: { fr: 'Langages', en: 'Languages' }, items: ['TypeScript', 'Rust', 'PHP', 'SQL', 'Go', 'Lua'] },
	{ label: { fr: 'Back-end', en: 'Back-end' }, items: ['NestJS', 'Laravel', 'Axum', 'Elysia', 'Node', 'GraphQL', 'REST'] },
	{ label: { fr: 'Front-end', en: 'Front-end' }, items: ['React', 'Next.js', 'Vue', 'Vite', 'Tailwind'] },
	{ label: { fr: 'Data', en: 'Data' }, items: ['PostgreSQL', 'Redis', 'Prisma', 'Drizzle'] },
	{ label: { fr: 'DevOps', en: 'DevOps' }, items: ['Docker', 'CI/CD', 'Cloudflare', 'AWS', 'Sentry'] },
	{ label: { fr: 'Outils', en: 'Tooling' }, items: ['Bun', 'Monorepo', 'Git', 'Neovim', 'tmux', 'Agile/Scrum'] },
	{ label: { fr: 'Carto & 3D', en: 'Mapping & 3D' }, items: ['OpenLayers', 'MapLibre GL', 'PostGIS', 'Three.js'] },
];

export interface DailyTool {
	/** Rôle de l'outil (« éditeur »). */
	role: Localized<string>;
	name: string;
}

/** Outils du quotidien, sous la stack (la config Neovim est dans `identity.links.nvimConfig`). */
export const dailyTools: DailyTool[] = [
	{ role: { fr: 'éditeur', en: 'editor' }, name: 'neovim' },
	{ role: { fr: 'multiplexeur', en: 'multiplexer' }, name: 'tmux' },
	{ role: { fr: 'runtime', en: 'runtime' }, name: 'bun' },
];

const givenName = 'Louis';
const familyName = 'Pocheron';
const languages = ['TypeScript', 'PHP', 'Rust'];
const sideLanguages = ['Go', 'Lua'];
const stackItems = stack.flatMap((category) => category.items);
// L'identifiant GitHub est la seule source : profil, liens et dépôts en dérivent.
const githubHandle = 'Popoch39';
const githubProfile = `github.com/${githubHandle}`;
const githubUrl = `https://${githubProfile}`;

/** URL d'un dépôt du compte GitHub. */
export const githubRepoUrl = (repo: string) => `${githubUrl}/${repo}`;

export const identity: Identity = {
	givenName,
	familyName,
	name: `${givenName} ${familyName}`,
	role: { fr: 'Concepteur & développeur d’applications', en: 'Full-stack developer' },
	roleDetail: { fr: 'Concepteur & développeur d’applications, fullstack', en: 'Full-stack developer' },
	city: 'Besançon',
	country: 'France',
	languages,
	sideLanguages,
	skills: {
		fr: ['Développement d’applications web fullstack', 'Conception d’API', 'Cartographie web (SIG)', ...stackItems],
		en: ['Full-stack web application development', 'API design', 'Web mapping (GIS)', ...stackItems],
	},
	employer: { name: 'Da Viking Code', city: 'Dijon', since: 2023 },
	email: 'pocheron.louis@gmail.com',
	github: { handle: githubHandle, profile: githubProfile },
	links: {
		github: githubUrl,
		nvimConfig: githubRepoUrl('nvim'),
	},
};

export interface ShareImage {
	/** Chemin depuis la racine du site ; l'URL absolue dérive de l'URL du site. */
	path: string;
	width: number;
	height: number;
	alt: string;
}

/** Couleur de l'interface du navigateur : le fond de la page. */
export const themeColor = '#f3f3ef';

/**
 * La mention de l'image de partage de l'accueil, sous le nom : `pnpm og:capture` l'écrit dans
 * `scripts/og-composition.html`, et le texte alternatif la cite.
 */
export const shareCaption: Localized<{ role: string; place: string }> = {
	fr: { role: identity.roleDetail.fr, place: identity.city },
	en: { role: `${identity.roleDetail.en} · open to remote`, place: identity.country },
};

export interface PageMeta {
	title: string;
	description: string;
	/** Image d'aperçu du lien partagé (Open Graph, Twitter, JSON-LD). */
	shareImage: ShareImage;
}

/** Le `<head>` de l'accueil. Les images sont produites par `pnpm og:capture`, puis versionnées. */
export const pageMeta: Localized<PageMeta> = {
	fr: {
		title: `${identity.name} — Concepteur & développeur d’applications fullstack, ${identity.city}`,
		description: `${identity.name}, concepteur & développeur d’applications fullstack à ${identity.city} : API, interfaces web et outils de développement en ${identity.languages.join(', ')}. Ouvert au remote. Projets, parcours, activité GitHub et stack.`,
		shareImage: {
			path: '/og.png',
			width: 1200,
			height: 630,
			alt: `${identity.name} en lettres capitales condensées, suivi d’un curseur bleu, avec la mention « ${shareCaption.fr.role} — ${shareCaption.fr.place} ».`,
		},
	},
	en: {
		title: `${identity.name} — Full-stack developer (TypeScript, Rust) · ${identity.country}`,
		description: `${identity.name}, full-stack developer based in ${identity.country}: APIs, web interfaces and developer tooling in ${identity.languages.join(', ')}. Open to remote. Projects, career, GitHub activity and stack.`,
		shareImage: {
			path: '/og.en.png',
			width: 1200,
			height: 630,
			alt: `${identity.name} in condensed capitals, followed by a blue cursor, with the line “${shareCaption.en.role} — ${shareCaption.en.place}”.`,
		},
	},
};

export interface Section {
	/** Ancre de la section (`#id`) dans chaque langue, partagée par la navigation et la section elle-même. */
	id: Localized<string>;
	label: Localized<string>;
}

/** Sections de la page, dans l'ordre : la navigation de l'en-tête en dérive. */
export const sectionKeys = ['projects', 'career', 'activity', 'stack', 'contact'] as const;

export type SectionKey = (typeof sectionKeys)[number];

export const sections: Record<SectionKey, Section> = {
	projects: { id: { fr: 'projets', en: 'projects' }, label: { fr: 'Projets', en: 'Projects' } },
	career: { id: { fr: 'parcours', en: 'career' }, label: { fr: 'Parcours', en: 'Career' } },
	activity: { id: { fr: 'activite', en: 'activity' }, label: { fr: 'Activité', en: 'Activity' } },
	stack: { id: { fr: 'stack', en: 'stack' }, label: { fr: 'Stack', en: 'Stack' } },
	contact: { id: { fr: 'contact', en: 'contact' }, label: { fr: 'Contact', en: 'Contact' } },
};

/** Mots du bandeau noir entre Projets et Parcours, dans l'ordre d'affichage. */
export const marqueeWords: string[] = [
	'TypeScript',
	'React',
	'Node',
	'Rust',
	'Neovim',
	'NestJS',
	'Laravel',
	'Bun',
	'Axum',
	'Elysia',
	'Next.js',
	'PostgreSQL',
	'Lua',
	'Go',
];

export interface Project {
	/** Nom du dépôt sous le compte GitHub de `identity.github` : c'est aussi le nom affiché. */
	repo: string;
	/**
	 * Segment de l'adresse de la fiche (`/projets/<slug>/`), le même dans les deux langues. Ni point
	 * ni tiret bas : certains hébergeurs prennent « .nvim » pour une extension, et Google déconseille
	 * « _ » entre les mots.
	 */
	slug: string;
	description: Localized<string>;
	stack: string[];
	/** Langage principal du dépôt (JSON-LD `programmingLanguage` de la fiche). */
	language: string;
	year: number;
}

/**
 * Adresse du SVG au repos autonome d'un projet (`src/pages/figures/[slug].svg.ts`) : un par version,
 * puisque son libellé accessible est un texte de l'anatomie.
 */
export const restFigurePath = (project: Project, locale: Locale = defaultLocale) => `${pathOf(home, locale)}figures/${project.slug}.svg`;

/**
 * Adresse de l'image de partage d'une fiche dans une langue (`public/og/<slug>.png`, l'anglaise en
 * `.en.png` à côté, comme celle de l'accueil) : la française garde l'adresse d'avant l'anglais.
 */
export const shareImagePath = (project: Project, locale: Locale) =>
	`/og/${project.slug}${locale === defaultLocale ? '' : `.${locale}`}.png`;

/**
 * Image de partage d'une fiche dans une langue, produite par `pnpm og:capture` à partir de
 * `scripts/og-fiche.html`, puis versionnée. `machine` nomme sa figure (`AnatomyContent.machine`).
 */
export const shareImageOf = (project: Project, machine: string, locale: Locale): ShareImage => ({
	path: shareImagePath(project, locale),
	width: 1200,
	height: 630,
	alt: {
		fr: `${project.repo} en lettres capitales condensées, suivi d’un curseur bleu, avec sa figure au repos, « ${machine} », dessinée en isométrie ; en pied, la stack ${project.stack.join(' · ')} et ${identity.name}.`,
		en: `${project.repo} in condensed capitals, followed by a blue cursor, with its figure at rest, “${machine}”, drawn in isometric view; along the bottom, the stack ${project.stack.join(' · ')} and ${identity.name}.`,
	}[locale],
});

/** Projets mis en avant, dans l'ordre d'affichage. Certains dépôts sont volontairement absents. */
export const projects: Project[] = [
	{
		repo: 'typomaniac',
		slug: 'typomaniac',
		description: {
			fr: 'Jeu de dactylo multijoueur : runs solo, duels classés en Bo3, MMR et classement. Serveur de duel autoritaire en WebSocket.',
			en: 'Multiplayer typing game: solo runs, ranked best-of-three duels, MMR and a leaderboard. Authoritative WebSocket duel server.',
		},
		stack: ['TypeScript', 'Elysia', 'Bun', 'React 19'],
		language: 'TypeScript',
		year: 2026,
	},
	{
		repo: 'claude-tmux-notify.nvim',
		slug: 'claude-tmux-notify',
		description: {
			fr: 'Un toast Neovim quand une session Claude Code, dans une autre fenêtre tmux, vous attend.',
			en: 'A Neovim toast when a Claude Code session in another tmux window is waiting for you.',
		},
		stack: ['Lua', 'Neovim', 'tmux', '★ 3'],
		language: 'Lua',
		year: 2026,
	},
	{
		repo: 'claude-status-line',
		slug: 'claude-status-line',
		description: {
			fr: 'L’usage d’abonnement Claude Code dans la status line — binaire Bun multi-plateforme, installeur curl | sh.',
			en: 'Claude Code subscription usage in the status line — cross-platform Bun binary, curl | sh installer.',
		},
		stack: ['TypeScript', 'Bun'],
		language: 'TypeScript',
		year: 2026,
	},
	{
		repo: 'pointcloud-viewer',
		slug: 'pointcloud-viewer',
		description: {
			fr: 'Nuages de points LiDAR dans le navigateur — parsing en Rust compilé en WebAssembly, rendu three.js.',
			en: 'LiDAR point clouds in the browser — parsing in Rust compiled to WebAssembly, rendering with three.js.',
		},
		stack: ['Rust', 'WASM', 'React', 'three.js'],
		language: 'Rust',
		year: 2026,
	},
	{
		repo: 'trekker',
		slug: 'trekker',
		description: {
			fr: 'API de catalogue de randonnées — NestJS 11, Drizzle et Postgres, contrats Zod partagés en monorepo.',
			en: 'Hiking trail catalogue API — NestJS 11, Drizzle and Postgres, Zod contracts shared across a monorepo.',
		},
		stack: ['TypeScript', 'NestJS', 'Drizzle'],
		language: 'TypeScript',
		year: 2026,
	},
	{
		repo: 'ma_parcelle',
		slug: 'ma-parcelle',
		description: {
			fr: 'Tout ce que les données publiques disent d’une parcelle, sur une carte plein écran — sans compte, sans serveur.',
			en: 'Everything French open data says about a land parcel, on a full-screen map — no account, no server.',
		},
		stack: ['React 19', 'Vite', 'MapLibre'],
		language: 'TypeScript',
		year: 2026,
	},
];

/** Les pages du site, sans leur langue : celles du sitemap, que `:Ex` parcourt aussi. */
export const pages: Page[] = [home, ...projects.map((project) => fiche(project.slug))];

/** Nombre de dépôts publics sur GitHub, relevé à la main (affiché dans l'en-tête des projets). */
export const publicRepoCount = 41;

// ── Parcours et formation (section 02) ──

/** Mention de l'en-tête de la section Parcours. */
export const careerSummary: Localized<string> = {
	fr: '~4 ans · santé, énergie, sport',
	en: '~4 years · healthcare, energy, sport',
};

export interface Position {
	/** Année de début, affichée en grand à titre décoratif. */
	year: number;
	period: Localized<string>;
	city: string;
	company: string;
	role: Localized<string>;
	missions: Localized<string>[];
	/** Poste actuel, signalé par un filet bleu. */
	current?: boolean;
}

/** Étapes professionnelles, de la plus récente à la plus ancienne. Les clients restent anonymes. */
export const career: Position[] = [
	{
		year: identity.employer.since,
		period: { fr: 'mars 2023 → aujourd’hui', en: 'Mar 2023 → present' },
		city: identity.employer.city,
		company: identity.employer.name,
		role: { fr: 'Concepteur & développeur d’applications', en: 'Full-stack developer' },
		current: true,
		missions: [
			{
				fr: 'Back-office d’une plateforme de santé — NestJS 11, Prisma, PostgreSQL, GraphQL, React 19',
				en: 'Back office for a healthcare platform — NestJS 11, Prisma, PostgreSQL, GraphQL, React 19',
			},
			{
				fr: 'Micro-services Rust (Axum) — serveur de tuiles, fichiers CAD, nuages de points',
				en: 'Rust microservices (Axum) — tile server, CAD files, point clouds',
			},
			{
				fr: 'Applications cartographiques pour un grand acteur de l’énergie — Laravel 12, React 19',
				en: 'Mapping applications for a major energy company — Laravel 12, React 19',
			},
			{
				fr: 'Plateforme mobile terrain avec mode hors-ligne — React Native',
				en: 'Offline-first mobile platform for field teams — React Native',
			},
			{
				fr: 'Monorepos, Docker, CI/CD, Cloudflare Workers, authentification',
				en: 'Monorepos, Docker, CI/CD, Cloudflare Workers, authentication',
			},
		],
	},
	{
		year: 2022,
		period: { fr: 'fév. 2022 → fév. 2023', en: 'Feb 2022 → Feb 2023' },
		city: 'Dijon',
		company: 'Conseil départemental olympique et sportif',
		role: { fr: 'Concepteur & développeur d’applications', en: 'Full-stack developer' },
		missions: [
			{ fr: 'Application web sous Symfony', en: 'Web application built with Symfony' },
			{ fr: 'Application mobile React Native', en: 'React Native mobile app' },
			{ fr: 'API back-end en Node.js / TypeScript (Express)', en: 'Back-end API in Node.js / TypeScript (Express)' },
		],
	},
	{
		year: 2021,
		period: { fr: 'sept. → déc. 2021', en: 'Sept → Dec 2021' },
		city: 'Doucier',
		company: 'Jordel Média',
		role: { fr: 'Stage — développeur web', en: 'Internship — web developer' },
		missions: [{ fr: 'Nouvelles fonctionnalités sur le CMS interne de l’entreprise', en: 'New features for the company’s in-house CMS' }],
	},
];

export interface Education {
	period: string;
	/** Le nom du diplôme en français ; en anglais, un équivalent, suivi du nom d'origine. */
	degree: Localized<string>;
	school: string;
}

/** Formation, de la plus récente à la plus ancienne. */
export const education: Education[] = [
	{
		period: '2022 — 2023',
		degree: {
			fr: 'Concepteur & développeur d’applications',
			en: 'Application Designer & Developer, bachelor’s-level vocational qualification',
		},
		school: 'Access Code School, Besançon',
	},
	{
		period: '2020 — 2021',
		degree: {
			fr: 'Développeur web & développeur mobile',
			en: 'Web & Mobile Developer, foundation-degree-level vocational qualification',
		},
		school: 'Access Code School, Besançon',
	},
	{
		period: '2018 — 2020',
		degree: { fr: 'Langues étrangères appliquées (LEA)', en: 'Applied Foreign Languages, university studies' },
		school: 'UFR SLHS, Besançon',
	},
	{
		period: '2018',
		degree: {
			fr: 'Baccalauréat économique et social',
			en: 'French baccalaureate, economics & social sciences, A-level equivalent',
		},
		school: 'Lycée Carnot, Dijon',
	},
];
