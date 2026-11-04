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
	return roundPath(path);
}

/*
 * simple-icons draws to a thousandth of a unit in a 24-unit box: printed at 10px, a hundredth is
 * already a 240th of a pixel. Each point is rounded where it lands, never as an offset from the last
 * rounded one: a relative path would otherwise drift by its accumulated errors.
 */
const PRECISION = 100;
const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER = /[\s,]*([+-]?(?:\d+\.?\d*|\.\d+))/y;
// An arc's flags are single digits that the source may run into the next number ("01.5").
const FLAG = /[\s,]*([01])/y;

/** A number in hundredths, written as short as SVG reads it: ".5" for 0.5. */
function short(hundredths: number) {
	return (hundredths / PRECISION).toString().replace(/^(-?)0\./, '$1.');
}

/** The arguments of one path command, an arc's flags read one digit at a time. */
function readArguments(command: string, text: string) {
	const arity = ARITY[command.toLowerCase()];
	if (arity === undefined) throw new Error(`Unknown path command "${command}"`);
	const values: string[] = [];
	let at = 0;
	while (text.slice(at).replace(/[\s,]/g, '')) {
		const slot = values.length % arity;
		const pattern = command.toLowerCase() === 'a' && (slot === 3 || slot === 4) ? FLAG : NUMBER;
		pattern.lastIndex = at;
		const match = pattern.exec(text);
		if (!match) throw new Error(`Unreadable path arguments after "${command}": ${text}`);
		values.push(match[1]);
		at = pattern.lastIndex;
	}
	if (values.length % (arity || 1)) throw new Error(`Odd argument count after "${command}": ${text}`);
	return { arity, values };
}

/** The same path, every point rounded to a hundredth, its commands and their order untouched. */
function roundPath(d: string) {
	// The pen and the start of its subpath, per axis: exact, and rounded in hundredths.
	let pen = [0, 0];
	let penRounded = [0, 0];
	let start = [0, 0];
	let startRounded = [0, 0];
	let out = '';
	let last = '';
	const write = (value: string) => {
		const glued = value.startsWith('-') || (value.startsWith('.') && last.includes('.'));
		out += last && !glued ? ` ${value}` : value;
		last = value;
	};

	for (const [, command, text] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
		const kind = command.toLowerCase();
		const relative = command === kind;
		const { arity, values } = readArguments(command, text);
		out += command;
		last = '';
		if (kind === 'z') {
			pen = [...start];
			penRounded = [...startRounded];
		}

		for (let segment = 0; segment < values.length; segment += arity) {
			const from = [...pen];
			const fromRounded = [...penRounded];
			// A coordinate is rounded where it lands, then written from the rounded pen when relative.
			const coordinate = (value: string, axis: number) => {
				pen[axis] = Number(value) + (relative ? from[axis] : 0);
				penRounded[axis] = Math.round(pen[axis] * PRECISION);
				write(short(penRounded[axis] - (relative ? fromRounded[axis] : 0)));
			};
			const args = values.slice(segment, segment + arity);
			if (kind === 'h') coordinate(args[0], 0);
			else if (kind === 'v') coordinate(args[0], 1);
			else if (kind === 'a') {
				// Radii and rotation are lengths and an angle, not points.
				for (const value of args.slice(0, 3)) write(short(Math.round(Number(value) * PRECISION)));
				write(args[3]);
				write(args[4]);
				coordinate(args[5], 0);
				coordinate(args[6], 1);
			} else {
				args.forEach((value, index) => coordinate(value, index % 2));
				if (kind === 'm' && segment === 0) {
					start = [...pen];
					startRounded = [...penRounded];
				}
			}
		}
	}
	return out;
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
