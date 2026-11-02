/**
 * Portfolio content: the single source for the page, its metadata and its JSON-LD.
 * Strings are visitor-facing copy, hence in French.
 */

export const person = {
	givenName: 'Louis',
	familyName: 'Pocheron',
	name: 'Louis Pocheron',
	jobTitle: 'Concepteur & développeur d’applications',
	email: 'pocheron.louis@gmail.com',
	city: 'Besançon',
	country: 'FR',
	coordinates: '47.2378° N 6.0241° E',
	github: { user: 'Popoch39', url: 'https://github.com/Popoch39' },
	nvimConfig: 'https://github.com/Popoch39/nvim',
} as const;

export const marqueeWords = [
	'TypeScript',
	'Rust',
	'React',
	'Node',
	'Neovim',
	'PostGIS',
	'MapLibre',
	'Axum',
	'NestJS',
	'Laravel',
	'Bun',
	'Go',
	'Lua',
	'Three.js',
];

export interface Project {
	repo: string;
	description: string;
	stack: string;
	year: number;
}

export const projects: Project[] = [
	{
		repo: 'pointcloud-viewer',
		description: 'Nuages de points LiDAR dans le navigateur — bake Rust → WebAssembly, rendu three.js sur MapLibre.',
		stack: 'Rust · WASM · React · three.js',
		year: 2026,
	},
	{
		repo: 'ma_parcelle',
		description: 'Tout ce que les données publiques disent d’une parcelle cadastrale, sur une carte plein écran.',
		stack: 'React 19 · Vite · MapLibre',
		year: 2026,
	},
	{
		repo: 'maptile_cacher',
		description: 'Couche de cache rapide pour tuiles cartographiques.',
		stack: 'Rust',
		year: 2026,
	},
	{
		repo: 'claude-tmux-notify.nvim',
		description: 'Un toast Neovim quand une session Claude Code, dans une autre fenêtre tmux, vous attend.',
		stack: 'Lua · Neovim · tmux · ★ 3',
		year: 2026,
	},
	{
		repo: 'claude-status-line',
		description: 'L’usage d’abonnement Claude Code dans la status line — binaire Bun multi-plateforme.',
		stack: 'TypeScript · Bun',
		year: 2026,
	},
	{
		repo: 'gis_3d',
		description: 'Terrain 3D et géodonnées dans le navigateur — expérimentations, démo en ligne.',
		stack: 'TypeScript · Next.js',
		year: 2025,
	},
];

export interface Position {
	/** First month in the job, `YYYY-MM`. */
	start: string;
	/** Last month in the job, `YYYY-MM`; none for the current one. */
	end?: string;
	company: string;
	city: string;
	role: string;
	internship?: boolean;
	missions: string[];
}

export const positions: Position[] = [
	{
		start: '2023-03',
		company: 'Da Viking Code',
		city: 'Dijon',
		role: person.jobTitle,
		missions: [
			'SIG & cartographie pour un grand acteur de l’énergie — OpenLayers, PostGIS, Laravel 12, React 19',
			'Back-office d’une plateforme de santé — NestJS 11, Prisma, PostgreSQL, GraphQL',
			'SIG mobile terrain avec mode hors-ligne — MapLibre GL, React Native',
			'Micro-services Rust (Axum) — serveur de tuiles, fichiers CAD, nuages de points',
			'Monorepos, Docker, CI/CD, Cloudflare Workers, authentification',
		],
	},
	{
		start: '2022-02',
		end: '2023-02',
		company: 'Conseil départemental olympique et sportif',
		city: 'Dijon',
		role: person.jobTitle,
		missions: [
			'Application web sous Symfony',
			'Application mobile React Native',
			'API back-end en Node.js / TypeScript (Express)',
		],
	},
	{
		start: '2021-09',
		end: '2021-12',
		company: 'Jordel Média',
		city: 'Doucier',
		role: 'Stage — développeur web',
		internship: true,
		missions: ['Nouvelles fonctionnalités sur le CMS interne de l’entreprise'],
	},
];

export const salariedPositions = positions.filter((position) => !position.internship);

export const currentPosition = positions.find((position) => !position.end);

export const profile = {
	role: `${person.jobTitle}, fullstack`,
	specialty: 'SIG & cartographie à échelle industrielle',
	today: currentPosition && `${currentPosition.company}, ${currentPosition.city} — depuis ${year(currentPosition.start)}`,
};

const monthAndYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

function year(month: string) {
	return month.slice(0, 4);
}

function firstDayOf(month: string) {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1));
}

