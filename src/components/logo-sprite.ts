import { createHash } from 'node:crypto';
import { stack, toolLogos } from '../data/profile';

/*
 * The logo sprite of the Atome's pastilles (ADR 0004), built at build time into its own SVG file:
 * kept out of the home HTML so the first paint does not wait for paths the Stack only shows below the fold.
 * The pastilles point at its symbols with `<use href>`; the file name carries a hash of its content,
 * so it can be cached for good.
 */

const sources = import.meta.glob<string>('../assets/logos/*.svg', {
	query: '?raw',
	import: 'default',
	eager: true,
});

// A misspelt tool would otherwise lose its pastille without a word.
const stackItems = new Set(stack.flatMap((group) => group.items));
const strays = Object.keys(toolLogos).filter((tool) => !stackItems.has(tool));
if (strays.length) throw new Error(`toolLogos names tools missing from the stack: ${strays.join(', ')}`);

/** The single path of a simple-icons file, without its title or role: the label already names the tool. */
function logoPath(slug: string) {
	const source = sources[`../assets/logos/${slug}.svg`];
	const path = source?.match(/<path d="([^"]+)"/)?.[1];
	if (!path) throw new Error(`No single-path logo for "${slug}" in src/assets/logos/`);
	return path;
}

const slugs = [...new Set(stack.flatMap((group) => group.items.map((item) => toolLogos[item]).filter(Boolean)))];

export const spriteSource = [
	'<svg xmlns="http://www.w3.org/2000/svg">',
	...slugs.map((slug) => `<symbol id="logo-${slug}" viewBox="0 0 24 24"><path d="${logoPath(slug)}"/></symbol>`),
	'</svg>',
].join('');

export const spriteVersion = createHash('sha256').update(spriteSource).digest('hex').slice(0, 10);

/** The `<use href>` of a tool's logo, or nothing for a tool without one (it stays in the label only). */
export function logoHref(tool: string) {
	const slug = toolLogos[tool];
	return slug && `/logos/${spriteVersion}.svg#logo-${slug}`;
}
