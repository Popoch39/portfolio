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

export interface Mission {
	/** Short enough to stand on a commit of the Frise. */
	title: string;
	detail: string;
}

export interface Position {
	/** First month in the job, `YYYY-MM`. */
	start: string;
	/** Last month in the job, `YYYY-MM`; none for the current one. */
	end?: string;
	company: string;
	/** Name the company goes by, where the full one is too long for a commit. */
	shortName?: string;
	city: string;
	role: string;
	internship?: boolean;
	missions: Mission[];
}

export const positions: Position[] = [
	{
		start: '2023-03',
		company: 'Da Viking Code',
		city: 'Dijon',
		role: person.jobTitle,
		missions: [
			{
				title: 'Cartographie énergie',
				detail: 'SIG & cartographie pour un grand acteur de l’énergie — OpenLayers, PostGIS, Laravel 12, React 19',
			},
			{
				title: 'Back-office santé',
				detail: 'Back-office d’une plateforme de santé — NestJS 11, Prisma, PostgreSQL, GraphQL',
			},
			{ title: 'Terrain hors-ligne', detail: 'SIG mobile terrain avec mode hors-ligne — MapLibre GL, React Native' },
			{
				title: 'Micro-services Rust',
				detail: 'Micro-services Rust (Axum) — serveur de tuiles, fichiers CAD, nuages de points',
			},
			{ title: 'Monorepos & CI/CD', detail: 'Monorepos, Docker, CI/CD, Cloudflare Workers, authentification' },
		],
	},
	{
		start: '2022-02',
		end: '2023-02',
		company: 'Conseil départemental olympique et sportif',
		shortName: 'CDOS',
		city: 'Dijon',
		role: person.jobTitle,
		missions: [
			{ title: 'Symfony', detail: 'Application web sous Symfony' },
			{ title: 'React Native', detail: 'Application mobile React Native' },
			{ title: 'Express', detail: 'API back-end en Node.js / TypeScript (Express)' },
		],
	},
	{
		start: '2021-09',
		end: '2021-12',
		company: 'Jordel Média',
		city: 'Doucier',
		role: 'Stage — développeur web',
		internship: true,
		missions: [{ title: 'CMS interne', detail: 'Nouvelles fonctionnalités sur le CMS interne de l’entreprise' }],
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

/** The branches the trainings open on the Frise. */
export type BranchName = 'lea' | 'access-code' | 'cda';

/** Where a commit of the Frise sits: `main`, or a training's branch. */
export type Lane = 'main' | BranchName;

export const onMain = (lane: Lane): lane is 'main' => lane === 'main';

export interface Education {
	/** First month, `YYYY-MM`. */
	start: string;
	/** Last month, `YYYY-MM`. */
	end: string;
	/** Branch the training opens on the Frise; none for the diploma `main` starts from. */
	branch?: BranchName;
	title: string;
	school: string;
	city: string;
}

export const education: Education[] = [
	{
		start: '2022-02',
		end: '2023-02',
		branch: 'cda',
		title: 'Concepteur & développeur d’applications',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{
		start: '2020-09',
		end: '2021-12',
		branch: 'access-code',
		title: 'Développeur web & développeur mobile',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{
		start: '2018-09',
		end: '2020-06',
		branch: 'lea',
		title: 'Langues étrangères appliquées (LEA)',
		school: 'UFR SLHS',
		city: 'Besançon',
	},
	{
		start: '2017-09',
		end: '2018-07',
		title: 'Baccalauréat économique et social',
		school: 'Lycée Carnot',
		city: 'Dijon',
	},
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

export type CommitKind = 'init' | 'branch' | 'commit' | 'merge' | 'head';

export interface Commit {
	kind: CommitKind;
	lane: Lane;
	/** Along the Frise, from 0 (the first commit) to 1 (HEAD). */
	position: number;
	/** Machine-readable date for `<time>`; none for the missions, which carry no date of their own. */
	datetime?: string;
	date: string;
	title: string;
	/** Full name behind a shortened title. */
	titleExpansion?: string;
	place: string;
	/** The job's title, which the label leaves out. */
	role?: string;
	/** In full, the missions the label names in a word: crawlers and screen readers get the whole job. */
	details?: string[];
	/** On a merge, the branch it brings back to `main`. */
	merges?: BranchName;
	/** Drawn on the graph but left out of the list: the merge of a branch no job followed. */
	unlabeled?: boolean;
}

export interface Branch {
	name: BranchName;
	/** Positions (0 to 1) of the `main` commit it leaves, of its first and last commits, and of its merge. */
	fork: number;
	open: number;
	last: number;
	merge: number;
}

export interface CareerGraph {
	/** Oldest first, HEAD last. */
	commits: Commit[];
	branches: Branch[];
	/** "main ← lea, access-code, cda". */
	aside: string;
}

/** Minimal distance between two neighbouring commits, as a share of the Frise: their labels stay apart. */
const MIN_COMMIT_GAP = 0.035;

/**
 * The career as a git graph, assembled at build time.
 * The diploma is the `init` commit of `main`; each training opens a branch, holding the internships
 * it contains, and comes back to `main` through the first job that starts after it ends and before
 * the next branch opens, or else through an unlabeled merge. The missions of the current job are
 * spread evenly between its start and HEAD, dated by the company alone.
 */
export function careerGraph(now = new Date()): CareerGraph {
	type Event = Omit<Commit, 'position'> & { month: number };
	const events: Event[] = [];
	const trainings = education
		.filter((entry): entry is Education & { branch: BranchName } => !!entry.branch)
		.sort((a, b) => a.start.localeCompare(b.start));
	const diploma = education.find((entry) => !entry.branch);
	const jobs = [...salariedPositions].sort((a, b) => a.start.localeCompare(b.start));
	const headMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();

	if (diploma) {
		events.push({
			kind: 'init',
			lane: 'main',
			month: monthIndex(diploma.end),
			datetime: diploma.end.slice(0, 4),
			date: year(diploma.end),
			title: diploma.title,
			place: `${diploma.school}, ${diploma.city}`,
		});
	}

	/** Job → branch it brings back to `main`. */
	const mergedBy = new Map<Position, BranchName>();
	trainings.forEach((training, i) => {
		const { branch } = training;
		const [from, to] = [year(training.start), year(training.end)];
		events.push({
			kind: 'branch',
			lane: branch,
			month: monthIndex(training.start),
			datetime: training.start,
			date: from === to ? from : `${from} → ${to}`,
			title: training.title,
			place: `${training.school}, ${training.city}`,
		});
		const nextOpening = trainings[i + 1]?.start;
		const job = jobs.find(
			(job) => !mergedBy.has(job) && job.start >= training.end && (!nextOpening || job.start <= nextOpening),
		);
		if (job) mergedBy.set(job, branch);
		else {
			events.push({
				kind: 'merge',
				lane: 'main',
				month: monthIndex(training.end),
				date: '',
				title: '',
				place: '',
				merges: branch,
				unlabeled: true,
			});
		}
	});

	for (const internship of positions.filter((position) => position.internship)) {
		const host = trainings.find(
			(training) => training.start <= internship.start && (internship.end ?? internship.start) <= training.end,
		);
		events.push({
			kind: 'commit',
			lane: host?.branch ?? 'main',
			month: monthIndex(internship.start),
			datetime: internship.start,
			date: formatPeriod(internship),
			title: `Stage — ${internship.shortName ?? internship.company}`,
			place: placeWithMissions(internship),
			role: internship.role,
			details: internship.missions.map((mission) => mission.detail),
		});
	}

	for (const job of jobs) {
		const current = job === currentPosition;
		events.push({
			kind: mergedBy.has(job) ? 'merge' : 'commit',
			lane: 'main',
			merges: mergedBy.get(job),
			month: monthIndex(job.start),
			datetime: job.start,
			date: monthAndYear.format(firstDayOf(job.start)),
			title: job.shortName ?? job.company,
			titleExpansion: job.shortName && job.company,
			// The current missions are commits of their own, up to HEAD.
			place: current ? job.city : placeWithMissions(job),
			role: job.role,
			details: current ? undefined : job.missions.map((mission) => mission.detail),
		});
		if (!current) continue;
		const start = monthIndex(job.start);
		job.missions.forEach((mission, i) => {
			events.push({
				kind: 'commit',
				lane: 'main',
				month: start + ((headMonth - start) * (i + 1)) / (job.missions.length + 1),
				date: job.company,
				title: mission.title,
				place: mission.detail,
			});
		});
	}

	events.push({
		kind: 'head',
		lane: 'main',
		month: headMonth,
		datetime: now.toISOString().slice(0, 10),
		date: 'aujourd’hui',
		title: 'HEAD',
		place: currentPosition ? `${currentPosition.company}, ${currentPosition.city}` : person.city,
	});

	// Within a month, `main` comes first: a branch opened that month leaves from it.
	events.sort((a, b) => a.month - b.month || Number(!onMain(a.lane)) - Number(!onMain(b.lane)));

	// Positions follow the calendar, pushed apart where commits would crowd, then brought back to 0–1.
	const first = events[0].month;
	const spread: number[] = [];
	for (const event of events) {
		const onCalendar = (event.month - first) / (headMonth - first);
		spread.push(spread.length ? Math.max(onCalendar, spread[spread.length - 1] + MIN_COMMIT_GAP) : onCalendar);
	}
	const last = spread[spread.length - 1];
	const commits: Commit[] = events.map(({ month: _month, ...event }, i) => ({ ...event, position: spread[i] / last }));

	const branches = trainings.map((training): Branch => {
		const name = training.branch;
		const onBranch = commits.filter((commit) => commit.lane === name);
		const opening = commits.indexOf(onBranch[0]);
		const fork = commits.slice(0, opening).findLast((commit) => onMain(commit.lane));
		return {
			name,
			fork: fork?.position ?? 0,
			open: onBranch[0].position,
			last: onBranch[onBranch.length - 1].position,
			merge: commits.find((commit) => commit.merges === name)?.position ?? 1,
		};
	});

	return { commits, branches, aside: `main ← ${branches.map((branch) => branch.name).join(', ')}` };
}

/** "City · mission, mission": a past job or an internship, compact enough for a commit label. */
function placeWithMissions(position: Position) {
	return [position.city, position.missions.map((mission) => mission.title).join(', ')].join(' · ');
}

function monthIndex(month: string) {
	const [y, m] = month.split('-').map(Number);
	return y * 12 + m - 1;
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