/** Section and project numbering: `1` → `01`. */
export function twoDigits(n: number) {
	return String(n).padStart(2, '0');
}

/** "mars 2023 → aujourd’hui", "févr. 2022 → févr. 2023", or "sept. → déc. 2021" within a single year. */
export function formatPeriod({ start, end }: Pick<Position, 'start' | 'end'>) {
	if (!end) return `${monthAndYear.format(firstDayOf(start))} → aujourd’hui`;
	const from = year(start) === year(end) ? monthOnly : monthAndYear;
	return `${from.format(firstDayOf(start))} → ${monthAndYear.format(firstDayOf(end))}`;
}

export interface Education {
	period: string;
	title: string;
	school: string;
	city: string;
}

export const education: Education[] = [
	{
		period: '2022 — 2023',
		title: 'Concepteur & développeur d’applications',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{
		period: '2020 — 2021',
		title: 'Développeur web & développeur mobile',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{ period: '2018 — 2020', title: 'Langues étrangères appliquées (LEA)', school: 'UFR SLHS', city: 'Besançon' },
	{ period: '2018', title: 'Baccalauréat économique et social', school: 'Lycée Carnot', city: 'Dijon' },
];

/**
 * In order from the base of the Atome's tower to its top: one bague per category.
 * `accent` marks the specialty, drawn in the accent colour wherever it sits in the list.
 */
export const stack: { category: string; items: string[]; accent?: true }[] = [
	{ category: 'Langages', items: ['TypeScript', 'Rust', 'PHP', 'SQL', 'Go', 'Lua'] },
	{ category: 'Back-end', items: ['NestJS', 'Laravel', 'Axum', 'Elysia', 'Node', 'GraphQL', 'REST'] },
	{ category: 'Front-end', items: ['React', 'Next.js', 'Vue', 'Vite', 'Tailwind'] },
	{
		category: 'SIG · CAD · 3D',
		items: ['OpenLayers', 'MapLibre GL', 'PostGIS', 'Turf.js', 'Three.js', 'DWG/DXF'],
		accent: true,
	},
	{ category: 'Data', items: ['PostgreSQL', 'Redis', 'Prisma', 'Drizzle'] },
	{ category: 'DevOps', items: ['Docker', 'CI/CD', 'Cloudflare', 'AWS', 'Sentry'] },
	{ category: 'Outils', items: ['Bun', 'Monorepo', 'Git', 'Neovim', 'tmux', 'Agile/Scrum'] },
];

/**
 * Stack tool → logo file in `src/assets/logos/` (its simple-icons slug). A tool listed here gets a
 * pastille on its bague; the others stay in the label only. AWS is left out on purpose (see the
 * logos' README).
 */
export const toolLogos: Record<string, string> = {
	TypeScript: 'typescript',
	Rust: 'rust',
	PHP: 'php',
	Go: 'go',
	Lua: 'lua',
	NestJS: 'nestjs',
	Laravel: 'laravel',
	Node: 'nodedotjs',
	GraphQL: 'graphql',
	React: 'react',
	'Next.js': 'nextdotjs',
	Vue: 'vuedotjs',
	Vite: 'vite',
	Tailwind: 'tailwindcss',
	OpenLayers: 'openlayers',
	'MapLibre GL': 'maplibre',
	'Three.js': 'threedotjs',
	PostgreSQL: 'postgresql',
	Redis: 'redis',
	Prisma: 'prisma',
	Drizzle: 'drizzle',
	Docker: 'docker',
	Cloudflare: 'cloudflare',
	Sentry: 'sentry',
	Bun: 'bun',
	Git: 'git',
	Neovim: 'neovim',
	tmux: 'tmux',
};

/** Whole years since the first salaried position (internships do not count), at build time. */
export function yearsOfExperience(now = new Date()) {
	const first = salariedPositions.map((position) => position.start).sort()[0];
	const [year, month] = first.split('-').map(Number);
	const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
	return Math.floor(months / 12);
}

/**
 * Public repository count, read from GitHub at build time.
 * Unreachable API: `undefined`, and the page leaves the count out rather than show a stale one.
 */
export async function publicRepoCount(): Promise<number | undefined> {
	try {
		const response = await fetch(`https://api.github.com/users/${person.github.user}`, {
			headers: { Accept: 'application/vnd.github+json' },
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
		const { public_repos } = (await response.json()) as { public_repos: number };
		return public_repos;
	} catch (error) {
		console.warn(`[profile] public repository count left out: ${error instanceof Error ? error.message : error}`);
		return undefined;
	}
}
