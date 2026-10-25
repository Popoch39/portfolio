// Contenus du portfolio, séparés du balisage : modifier ce fichier suffit à mettre
// la page à jour. Règle de contenu : ni téléphone, ni adresse, ni date de naissance.

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
	role: string;
	/** Intitulé complet, affiché dans le héros. */
	roleDetail: string;
	city: string;
	country: string;
	/** Langages principaux, dans l'ordre d'affichage. */
	languages: string[];
	/** Langages pratiqués ponctuellement (« un peu de … »). */
	sideLanguages: string[];
	/** Compétences déclarées aux moteurs de recherche (JSON-LD `knowsAbout`). */
	skills: string[];
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
	label: string;
	items: string[];
}

/** Stack par catégorie, dans l'ordre d'affichage (section Stack, et compétences du JSON-LD). */
export const stack: StackCategory[] = [
	{ label: 'Langages', items: ['TypeScript', 'Rust', 'PHP', 'SQL', 'Go', 'Lua'] },
	{ label: 'Back-end', items: ['NestJS', 'Laravel', 'Axum', 'Elysia', 'Node', 'GraphQL', 'REST'] },
	{ label: 'Front-end', items: ['React', 'Next.js', 'Vue', 'Vite', 'Tailwind'] },
	{ label: 'Data', items: ['PostgreSQL', 'Redis', 'Prisma', 'Drizzle'] },
	{ label: 'DevOps', items: ['Docker', 'CI/CD', 'Cloudflare', 'AWS', 'Sentry'] },
	{ label: 'Outils', items: ['Bun', 'Monorepo', 'Git', 'Neovim', 'tmux', 'Agile/Scrum'] },
	{ label: 'Carto & 3D', items: ['OpenLayers', 'MapLibre GL', 'PostGIS', 'Three.js'] },
];

export interface DailyTool {
	/** Rôle de l'outil (« éditeur »). */
	role: string;
	name: string;
}

/** Outils du quotidien, sous la stack (la config Neovim est dans `identity.links.nvimConfig`). */
export const dailyTools: DailyTool[] = [
	{ role: 'éditeur', name: 'neovim' },
	{ role: 'multiplexeur', name: 'tmux' },
	{ role: 'runtime', name: 'bun' },
];

const givenName = 'Louis';
const familyName = 'Pocheron';
const languages = ['TypeScript', 'PHP', 'Rust'];
const sideLanguages = ['Go', 'Lua'];
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
	role: 'Concepteur & développeur d’applications',
	roleDetail: 'Concepteur & développeur d’applications, fullstack',
	city: 'Besançon',
	country: 'France',
	languages,
	sideLanguages,
	skills: [
		'Développement d’applications web fullstack',
		'Conception d’API',
		'Cartographie web (SIG)',
		...stack.flatMap((category) => category.items),
	],
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

export interface PageMeta {
	title: string;
	description: string;
	/** Couleur de l'interface du navigateur : le fond de la page. */
	themeColor: string;
	/** Image d'aperçu du lien partagé (Open Graph, Twitter, JSON-LD). */
	shareImage: ShareImage;
}

export const pageMeta: PageMeta = {
	title: `${identity.name} — Concepteur & développeur d’applications fullstack, ${identity.city}`,
	description: `${identity.name}, concepteur & développeur d’applications fullstack à ${identity.city} : API, interfaces web et outils de développement en ${identity.languages.join(', ')}. Projets, parcours, activité GitHub et stack.`,
	themeColor: '#f3f3ef',
	shareImage: {
		// Produite par `pnpm og:capture` à partir de `scripts/og-composition.html`, puis versionnée.
		path: '/og.png',
		width: 1200,
		height: 630,
		alt: `${identity.name} en lettres capitales condensées, suivi d’un curseur bleu, avec la mention « ${identity.roleDetail} — ${identity.city} ».`,
	},
};

export interface Section {
	/** Ancre de la section (`#id`), partagée par la navigation et la section elle-même. */
	id: string;
	label: string;
}

/** Sections de la page, dans l'ordre : la navigation de l'en-tête en dérive. */
export const sections: Section[] = [
	{ id: 'projets', label: 'Projets' },
	{ id: 'parcours', label: 'Parcours' },
	{ id: 'activite', label: 'Activité' },
	{ id: 'stack', label: 'Stack' },
	{ id: 'contact', label: 'Contact' },
];

/** Mots du bandeau noir sous le héros, dans l'ordre d'affichage. */
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
	 * Segment de l'adresse de la fiche (`/projets/<slug>/`). Ni point ni tiret bas : certains
	 * hébergeurs prennent « .nvim » pour une extension, et Google déconseille « _ » entre les mots.
	 */
	slug: string;
	description: string;
	stack: string[];
	year: number;
}

