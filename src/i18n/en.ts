/**
 * Every text the visitor reads or hears, in English. It must satisfy the French dictionary's type
 * (`Dictionary`): a key missing here is a type error.
 *
 * Laid out like `fr.ts`, one named export per section, for the same reason: a client script imports
 * the one it needs.
 */
import type { Education, Position, Project, Service } from '../data/profile';
import type { Dictionary } from './fr';

export const meta: Dictionary['meta'] = {
	locale: 'en-US',
	home: {
		title: 'Louis Pocheron — Web & GIS developer in Besançon',
		description:
			'Websites, online stores and appointment booking for local businesses; GIS mapping for energy companies and local authorities. Based in Besançon, France.',
	},
	notFound: {
		title: 'Page not found — Louis Pocheron',
		description:
			'This page doesn’t exist or has moved. Back to the portfolio of Louis Pocheron, fullstack and GIS developer.',
	},
	ogImageAlt: (name: string, jobTitle: string) => `${name}, ${jobTitle.toLowerCase()} — portfolio`,
};

const jobTitle = 'Application designer & developer';

const projects: Project[] = [
	{
		repo: 'pointcloud-viewer',
		description: 'LiDAR point clouds in the browser — baked in Rust → WebAssembly, rendered with three.js on MapLibre.',
		stack: 'Rust · WASM · React · three.js',
		year: 2026,
	},
	{
		repo: 'ma_parcelle',
		description: 'Everything open data says about a French land parcel, on a full-screen map.',
		stack: 'React 19 · Vite · MapLibre',
		year: 2026,
	},
	{
		repo: 'maptile_cacher',
		description: 'A fast caching layer for map tiles.',
		stack: 'Rust',
		year: 2026,
	},
	{
		repo: 'claude-tmux-notify.nvim',
		description: 'A Neovim toast when a Claude Code session, in another tmux window, is waiting for you.',
		stack: 'Lua · Neovim · tmux · ★ 3',
		year: 2026,
	},
	{
		repo: 'claude-status-line',
		description: 'Claude Code subscription usage in the status line — a cross-platform Bun binary.',
		stack: 'TypeScript · Bun',
		year: 2026,
	},
	{
		repo: 'gis_3d',
		description: '3D terrain and geodata in the browser — experiments, with a live demo.',
		stack: 'TypeScript · Next.js',
		year: 2025,
	},
];

const positions: Position[] = [
	{
		start: '2023-03',
		company: 'Da Viking Code',
		city: 'Dijon',
		role: jobTitle,
		missions: [
			{
				title: 'Energy mapping',
				detail: 'GIS & mapping for a major energy company — OpenLayers, PostGIS, Laravel 12, React 19',
			},
			{
				title: 'Healthcare back office',
				detail: 'Back office of a healthcare platform — NestJS 11, Prisma, PostgreSQL, GraphQL',
			},
			{ title: 'Offline field GIS', detail: 'Mobile field GIS with an offline mode — MapLibre GL, React Native' },
			{
				title: 'Rust microservices',
				detail: 'Rust microservices (Axum) — tile server, CAD files, point clouds',
			},
			{ title: 'Monorepos & CI/CD', detail: 'Monorepos, Docker, CI/CD, Cloudflare Workers, authentication' },
		],
	},
	{
		start: '2022-02',
		end: '2023-02',
		company: 'Conseil départemental olympique et sportif',
		shortName: 'CDOS',
		city: 'Dijon',
		role: jobTitle,
		missions: [
			{ title: 'Symfony', detail: 'Web application built with Symfony' },
			{ title: 'React Native', detail: 'Mobile app in React Native' },
			{ title: 'Express', detail: 'Back-end API in Node.js / TypeScript (Express)' },
		],
	},
	{
		start: '2021-09',
		end: '2021-12',
		company: 'Jordel Média',
		city: 'Doucier',
		role: 'Intern — web developer',
		internship: true,
		missions: [{ title: 'In-house CMS', detail: 'New features for the company’s in-house CMS' }],
	},
];

