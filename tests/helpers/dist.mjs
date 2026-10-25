// Lecture de la sortie du build : le seul seam testé (cf. spec #1, « Testing Decisions »).
// Pas de parseur HTML pour rester sans dépendance : les helpers ciblent des motifs
// simples du HTML minifié produit par Astro.
import { readFileSync, existsSync } from 'node:fs';

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

export const readHome = () => readDist('index.html');

/** Toutes les occurrences d'une balise ouvrante, attributs compris (ex. `tags(html, 'link')`). */
export function tags(html, name) {
	return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

/** Valeur d'un attribut dans une balise ouvrante, ou `undefined`. */
export function attr(tag, name) {
	const m = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
	return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** Éléments complets `<name …>…</name>` (sans imbrication du même nom). */
export function elements(html, name) {
	return html.match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, 'gi')) ?? [];
}

/**
 * Texte d'un fragment : balises retirées sans insérer d'espace (comme `textContent`,
 * pour qu'un espace manquant entre deux `<span>` se voie), entités courantes décodées,
 * blancs ASCII normalisés. Les espaces insécables (U+00A0, U+202F de `Intl`) sont
 * conservés : ils font partie de la typographie testée.
 */
export function text(fragment) {
	return fragment
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&nbsp;|&#160;/g, ' ')
		.replace(/[ \t\n\r\f]+/g, ' ')
		.trim();
}

/** Toute la CSS livrée dans la page (contenu des balises `<style>`). */
export function css(html) {
	return elements(html, 'style')
		.map((el) => el.replace(/^<style\b[^>]*>|<\/style>$/gi, ''))
		.join('\n');
}