/** Projets mis en avant, dans l'ordre d'affichage. Certains dépôts sont volontairement absents. */
export const projects: Project[] = [
	{
		repo: 'typomaniac',
		slug: 'typomaniac',
		description:
			'Jeu de dactylo multijoueur : runs solo, duels classés en Bo3, MMR et classement. Serveur de duel autoritaire en WebSocket.',
		stack: ['TypeScript', 'Elysia', 'Bun', 'React 19'],
		year: 2026,
	},
	{
		repo: 'claude-tmux-notify.nvim',
		slug: 'claude-tmux-notify',
		description:
			'Un toast Neovim quand une session Claude Code, dans une autre fenêtre tmux, vous attend.',
		stack: ['Lua', 'Neovim', 'tmux', '★ 3'],
		year: 2026,
	},
	{
		repo: 'claude-status-line',
		slug: 'claude-status-line',
		description:
			'L’usage d’abonnement Claude Code dans la status line — binaire Bun multi-plateforme, installeur curl | sh.',
		stack: ['TypeScript', 'Bun'],
		year: 2026,
	},
	{
		repo: 'pointcloud-viewer',
		slug: 'pointcloud-viewer',
		description:
			'Nuages de points LiDAR dans le navigateur — parsing en Rust compilé en WebAssembly, rendu three.js.',
		stack: ['Rust', 'WASM', 'React', 'three.js'],
		year: 2026,
	},
	{
		repo: 'trekker',
		slug: 'trekker',
		description:
			'API de catalogue de randonnées — NestJS 11, Drizzle et Postgres, contrats Zod partagés en monorepo.',
		stack: ['TypeScript', 'NestJS', 'Drizzle'],
		year: 2026,
	},
	{
		repo: 'ma_parcelle',
		slug: 'ma-parcelle',
		description:
			'Tout ce que les données publiques disent d’une parcelle, sur une carte plein écran — sans compte, sans serveur.',
		stack: ['React 19', 'Vite', 'MapLibre'],
		year: 2026,
	},
];

/** Nombre de dépôts publics sur GitHub, relevé à la main (affiché dans l'en-tête des projets). */
export const publicRepoCount = 41;

// ── Parcours et formation (section 02) ──

/** Mention de l'en-tête de la section Parcours. */
export const careerSummary = '~4 ans · santé, énergie, sport';

export interface Position {
	/** Année de début, affichée en grand à titre décoratif. */
	year: number;
	period: string;
	city: string;
	company: string;
	role: string;
	missions: string[];
	/** Poste actuel, signalé par un filet bleu. */
	current?: boolean;
}

/** Étapes professionnelles, de la plus récente à la plus ancienne. Les clients restent anonymes. */
export const career: Position[] = [
	{
		year: identity.employer.since,
		period: 'mars 2023 → aujourd’hui',
		city: identity.employer.city,
		company: identity.employer.name,
		role: 'Concepteur & développeur d’applications',
		current: true,
		missions: [
			'Back-office d’une plateforme de santé — NestJS 11, Prisma, PostgreSQL, GraphQL, React 19',
			'Micro-services Rust (Axum) — serveur de tuiles, fichiers CAD, nuages de points',
			'Applications cartographiques pour un grand acteur de l’énergie — Laravel 12, React 19',
			'Plateforme mobile terrain avec mode hors-ligne — React Native',
			'Monorepos, Docker, CI/CD, Cloudflare Workers, authentification',
		],
	},
	{
		year: 2022,
		period: 'fév. 2022 → fév. 2023',
		city: 'Dijon',
		company: 'Conseil départemental olympique et sportif',
		role: 'Concepteur & développeur d’applications',
		missions: [
			'Application web sous Symfony',
			'Application mobile React Native',
			'API back-end en Node.js / TypeScript (Express)',
		],
	},
	{
		year: 2021,
		period: 'sept. → déc. 2021',
		city: 'Doucier',
		company: 'Jordel Média',
		role: 'Stage — développeur web',
		missions: ['Nouvelles fonctionnalités sur le CMS interne de l’entreprise'],
	},
];

export interface Education {
	period: string;
	degree: string;
	school: string;
}

/** Formation, de la plus récente à la plus ancienne. */
export const education: Education[] = [
	{ period: '2022 — 2023', degree: 'Concepteur & développeur d’applications', school: 'Access Code School, Besançon' },
	{ period: '2020 — 2021', degree: 'Développeur web & développeur mobile', school: 'Access Code School, Besançon' },
	{ period: '2018 — 2020', degree: 'Langues étrangères appliquées (LEA)', school: 'UFR SLHS, Besançon' },
	{ period: '2018', degree: 'Baccalauréat économique et social', school: 'Lycée Carnot, Dijon' },
];
