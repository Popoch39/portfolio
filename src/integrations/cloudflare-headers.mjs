// `_headers` de Cloudflare Pages, écrit à la fin du build (spec #46, ticket #51) : ce que le CDN garde
// en cache, et les préchargements qu'il envoie en Early Hints (103) avant le HTML.
// Une intégration plutôt qu'un endpoint : elle lit le HTML construit, donc annonce exactement ce que
// chaque `<head>` précharge, noms hachés compris, sans dupliquer le choix des polices du layout.
// Cloudflare ne tire pas ces `Link` du HTML lui-même : il ignore les `<link>` qui portent `crossorigin`.
// En JS, comme les commandes de `scripts/` : seul module de `src/` à importer Node, il n'oblige pas
// le projet à ajouter les types de Node.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fichiers versionnés par hachage : leur nom change avec leur contenu. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Pages : une nouvelle version se voit aussitôt. */
const REVALIDATE = 'public, max-age=0, must-revalidate';
/** Fichiers à nom fixe (figures autonomes, images de partage, favicons) : une heure. */
const SHORT = 'public, max-age=3600';
/** Laissés aux en-têtes par défaut de Cloudflare. */
const UNTOUCHED = new Set(['robots.txt', 'sitemap.xml', '_headers']);

/**
 * Attributs d'une balise ouvrante, valeur vide pour un attribut booléen (`crossorigin`).
 * @param {string} tag
 * @returns {Map<string, string>}
 */
function attributes(tag) {
	const found = tag.matchAll(/\s([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g);
	return new Map([...found].map(([, name, ...values]) => [name.toLowerCase(), values.find((v) => v !== undefined) ?? '']));
}

/**
 * Les préchargements du `<head>` d'une page, en valeurs d'en-tête `Link`.
 * @param {string} html
 * @returns {string[]}
 */
function preloadLinks(html) {
	const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? '';
	return [...head.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
		const attrs = attributes(tag);
		const href = attrs.get('href');
		if (attrs.get('rel') !== 'preload' || !href) return [];
		const crossorigin = attrs.get('crossorigin');
		return [
			[
				`<${href}>`,
				'rel=preload',
				attrs.has('as') && `as=${attrs.get('as')}`,
				attrs.has('type') && `type="${attrs.get('type')}"`,
				crossorigin !== undefined && (crossorigin ? `crossorigin=${crossorigin}` : 'crossorigin'),
			]
				.filter(Boolean)
				.join('; '),
		];
	});
}

/**
 * Le contenu de `_headers` pour le build rangé dans `root`.
 * @param {string} root
 * @returns {string}
 */
function headersOf(root) {
	const files = readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
		.filter((file) => !UNTOUCHED.has(file))
		.sort();
	const pages = files
		.filter((file) => file.endsWith('.html'))
		.map((file) => ({
			pattern: `/${file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`,
			headers: [`Cache-Control: ${REVALIDATE}`, ...preloadLinks(readFileSync(join(root, file), 'utf8')).map((link) => `Link: ${link}`)],
		}));
	// Un motif par dossier plutôt que par fichier : Cloudflare ne lit que 100 règles.
	const short = new Set(
		files
			.filter((file) => !file.startsWith('_astro/') && !file.endsWith('.html'))
			.map((file) => (file.includes('/') ? `/${posix.dirname(file)}/*` : `/${file}`)),
	);
	const rules = [
		{ pattern: '/_astro/*', headers: [`Cache-Control: ${IMMUTABLE}`] },
		...pages,
		...[...short].map((pattern) => ({ pattern, headers: [`Cache-Control: ${SHORT}`] })),
	];
	const body = rules.map(({ pattern, headers }) => [pattern, ...headers.map((header) => `  ${header}`)].join('\n'));
	return ['# Généré par `astro build` (src/integrations/cloudflare-headers.mjs) : ne pas modifier à la main.', ...body, ''].join('\n');
}

/** @returns {import('astro').AstroIntegration} */
export function cloudflareHeaders() {
	return {
		name: 'cloudflare-headers',
		hooks: {
			'astro:build:done': ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				writeFileSync(join(root, '_headers'), headersOf(root));
				logger.info('_headers écrit');
			},
		},
	};
}
