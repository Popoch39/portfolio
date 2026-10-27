// Lecture de la sortie du build : le seul seam testé (cf. spec #1, « Testing Decisions »).
// Pas de parseur HTML pour rester sans dépendance : les helpers ciblent des motifs
// simples du HTML minifié produit par Astro.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = new URL('../../dist/', import.meta.url);

/**
 * Contenu d'un fichier de `dist/` (ex. `index.html`, `robots.txt`) : texte, ou `Buffer`
 * avec `encoding: null` pour un fichier binaire.
 */
export function readDist(path, encoding = 'utf8') {
	const url = new URL(path, DIST);
	if (!existsSync(url)) {
		throw new Error(`dist/${path} introuvable : lancer \`pnpm build\` (ou \`pnpm test\`, qui build d'abord).`);
	}
	return readFileSync(url, encoding);
}

/** Tous les fichiers de `dist/`, en chemins relatifs triés (`index.html`, `_astro/fonts/x.woff2`). */
export function distFiles() {
	if (!existsSync(DIST)) throw new Error("dist/ introuvable : lancer `pnpm build` (ou `pnpm test`, qui build d'abord).");
	const root = fileURLToPath(DIST);
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(root, join(entry.parentPath, entry.name)))
		.sort();
}

/** HTML de la page servie à un chemin du site (`/`, `/en/`, `/projets/trekker/`). */
export const readPage = (pathname) => readDist(`${pathname.slice(1)}index.html`);

/** Adresse de l'accueil dans chaque langue. */
export const HOME = { fr: '/', en: '/en/' };

/** HTML de l'accueil, en français par défaut. */
export const readHome = (locale = 'fr') => readPage(HOME[locale]);

/** Le `<head>` d'une page. */
export const headOf = (html) => elements(html, 'head')[0] ?? '';

/** Les `<link rel="alternate" hreflang>` d'une page : `{ fr, en, 'x-default' }` → URL. */
export function alternates(html) {
	const links = tags(headOf(html), 'link').filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang'));
	return Object.fromEntries(links.map((t) => [attr(t, 'hreflang'), attr(t, 'href')]));
}

/** Projets mis en avant, dans l'ordre de l'accueil : adresse de la fiche et nom du dépôt. */
export const PROJECTS = [
	{ slug: 'typomaniac', repo: 'typomaniac' },
	{ slug: 'claude-tmux-notify', repo: 'claude-tmux-notify.nvim' },
	{ slug: 'claude-status-line', repo: 'claude-status-line' },
	{ slug: 'pointcloud-viewer', repo: 'pointcloud-viewer' },
	{ slug: 'trekker', repo: 'trekker' },
	{ slug: 'ma-parcelle', repo: 'ma_parcelle' },
];

/** Adresse de la fiche d'un projet dans chaque langue : le segment est traduit, pas le slug. */
export const FICHE = { fr: (slug) => `/projets/${slug}/`, en: (slug) => `/en/projects/${slug}/` };

/** HTML de la fiche d'un projet, en français par défaut. */
export const readFiche = (slug, locale = 'fr') => readPage(FICHE[locale](slug));

/** Adresse de la figure au repos autonome d'un projet : une par version, puisqu'elle porte un libellé. */
export const FIGURE = { fr: (slug) => `/figures/${slug}.svg`, en: (slug) => `/en/figures/${slug}.svg` };

/** Toutes les occurrences d'une balise ouvrante, attributs compris (ex. `tags(html, 'link')`). */
export function tags(html, name) {
	return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

/** Valeur d'un attribut dans une balise ouvrante, ou `undefined`. */
export function attr(tag, name) {
	const m = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
	return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** Présence d'un attribut dans une balise ouvrante, avec ou sans valeur (`data-master`). */
export function hasAttr(tag, name) {
	return new RegExp(`\\s${name}(?=[\\s=>/])`, 'i').test(tag);
}

/** Éléments complets `<name …>…</name>` (sans imbrication du même nom). */
export function elements(html, name) {
	return html.match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, 'gi')) ?? [];
}

/**
 * Texte d'un fragment : balises retirées sans insérer d'espace (comme `textContent`,
 * pour qu'un espace manquant entre deux `<span>` se voie), entités courantes décodées,
 * blancs ASCII normalisés. Les espaces insécables (U+00A0, U+202F de `Intl`) sont
 * conservés : ils font partie de la typographie testée. Les césures conditionnelles,
 * invisibles tant que le mot tient sur sa ligne, sont retirées.
 */
export function text(fragment) {
	return fragment
		.replace(/<[^>]+>/g, '')
		.replace(/&shy;|­/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&nbsp;|&#160;/g, ' ')
		.replace(/[ \t\n\r\f]+/g, ' ')
		.trim();
}

/**
 * Code d'un script module servi par le site (`/_astro/x.js`) et des morceaux qu'il importe
 * statiquement, de proche en proche : ce que le navigateur exécute au chargement de la page.
 * Les morceaux importés à la demande (`import("./y.js")`) n'en font pas partie.
 */
export function moduleGraph(src) {
	const seen = new Map();
	const visit = (path) => {
		if (seen.has(path)) return;
		const code = readDist(path.slice(1));
		seen.set(path, code);
		for (const [, chunk] of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\/[\w.-]+\.js)["']/g)) visit(new URL(chunk, `file://${path}`).pathname);
	};
	visit(src);
	return { paths: [...seen.keys()], code: [...seen.values()].join('\n') };
}

/** La CSS sans les blocs dont l'en-tête répond à `opening` (ex. `/@keyframes\s+vt-/`), contenu compris. */
export function withoutBlocks(styles, opening) {
	let rest = styles;
	for (let at = rest.search(opening); at >= 0; at = rest.search(opening)) {
		let end = rest.indexOf('{', at);
		for (let depth = 1; depth > 0; ) depth += rest[++end] === '{' ? 1 : rest[end] === '}' ? -1 : 0;
		rest = rest.slice(0, at) + rest.slice(end + 1);
	}
	return rest;
}

/** Toute la CSS livrée dans la page (contenu des balises `<style>`). */
export function css(html) {
	return elements(html, 'style')
		.map((el) => el.replace(/^<style\b[^>]*>|<\/style>$/gi, ''))
		.join('\n');
}