const education: Education[] = [
	{
		start: '2022-02',
		end: '2023-02',
		branch: 'cda',
		title: 'Application designer & developer',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{
		start: '2020-09',
		end: '2021-12',
		branch: 'access-code',
		title: 'Web & mobile developer',
		school: 'Access Code School',
		city: 'Besançon',
	},
	{
		start: '2018-09',
		end: '2020-06',
		branch: 'lea',
		title: 'Applied foreign languages (LEA)',
		school: 'UFR SLHS',
		city: 'Besançon',
	},
	{
		start: '2017-09',
		end: '2018-07',
		title: 'Baccalauréat in economics and social sciences',
		school: 'Lycée Carnot',
		city: 'Dijon',
	},
];

/**
 * The offers behind the Accroche, in visible text: every version of the lede is covered by one of
 * them, with its own words and its audience, so that a search can find it.
 */
const services: Service[] = [
	{
		title: 'Website',
		audience: 'restaurants, cafés, bakeries, guesthouses and B&Bs',
		what: 'The website of your restaurant, the site of your guesthouse: the menu or the rooms, opening hours, how to get there, photos and a way to reach you, easy to read on a phone first.',
		how: 'A fast site that ranks well in local searches, in Besançon and around, built like this one.',
	},
	{
		title: 'Online store',
		audience: 'local shops',
		what: 'The online store of your shop: the catalogue, payment, in-store pickup or delivery.',
		how: 'For shops in Besançon that want to sell outside opening hours, without depending on a marketplace.',
	},
	{
		title: 'Appointment booking',
		audience: 'craftspeople, hairdressers and beauty salons',
		what: 'Appointment booking for your salon or your workshop: your customers pick a slot online, at any hour, and you stay in charge of your calendar.',
		how: 'Fewer calls while you work, for craftspeople and salons in and around Besançon.',
	},
	{
		title: 'Mapping & GIS',
		audience: 'major energy companies, town halls and local authorities',
		what: 'The maps of your power grid, the map of your town: geographic data you can read in the browser, from the tile server to the interface.',
		how: 'OpenLayers, MapLibre and PostGIS: the work I do every day for a major energy company, offered from Besançon to local authorities.',
	},
	{
		title: 'API & back office',
		audience: 'product teams',
		what: 'The API of your back office: well-modelled data, an admin interface and documentation your team can pick up.',
		how: 'NestJS, Laravel or Rust, PostgreSQL: to back up a team already in place or to get a project started, from Besançon.',
	},
	{
		title: 'Field tool',
		audience: 'field workers',
		what: 'Your field team’s tool: a mobile app and its map, usable even without a signal, synced once back.',
		how: 'MapLibre and React Native, for teams who work far from an office, from Besançon.',
	},
];

export const content: Dictionary['content'] = {
	jobTitle,
	specialty: 'GIS & mapping at industrial scale',
	specialtyShort: 'GIS & mapping',
	country: 'France',
	projects,
	positions,
	education,
	services,
	stackCategories: {
		languages: 'Languages',
		backEnd: 'Back end',
		frontEnd: 'Front end',
		gis: 'GIS · CAD · 3D',
		data: 'Data',
		devOps: 'DevOps',
		tools: 'Tools',
	},
	lede: {
		before: 'I build ',
		between: ' for your ',
		after: '.',
		versions: [
			{ what: 'the maps', whose: 'power grid', audience: 'major energy companies' },
			{ what: 'the site', whose: 'guesthouse', audience: 'guesthouses and B&Bs' },
			{ what: 'the online store', whose: 'shop', audience: 'local shops' },
			{ what: 'the website', whose: 'restaurant', audience: 'restaurants, cafés and bakeries' },
			{ what: 'the appointment booking', whose: 'salon', audience: 'craftspeople, hairdressers and beauty salons' },
			{ what: 'the API', whose: 'back office', audience: 'product teams' },
			{ what: 'the map', whose: 'town', audience: 'town halls and local authorities' },
			{ what: 'the tool', whose: 'field team', audience: 'field workers' },
		],
		summary:
			'I build maps, websites, online stores, appointment booking, APIs and tools: for your power grid, your guesthouse, your shop, your restaurant, your salon, your back office, your town or your field team.',
	},
	today: 'today',
	internship: (company: string) => `Internship — ${company}`,
};

export const header: Dictionary['header'] = {
	navLabel: 'Sections',
	sections: { parcours: 'Career', stack: 'Stack', contact: 'Contact' },
	basculeLabel: 'Language',
	languageName: 'English',
};

export const geo: Dictionary['geo'] = {
	decimalSeparator: '.',
	north: 'N',
	south: 'S',
	east: 'E',
	west: 'W',
};

export const hero: Dictionary['hero'] = {
	write: 'Write',
	writeHidden: ' me an email',
};

export const ledeLine: Dictionary['ledeLine'] = {
	version: 'version',
	audience: (audience: string) => `for: ${audience}`,
	escape: 'Esc',
};

export const intro: Dictionary['intro'] = {
	phases: {
		projection: 'orthographic projection · EPSG:4326',
		cut: 'cut · 12 gores of 30°',
		unroll: 'unrolling · sinusoidal gores',
		straighten: 'straightening · 1 gore = 1 column',
	},
	gore: 'gore',
	centre: 'center of projection',
	scale: (gore: string, gutter: string) => `gore ${gore} px · gutter ${gutter} px`,
};

export const sky: Dictionary['sky'] = {
	rise: 'sunrise',
	set: 'sunset',
	dusks: ['civil dusk', 'nautical dusk', 'astronomical dusk'],
	dawns: ['civil dawn', 'nautical dawn', 'astronomical dawn'],
	night: 'night',
	nightPaper: 'night · paper EN-02',
};

export const statusline: Dictionary['statusline'] = {
	file: '~/louis/portfolio.en.md',
	paper: 'paper',
	// Vim's own word, in English.
	bottom: 'Bot',
	sunWhere: (city: string) => ` in ${city} today`,
	pause: 'pause',
	pauseHidden: ' animations',
	counted: (count: number) => (count > 1 ? `${count} chars` : '1 char'),
	copied: ' copied',
	copyRefused: 'E: copy refused',
	secondClick: ' · a second click opens the mail',
};

export const nuancier: Dictionary['nuancier'] = {
	legend: 'Site paper',
	papers: {
		light: { name: 'Day', hint: 'always day' },
		dark: { name: 'Night', hint: 'always night' },
		'solarized-light': { name: 'Solarized Light', hint: 'by Ethan Schoonover' },
		auto: { name: 'Auto', hint: 'follows the sun in Besançon' },
		nord: { name: 'Nord', hint: 'by Arctic Ice Studio' },
		'gruvbox-light': { name: 'Gruvbox Light', hint: 'by morhetz' },
		'catppuccin-mocha': { name: 'Catppuccin Mocha', hint: 'by Catppuccin' },
		'tokyo-night': { name: 'Tokyo Night', hint: 'by enkia' },
	},
};

export const frise: Dictionary['frise'] = {
	title: 'Career',
	bandLabel: 'Career timeline',
	summary: (years: number, cities: string[]) => `~${years} years of experience · ${cities.join(' & ')}`,
};

export const stackSection: Dictionary['stackSection'] = {
	title: 'Stack',
	aside: ':set stack?',
	note: 'editor: neovim · multiplexer: tmux · runtime: bun — ',
	noteLink: 'the config is on GitHub',
};

export const contact: Dictionary['contact'] = {
	title: 'Contact',
	lede: 'A mapping project, an API, a React interface? Write to me.',
	propose: 'suggest a coffee',
	nvimConfig: 'Neovim config',
};

export const cafe: Dictionary['cafe'] = {
	aside: 'we put it together, then we talk',
	titleLines: ['Let’s talk about', 'your project', 'over a coffee.'],
	steps: [
		'0/6 · in pieces',
		'0/6 · the boiler',
		'1/6 · the funnel and the coffee',
		'2/6 · the filter',
		'3/6 · the gasket',
		'4/6 · screwing on the top, one turn',
		'5/6 · the lid',
		'6/6 · on the stove',
	],
	figure:
		'A Moka Express in pieces above a gas burner, put back together piece by piece as you scroll before the flame is lit.',
	tags: { name: 'the lid', email: 'the top', when: 'the filter', message: 'the boiler' },
	call: { title: 'coffee · on video', count: '2 participants', you: 'you' },
	text: (city: string) =>
		`In ${city}, or on a video call if you are further away. Like a moka pot: the pieces go together in order, nothing forced. And no strings attached: at worst, we’ll have had a coffee.`,
	propose: 'Suggest a coffee',
	proposeSubject: 'A coffee?',
	visio: 'Rather on video',
	visioSubject: 'A video call?',
	flavours: {
		cafe: { heading: 'A coffee, in Besançon.', switch: 'rather on video', confirm: 'Sent. See you soon over a coffee.' },
		visio: { heading: 'A video call, wherever you are.', switch: 'rather a coffee', confirm: 'Sent. See you soon on video.' },
	},
	fields: { name: 'Name', email: 'E-mail', when: 'When?', message: 'Message', trap: 'Website' },
	messagePlaceholder: 'optional',
	chips: {
		'Cette semaine': 'This week',
		'La semaine prochaine': 'Next week',
		'Plus tard': 'Later',
	},
	send: 'Send',
	sending: 'sending…',
	noCommitment: 'no strings attached',
	close: 'esc · close',
	again: 'start again',
	counts: ['in pieces', 'one piece in place', 'halfway up', 'nearly assembled', 'ready to heat'],
	figureOpen: (back: number, visio: boolean) =>
		`A Moka Express taken apart above its unlit burner${visio ? ', inside a screen’s frame' : ''}: ${back} of 4 pieces back in place.`,
	missingNames: { name: 'your name', email: 'your e-mail', when: 'when' },
	missing: (names: string[]) => `still up in the air: ${names.join(', ')}`,
	failed: (address: string) => `not sent: try again, or write to ${address}`,
};

export const contactRoute: Dictionary['contactRoute'] = {
	200: 'Sent.',
	400: 'The proposal is incomplete or invalid.',
	429: 'Too many sends: try again in a minute.',
	502: 'The mail did not leave: try again later.',
};

export const notFound: Dictionary['notFound'] = {
	status: 'E486: Pattern not found',
	lede: 'This page doesn’t exist, or no longer does.',
	back: 'Back to home',
};

export const en: Dictionary = {
	meta,
	content,
	header,
	geo,
	hero,
	ledeLine,
	intro,
	sky,
	statusline,
	nuancier,
	frise,
	stackSection,
	contact,
	cafe,
	contactRoute,
	notFound,
};
