// :version (#61), à la façon de `nvim --version` : le nom et le commit, puis la date du build et la
// version d'Astro, une ligne chacun. Les valeurs sont celles du build, injectées par `vite.define`.
import { el } from './dom.ts';
import { formats, type Locale, type Localized } from '../lib/i18n.ts';

const words = {
	built: { fr: 'Build :', en: 'Built:' },
	// Hors d'un dépôt git, pas de commit à montrer : le repli le dit plutôt qu'une valeur vide.
	noCommit: { fr: 'commit inconnu (build hors dépôt git)', en: 'unknown commit (built outside git)' },
} satisfies Record<string, Localized<string>>;

/** La sortie de :version pour le Volet. */
export function version(locale: Locale): Node[] {
	const { commit, date, versions } = __BUILD__;
	const built = new Intl.DateTimeFormat(formats[locale].intl, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));
	return [
		el('p', '', el('b', '', 'PORTFOLIO'), ' ', commit ?? words.noCommit[locale]),
		el('p', '', `${words.built[locale]} ${built}`),
		el('p', '', `Astro v${versions.astro}`),
	];
}
