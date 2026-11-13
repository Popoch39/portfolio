/**
 * Portfolio content: the single source for the page, its metadata and its JSON-LD.
 * What is the same in every language lives here; what the visitor reads lives in each language's
 * dictionary (`content`, `src/i18n/fr.ts`), which `contentOf` indexes by language.
 */
import { type Dictionary, dictionary, type Lang } from '../i18n';

export const person = {
	givenName: 'Louis',
	familyName: 'Pocheron',
	name: 'Louis Pocheron',
	email: 'pocheron.louis@gmail.com',
	city: 'Besançon',
	country: 'FR',
	latitude: 47.2378,
	longitude: 6.0241,
	github: { user: 'Popoch39', url: 'https://github.com/Popoch39' },
	nvimConfig: 'https://github.com/Popoch39/nvim',
} as const;

/** The portfolio's content in a language: profile, career, lede, offers. */
export const contentOf = (lang: Lang) => dictionary(lang).content;

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

export const salariedPositions = (lang: Lang) => contentOf(lang).positions.filter((position) => !position.internship);

export const currentPosition = (lang: Lang) => contentOf(lang).positions.find((position) => !position.end);

export type Lede = Dictionary['content']['lede'];

export interface Service {
	title: string;
	/** Who it is for, after "pour :". */
	audience: string;
	/** What gets built, in the words of the Accroche's versions it covers. */
	what: string;
	/** How, and from where. */
	how: string;
}

/** Month formats, in the language's own words: "mars 2023", "sept.". */
function monthFormats(lang: Lang) {
	const { locale } = dictionary(lang).meta;
	return {
		monthAndYear: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
		monthOnly: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
	};
}

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
export function formatPeriod(lang: Lang, { start, end }: Pick<Position, 'start' | 'end'>) {
	const { monthAndYear, monthOnly } = monthFormats(lang);
	if (!end) return `${monthAndYear.format(firstDayOf(start))} → ${contentOf(lang).today}`;
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

/** A bague's category, named in each language's dictionary. */
export type StackCategory = keyof Dictionary['content']['stackCategories'];

/**
 * In order from the base of the Atome's tower to its top: one bague per category.
 * `accent` marks the specialty, drawn in the accent colour wherever it sits in the list.
 */
export const stack: { category: StackCategory; items: string[]; accent?: true }[] = [
	{ category: 'languages', items: ['TypeScript', 'Rust', 'PHP', 'SQL', 'Go', 'Lua'] },
	{ category: 'backEnd', items: ['NestJS', 'Laravel', 'Axum', 'Elysia', 'Node', 'GraphQL', 'REST'] },
	{ category: 'frontEnd', items: ['React', 'Next.js', 'Vue', 'Vite', 'Tailwind'] },
	{
		category: 'gis',
		items: ['OpenLayers', 'MapLibre GL', 'PostGIS', 'Turf.js', 'Three.js', 'DWG/DXF'],
		accent: true,
	},
	{ category: 'data', items: ['PostgreSQL', 'Redis', 'Prisma', 'Drizzle'] },
	{ category: 'devOps', items: ['Docker', 'CI/CD', 'Cloudflare', 'AWS', 'Sentry'] },
	{ category: 'tools', items: ['Bun', 'Monorepo', 'Git', 'Neovim', 'tmux', 'Agile/Scrum'] },
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
export function yearsOfExperience(lang: Lang, now = new Date()) {
	const first = salariedPositions(lang)
		.map((position) => position.start)
		.sort()[0];
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
export function careerGraph(lang: Lang, now = new Date()): CareerGraph {
	type Event = Omit<Commit, 'position'> & { month: number };
	const { education, positions, today, internship: internshipTitle } = contentOf(lang);
	const { monthAndYear } = monthFormats(lang);
	const current = currentPosition(lang);
	const events: Event[] = [];
	const trainings = education
		.filter((entry): entry is Education & { branch: BranchName } => !!entry.branch)
		.sort((a, b) => a.start.localeCompare(b.start));
	const diploma = education.find((entry) => !entry.branch);
	const jobs = [...salariedPositions(lang)].sort((a, b) => a.start.localeCompare(b.start));
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
			date: formatPeriod(lang, internship),
			title: internshipTitle(internship.shortName ?? internship.company),
			place: placeWithMissions(internship),
			role: internship.role,
			details: internship.missions.map((mission) => mission.detail),
		});
	}

	for (const job of jobs) {
		const isCurrent = job === current;
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
			place: isCurrent ? job.city : placeWithMissions(job),
			role: job.role,
			details: isCurrent ? undefined : job.missions.map((mission) => mission.detail),
		});
		if (!isCurrent) continue;
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
		date: today,
		title: 'HEAD',
		place: current ? `${current.company}, ${current.city}` : person.city,
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
