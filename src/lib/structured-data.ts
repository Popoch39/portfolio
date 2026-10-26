// Données structurées schema.org (JSON-LD) partagées entre les pages.
import { identity, pageMeta } from '../data/profile';
import { defaultLocale, home, pathOf, type Locale } from './i18n';

/**
 * La Person du site, sans `@context` pour pouvoir l'imbriquer (auteur d'une fiche). Son `@id` est
 * le même dans les deux langues : les moteurs y lisent une seule personne. Son URL et son image
 * sont celles de l'accueil de la langue de la page, quelle que soit la page. Ni téléphone, ni
 * adresse postale, ni date de naissance (règle de contenu du spec).
 */
export const person = (site: URL | undefined, locale: Locale) => ({
	'@type': 'Person',
	'@id': new URL(`${pathOf(home, defaultLocale)}#person`, site).href,
	name: identity.name,
	givenName: identity.givenName,
	familyName: identity.familyName,
	jobTitle: identity.roleDetail[locale],
	worksFor: { '@type': 'Organization', name: identity.employer.name },
	homeLocation: { '@type': 'Place', name: `${identity.city}, ${identity.country}` },
	url: new URL(pathOf(home, locale), site).href,
	image: new URL(pageMeta[locale].shareImage.path, site).href,
	email: `mailto:${identity.email}`,
	sameAs: [identity.links.github],
	knowsAbout: identity.skills[locale],
});
