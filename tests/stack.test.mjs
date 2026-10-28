// Section 04 · Stack : l'Atome (spec #80) et sa légende, les technologies par famille, puis les outils du
// quotidien, dans les deux versions. Le dessin se vérifie à la main ; ici, ce que la page livre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elementAt, elements, text } from './helpers/dist.mjs';

/** Les technologies de chaque famille, dans l'ordre de la planche 34 : ce que lit un lecteur d'écran. */
const ITEMS = [
	'TypeScript Rust PHP SQL Go Lua',
	'PostgreSQL Redis Prisma Drizzle',
	'NestJS Laravel Axum Elysia Node GraphQL REST',
	'React Next.js Vue Vite Tailwind',
	'OpenLayers MapLibre GL PostGIS Three.js',
	'Docker CI/CD Cloudflare AWS Sentry',
	'Bun Monorepo Git Neovim tmux Agile/Scrum',
];

/** Les logos des Pastilles, Bague par Bague, dans l'ordre de la planche : les technologies qui en ont un. */
const LOGOS = [
	['typescript', 'rust', 'php', 'go', 'lua'],
	['postgresql', 'redis', 'prisma', 'drizzle'],
	['nestjs', 'laravel', 'nodedotjs', 'graphql'],
	['react', 'nextdotjs', 'vuedotjs', 'vite', 'tailwindcss'],
	['openlayers', 'maplibre', 'threedotjs'],
	['docker', 'cloudflare', 'aws', 'sentry'],
	['bun', 'git', 'neovim', 'tmux'],
];

const VERSIONS = [
	{
		locale: 'fr',
		categories: ['Langages', 'Data', 'Back-end', 'Front-end', 'Carto & 3D', 'DevOps', 'Outils'],
		tools: 'éditeur : neovim · multiplexeur : tmux · runtime : bun — la config est sur GitHub',
	},
	{
		locale: 'en',
		categories: ['Languages', 'Data', 'Back-end', 'Front-end', 'Mapping & 3D', 'DevOps', 'Tooling'],
		tools: 'editor: neovim · multiplexer: tmux · runtime: bun — the config is on GitHub',
	},
];

// Ce qu'un lecteur d'écran lit : les éléments `aria-hidden` (sans enfants ici) retirés.
const spoken = (fragment) => text(fragment.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/g, '')).replace(/\s+/g, ' ');

/** L'élément complet dont la balise ouvrante porte la classe `name`. */
const byClass = (html, name) => elementAt(html, html.search(new RegExp(`<[a-z]+\\b[^>]*\\bclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"`)));

for (const { locale, categories, tools: toolsLine } of VERSIONS) {
	const html = readHome(locale);
	const at = html.search(/<section\b[^>]*\sid="stack"/);
	const section = elementAt(html, at) ?? '';

	test(`${locale} : la section Stack est la cible de l’ancre #stack et porte son h2`, () => {
		assert.ok(section, 'aucune <section id="stack">');
		const h2s = elements(section, 'h2');
		assert.equal(h2s.length, 1);
		assert.equal(text(h2s[0]), 'Stack');
		assert.match(text(section), /^04\s*Stack\s*:set stack\?/);
	});

	test(`${locale} : sept familles, dans l’ordre de la planche`, () => {
		const [dl] = elements(section, 'dl');
		assert.ok(dl, 'liste de définitions absente');
		assert.deepEqual(elements(dl, 'dt').map(spoken), categories);
		assert.equal(elements(dl, 'dd').length, 7);
	});

	test(`${locale} : la légende est numérotée à l’écran, sans numéro ni « / » pour les lecteurs d’écran`, () => {
		const [dl] = elements(section, 'dl');
		const dts = elements(dl, 'dt');
		assert.deepEqual(
			dts.map((dt) => text(dt).slice(0, 2)),
			['01', '02', '03', '04', '05', '06', '07'],
		);
		const dds = elements(dl, 'dd');
		// Espace insécable avant « / » : la barre ne commence jamais une ligne.
		assert.equal(text(dds[0]), 'TypeScript / Rust / PHP / SQL / Go / Lua');
		assert.deepEqual(dds.map(spoken), ITEMS);
	});

	test(`${locale} : les outils du quotidien, avec le lien vers la config Neovim`, () => {
		const tools = elements(section, 'p').find((p) => /neovim/.test(text(p)));
		assert.ok(tools, 'ligne des outils absente');
		assert.equal(text(tools), toolsLine);
		const [link] = tags(tools, 'a');
		assert.equal(attr(link, 'href'), 'https://github.com/Popoch39/nvim');
	});

	test(`${locale} : l’Atome est décoratif, caché aux lecteurs d’écran`, () => {
		const atom = byClass(section, 'atom');
		assert.ok(atom, 'Atome absent');
		assert.equal(attr(tags(atom, 'div')[0], 'aria-hidden'), 'true');
	});

	test(`${locale} : sept Bagues, une Pastille par technologie qui a un logo, AWS compris`, () => {
		const atom = byClass(section, 'atom') ?? '';
		const rings = [];
		for (let rest = atom.slice(1), ring = byClass(rest, 'ring'); ring; rest = rest.slice(rest.indexOf(ring) + ring.length), ring = byClass(rest, 'ring')) {
			rings.push(ring);
		}
		const logos = rings.map((ring) => tags(ring, 'use').map((use) => attr(use, 'href')?.replace(/^#logo-/, '')));
		assert.deepEqual(logos, LOGOS);
		assert.equal(logos.flat().length, 29);
		for (const ring of rings) assert.equal(tags(ring, 'svg').filter((t) => /\bclass="[^"]*\blayer\b/.test(t)).length, 5, 'cinq calques par Bague');
	});

	test(`${locale} : un symbole par logo utilisé, une seule fois dans la page`, () => {
		const symbols = tags(html, 'symbol').map((t) => attr(t, 'id')).filter((id) => id?.startsWith('logo-'));
		const used = [...new Set(tags(html, 'use').map((t) => attr(t, 'href')).filter((href) => href?.startsWith('#logo-')))].map((href) => href.slice(1));
		assert.equal(new Set(symbols).size, symbols.length, 'symbole en double');
		assert.deepEqual([...symbols].sort(), [...used].sort());
		assert.equal(symbols.length, 29);
	});
}
