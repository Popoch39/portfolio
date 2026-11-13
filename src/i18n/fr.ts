/**
 * Every text the visitor reads or hears, in French. Its type is the one every other language's dictionary
 * must satisfy (`Dictionary`): a key missing there is a type error.
 *
 * One named export per section: a client script imports the one it needs (`forPage`, `lang.ts`), and the
 * bundler leaves the others out. Hence plain data and functions only, nothing computed at the top level.
 */
import type { WhenValue } from '../cafe/when';
import type { Education, Position, Project, Service } from '../data/profile';

export const meta = {
	/** BCP 47: `Intl` formats, `og:locale` and the JSON-LD's `inLanguage` derive from it. */
	locale: 'fr-FR',
	home: {
		title: 'Louis Pocheron — Développeur web & SIG à Besançon',
		description:
			'Sites vitrines, boutiques en ligne et prise de rendez-vous pour les commerces locaux ; cartographie SIG pour l’énergie et les collectivités. À Besançon.',
	},
	notFound: {
		title: 'Page introuvable — Louis Pocheron',
		description:
			'Cette page n’existe pas ou a été déplacée. Retour au portfolio de Louis Pocheron, développeur fullstack et SIG.',
	},
	ogImageAlt: (name: string, jobTitle: string) => `${name}, ${jobTitle.toLowerCase()} — portfolio`,
};

const jobTitle = 'Concepteur & développeur d’applications';

