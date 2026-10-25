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
	employer: Employer;
	email: string;
	links: {
		github: string;
		nvimConfig: string;
	};
}

const givenName = 'Louis';
const familyName = 'Pocheron';

export const identity: Identity = {
	givenName,
	familyName,
	name: `${givenName} ${familyName}`,
	role: 'Concepteur & développeur d’applications',
	roleDetail: 'Concepteur & développeur d’applications, fullstack',
	city: 'Besançon',
	country: 'France',
	languages: ['TypeScript', 'PHP', 'Rust'],
	sideLanguages: ['Go', 'Lua'],
	employer: { name: 'Da Viking Code', city: 'Dijon', since: 2023 },
	email: 'pocheron.louis@gmail.com',
	links: {
		github: 'https://github.com/Popoch39',
		nvimConfig: 'https://github.com/Popoch39/nvim',
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
		// Produite par `og/capture.mjs` à partir de `og/composition.html`, puis versionnée.
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
