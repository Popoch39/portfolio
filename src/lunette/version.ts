// :version (#61), à la façon de `nvim --version` : le nom et le commit, puis la date du build et la
// version d'Astro, une ligne chacun. Les valeurs sont celles du build, injectées par `vite.define`.
import { formats, type Locale, type Localized } from '../lib/i18n.ts';

const words = {
	built: { fr: 'Build :', en: 'Built:' },
	// Hors d'un dépôt git, pas de commit à montrer : le repli le dit plutôt qu'une valeur vide.
	noCommit: { fr: 'commit inconnu (build hors dépôt git)', en: 'unknown commit (built outside git)' },
} satisfies Record<string, Localized<string>>;

const line = (...children: (Node | string)[]) => {
	const p = document.createElement('p');
	p.append(...children);
	return p;
};

/** La sortie de :version pour le Volet. */
export function version(locale: Locale): Node[] {
	const { commit, date, versions } = __BUILD__;
	const built = new Intl.DateTimeFormat(formats[locale].intl, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));
	const name = Object.assign(document.createElement('b'), { textContent: 'PORTFOLIO' });
	return [
		line(name, ' ', commit ?? words.noCommit[locale]),
		line(`${words.built[locale]} ${built}`),
		line(`Astro v${versions.astro}`),
	];
}