const projects: Project[] = [
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

const positions: Position[] = [
	{
		start: '2023-03',
		company: 'Da Viking Code',
		city: 'Dijon',
		role: jobTitle,
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
		role: jobTitle,
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

const education: Education[] = [
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
 * The offers behind the Accroche, in visible text: every version of the lede is covered by one of
 * them, with its own words and its audience, so that a search can find it.
 */
const services: Service[] = [
	{
		title: 'Site vitrine',
		audience: 'restaurants, cafés, boulangeries, gîtes et chambres d’hôtes',
		what: 'Le site vitrine de votre restaurant, le site de votre gîte : la carte ou les chambres, les horaires, l’accès, les photos et un moyen de vous joindre, lisibles d’abord sur un téléphone.',
		how: 'Un site rapide et bien référencé sur les recherches locales, à Besançon et alentour, construit comme celui-ci.',
	},
	{
		title: 'Boutique en ligne',
		audience: 'commerces de proximité',
		what: 'La boutique en ligne de votre commerce : le catalogue, le paiement, le retrait en magasin ou la livraison.',
		how: 'Pour les commerces de Besançon qui veulent vendre en dehors de leurs heures d’ouverture, sans dépendre d’une place de marché.',
	},
	{
		title: 'Prise de rendez-vous',
		audience: 'artisans, coiffeurs et instituts',
		what: 'La prise de rendez-vous de votre salon ou de votre atelier : vos clients choisissent un créneau en ligne, à toute heure, et vous gardez la main sur votre agenda.',
		how: 'Moins d’appels pendant que vous travaillez, pour les artisans et les salons de Besançon et des environs.',
	},
	{
		title: 'Cartographie & SIG',
		audience: 'grands comptes de l’énergie, mairies et collectivités',
		what: 'Les cartes de votre réseau électrique, la carte de votre commune : des données géographiques lisibles dans le navigateur, du serveur de tuiles à l’interface.',
		how: 'OpenLayers, MapLibre et PostGIS : le métier que j’exerce au quotidien pour un grand acteur de l’énergie, proposé depuis Besançon aux collectivités.',
	},
	{
		title: 'API & back-office',
		audience: 'équipes produit',
		what: 'L’API de votre back-office : des données bien modélisées, une interface d’administration et une documentation que votre équipe peut reprendre.',
		how: 'NestJS, Laravel ou Rust, PostgreSQL : en renfort d’une équipe en place ou pour lancer un projet, depuis Besançon.',
	},
	{
		title: 'Outil de terrain',
		audience: 'métiers de terrain',
		what: 'L’outil de votre équipe terrain : une application mobile et sa carte, utilisables même sans réseau, synchronisées au retour.',
		how: 'MapLibre et React Native, pour les équipes qui interviennent loin d’un bureau, depuis Besançon.',
	},
];

/** The portfolio's content (`src/data/profile.ts` builds on it): profile, career, lede, offers. */
export const content = {
	jobTitle,
	specialty: 'SIG & cartographie à échelle industrielle',
	/** Where the header has one line for it (phones). */
	specialtyShort: 'SIG & cartographie',
	country: 'France',
	projects,
	positions,
	education,
	services,
	/** The Atome's bagues, by the category keys of the profile's stack. */
	stackCategories: {
		languages: 'Langages',
		backEnd: 'Back-end',
		frontEnd: 'Front-end',
		gis: 'SIG · CAD · 3D',
		data: 'Data',
		devOps: 'DevOps',
		tools: 'Outils',
	},
	/**
	 * The hero's lede, rewritten in Vim from one version to the next: each version speaks to one
	 * audience. `summary` is what assistive technologies read instead, all versions at once.
	 * Sent whole to the typist (`data-lede`): nothing but the lede's own text here.
	 */
	lede: {
		before: 'Je construis ',
		between: ' de votre ',
		after: '.',
		versions: [
			{ what: 'les cartes', whose: 'réseau électrique', audience: 'les grands comptes de l’énergie' },
			{ what: 'le site', whose: 'gîte', audience: 'les gîtes et chambres d’hôtes' },
			{ what: 'la boutique en ligne', whose: 'commerce', audience: 'les commerces de proximité' },
			{ what: 'le site vitrine', whose: 'restaurant', audience: 'les restaurants, cafés et boulangeries' },
			{ what: 'la prise de rendez-vous', whose: 'salon', audience: 'les artisans, coiffeurs et instituts' },
			{ what: 'l’API', whose: 'back-office', audience: 'les équipes produit' },
			{ what: 'la carte', whose: 'commune', audience: 'les mairies et collectivités' },
			{ what: 'l’outil', whose: 'équipe terrain', audience: 'les métiers de terrain' },
		],
		summary:
			'Je construis des cartes, des sites vitrines, des boutiques en ligne, des prises de rendez-vous, des API et des outils : pour votre réseau électrique, votre gîte, votre commerce, votre restaurant, votre salon, votre back-office, votre commune ou votre équipe terrain.',
	},
	/** The end of a period still running, and HEAD's date on the Frise. */
	today: 'aujourd’hui',
	/** An internship's commit on the Frise. */
	internship: (company: string) => `Stage — ${company}`,
};

export const header = {
	navLabel: 'Sections',
	sections: { parcours: 'Parcours', stack: 'Stack', contact: 'Contact' },
	/** The Bascule's landmark, for screen readers. */
	basculeLabel: 'Langue',
};

/** Coordinates as the hero's map and the Intro print them. */
export const geo = {
	decimalSeparator: ',',
	north: 'N',
	south: 'S',
	east: 'E',
	west: 'O',
};

export const hero = {
	write: 'Écrire',
	/** After `write`, for screen readers only. */
	writeHidden: ' un e-mail',
};

/** The lede's line under the sentence; the typist rewrites it as it changes version. */
export const ledeLine = {
	version: 'version',
	audience: (audience: string) => `pour : ${audience}`,
	/** The Escape key's cap, as the keyboard prints it, shown as the typist leaves INSERT. */
	escape: 'Échap',
};

export const intro = {
	phases: {
		projection: 'projection orthographique · EPSG:4326',
		cut: 'découpe · 12 fuseaux de 30°',
		unroll: 'développement · fuseaux sinusoïdaux',
		straighten: 'redressement · 1 fuseau = 1 colonne',
	},
	gore: 'fuseau',
	centre: 'centre de la projection',
	/** Lengths come formatted, with the language's decimal separator. */
	scale: (gore: string, gutter: string) => `fuseau ${gore} px · gouttière ${gutter} px`,
};

/**
 * The sky's words (ADR 0008). Plain strings only: `paintSky` receives them as JSON in the `<head>`'s
 * inline script.
 */
export const sky = {
	rise: 'lever',
	set: 'coucher',
	/** Civil, nautical, astronomical. */
	dusks: ['crépuscule civil', 'crépuscule nautique', 'crépuscule astronomique'],
	dawns: ['aube civile', 'aube nautique', 'aube astronomique'],
	night: 'nuit',
	/** Full night's label under the night's paper, forced in the Nuancier. */
	nightPaper: 'nuit · papier EN-02',
};

export const statusline = {
	file: '~/louis/portfolio.md',
	/** Vim's position in the buffer, at its end. */
	bottom: 'Bas',
	/** After the sunrise and sunset, for screen readers only. */
	sunWhere: (city: string) => ` à ${city} aujourd’hui`,
	pause: 'pause',
	/** After `pause`, for screen readers only. */
	pauseHidden: ' des animations',
	// Short, as Vim's own count is: beside `VISUAL` it needs no verb, and it fits a 320px phone's row.
	counted: (count: number) => (count > 1 ? `${count} caractères` : '1 caractère'),
	/** After the count of a yank, where the row has room for it. */
	copied: ' copiés',
	copyRefused: 'E: copie refusée',
	secondClick: ' · un second clic ouvre le mail',
};

export const nuancier = {
	legend: 'Papier du site',
	papers: {
		light: { name: 'Jour', hint: 'toujours le jour' },
		dark: { name: 'Nuit', hint: 'toujours la nuit' },
		'solarized-light': { name: 'Solarized Light', hint: 'd’Ethan Schoonover' },
		auto: { name: 'Auto', hint: 'suit le soleil à Besançon' },
		nord: { name: 'Nord', hint: 'd’Arctic Ice Studio' },
		'gruvbox-light': { name: 'Gruvbox Light', hint: 'de morhetz' },
		'catppuccin-mocha': { name: 'Catppuccin Mocha', hint: 'de Catppuccin' },
		'tokyo-night': { name: 'Tokyo Night', hint: 'd’enkia' },
	},
};

export const frise = {
	title: 'Parcours',
	bandLabel: 'Frise du parcours',
	summary: (years: number, cities: string[]) => `~${years} ans d’expérience · ${cities.join(' & ')}`,
};

export const stackSection = {
	title: 'Stack',
	aside: ':set stack?',
	note: 'éditeur : neovim · multiplexeur : tmux · runtime : bun — ',
	noteLink: 'la config est sur GitHub',
};

export const contact = {
	title: 'Contact',
	lede: 'Un projet carto, une API, une interface React ? Écrivez-moi.',
	propose: 'proposer un café',
	nvimConfig: 'Config Neovim',
};

/** The Café, its Montage and the Formulaire du Café. */
export const cafe = {
	aside: 'on monte, puis on en parle',
	/** Each line clips its own rise. */
	titleLines: ['Parlons de', 'votre projet', 'autour d’un café.'],
	/** What the counter says at each step of the Montage, in order; the last one is the final state's. */
	steps: [
		'0/6 · en pièces',
		'0/6 · la chaudière',
		'1/6 · l’entonnoir et le café',
		'2/6 · le filtre',
		'3/6 · le joint',
		'4/6 · on visse le collecteur, un tour',
		'5/6 · le couvercle',
		'6/6 · sur le feu',
	],
	figure:
		'Un Moka Express en pièces au-dessus d’un réchaud, que le défilement remonte pièce par pièce avant d’allumer le feu.',
	/** The Repères of the Démontage, by the field each one puts back. */
	tags: { name: 'le couvercle', email: 'le collecteur', when: 'le filtre', message: 'la chaudière' },
	call: { title: 'café · en visio', count: '2 participants', you: 'vous' },
	text: (city: string) =>
		`À ${city}, ou en visio si vous êtes plus loin. Comme un moka : on assemble les pièces dans l’ordre, sans rien forcer. Et sans engagement : au pire, on aura bu un café.`,
	propose: 'Proposer un café',
	proposeSubject: 'Un café ?',
	visio: 'Plutôt en visio',
	visioSubject: 'Une visio ?',
	/** The form's heading, switch and confirmation, in each of its two flavours. */
	flavours: {
		cafe: { heading: 'Un café, à Besançon.', switch: 'plutôt en visio', confirm: 'Envoyé. À très vite autour d’un café.' },
		visio: { heading: 'Une visio, où que vous soyez.', switch: 'plutôt un café', confirm: 'Envoyé. À très vite en visio.' },
	},
	fields: { name: 'Nom', email: 'E-mail', when: 'Quand ?', message: 'Message', trap: 'Site' },
	messagePlaceholder: 'facultatif',
	/** The « Quand ? » chips, by the value the form sends (`src/cafe/when.ts`). */
	chips: {
		'Cette semaine': 'Cette semaine',
		'La semaine prochaine': 'Semaine prochaine',
		'Plus tard': 'Plus tard',
	} satisfies Record<WhenValue, string>,
	send: 'Envoyer',
	sending: 'envoi…',
	noCommitment: 'sans engagement',
	close: 'esc · fermer',
	again: 'recommencer',
	/** The counter while the form is open, by the number of blocks back in place (board A). */
	counts: ['en pièces', 'une pièce posée', 'à mi-hauteur', 'presque monté', 'prêt à chauffer'],
	/** The figure's name while the form is open. */
	figureOpen: (back: number, visio: boolean) =>
		`Un Moka Express démonté au-dessus de son réchaud éteint${visio ? ', dans le cadre d’un écran' : ''} : ${back} pièces sur 4 remises en place.`,
	/** What the hint names of a field left empty. */
	missingNames: { name: 'votre nom', email: 'votre e-mail', when: 'quand' },
	missing: (names: string[]) => `encore en l’air : ${names.join(', ')}`,
	failed: (address: string) => `pas parti : réessayez, ou écrivez à ${address}`,
};

export const notFound = {
	status: 'E486: Pattern not found',
	lede: 'Cette page n’existe pas, ou plus.',
	back: 'Retour à l’accueil',
};

export const fr = {
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
	notFound,
};

/** What every language's dictionary must satisfy. */
export type Dictionary = typeof fr;
