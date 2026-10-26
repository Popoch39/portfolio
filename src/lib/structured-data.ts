// Données structurées schema.org (JSON-LD) partagées entre les pages.
import { identity, pageMeta } from '../data/profile';

/**
 * La Person du site, sans `@context` pour pouvoir l'imbriquer (auteur d'une fiche). Son URL et
 * son image sont celles de l'accueil, quelle que soit la page. Ni téléphone, ni adresse postale,
 * ni date de naissance (règle de contenu du spec).
 */
export const person = (site: URL | undefined) => ({
	'@type': 'Person',
	name: identity.name,
	givenName: identity.givenName,
	familyName: identity.familyName,
	jobTitle: identity.roleDetail,
	worksFor: { '@type': 'Organization', name: identity.employer.name },
	homeLocation: { '@type': 'Place', name: `${identity.city}, ${identity.country}` },
	url: new URL('/', site).href,
	image: new URL(pageMeta.shareImage.path, site).href,
	email: `mailto:${identity.email}`,
	sameAs: [identity.links.github],
	knowsAbout: identity.skills,
});
