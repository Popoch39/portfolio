// Logos des technologies, tirés au build de Simple Icons (CC0, `src/vendor/simple-icons/`) et, pour AWS
// retiré de Simple Icons, du logo officiel (`src/vendor/aws/`, hors CC0) : chaque page n'en livre que
// ceux qu'elle dessine, une fois, en symboles réutilisés (notes des fiches, Pastilles de l'Atome).
import type { Tech } from './contract.ts';

const files = import.meta.glob<string>(['../vendor/simple-icons/*.svg', '../vendor/aws/*.svg'], { query: '?raw', import: 'default', eager: true });

export interface Logo {
	/** Le nom de la technologie, celui de Simple Icons (« TypeScript »). */
	name: string;
	/** Le cadre du tracé : un carré de 24 unités chez Simple Icons, celui du fichier officiel sinon. */
	viewBox: string;
	/** Le tracé du logo, ses chemins mis bout à bout. */
	path: string;
}

const logos = new Map(
	Object.entries(files).map(([file, svg]) => {
		const key = file.split('/').pop()!.replace(/\.svg$/, '');
		const name = /<title>([^<]+)<\/title>/.exec(svg)?.[1];
		const viewBox = /\sviewBox="([^"]+)"/.exec(svg)?.[1];
		const paths = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
		if (!name || !viewBox || !paths.length) throw new Error(`Logo « ${key} » : titre, cadre ou tracé introuvable`);
		// Bout à bout, un `m` relatif partirait de la fin du chemin précédent au lieu de l'origine.
		if (paths.slice(1).some((d) => !d.startsWith('M'))) throw new Error(`Logo « ${key} » : un chemin suivant ne part pas d'un M absolu`);
		return [key, { name: name.replaceAll('&amp;', '&'), viewBox, path: paths.join('') }] as const;
	}),
);

export function logoOf(tech: Tech): Logo {
	const logo = logos.get(tech);
	if (!logo) throw new Error(`Logo « ${tech} » absent de src/vendor/`);
	return logo;
}

/** Nombre de paramètres de chaque commande de chemin SVG. */
const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iy;

/** Les segments d'un tracé : commande telle qu'écrite (majuscule = absolue) et paramètres. */
function segments(d: string): { command: string; args: number[] }[] {
	const found: { command: string; args: number[] }[] = [];
	let command = '';
	let at = 0;
	const skip = () => {
		while (at < d.length && /[\s,]/.test(d[at])) at++;
	};
	for (skip(); at < d.length; skip()) {
		if (/[a-z]/i.test(d[at])) {
			command = d[at++];
			if (command.toLowerCase() === 'z') {
				found.push({ command, args: [] });
				continue;
			}
			skip();
		} else if (command.toLowerCase() === 'z' || !command) throw new Error(`Tracé illisible à ${at} : ${d.slice(at, at + 12)}`);
		const lower = command.toLowerCase();
		const args: number[] = [];
		for (let k = 0; k < ARITY[lower]; k++, skip()) {
			// Les drapeaux d'un arc tiennent en un chiffre, souvent collé au suivant (`a2 2 0 012 2`).
			if (lower === 'a' && (k === 3 || k === 4)) {
				args.push(Number(d[at++]));
				continue;
			}
			NUMBER.lastIndex = at;
			const m = NUMBER.exec(d);
			if (!m) throw new Error(`Tracé illisible à ${at} : ${d.slice(at, at + 12)}`);
			args.push(Number(m[0]));
			at = NUMBER.lastIndex;
		}
		found.push({ command, args });
		// Après un `moveto`, les paires suivantes sont des `lineto`.
		if (lower === 'm') command = command === 'm' ? 'l' : 'L';
	}
	return found;
}

/**
 * Le logo redessiné sur une grille de `grid` unités entières (son plus grand côté) : à la taille d'une
 * Pastille (10 px), une unité vaut un dixième de pixel, et le tracé pèse deux fois moins. Chaque point
 * est arrondi en coordonnées absolues, puis réécrit en relatif depuis le point précédent arrondi : les
 * arrondis ne s'accumulent pas le long du chemin.
 */
export function compactLogo(logo: Logo, grid = 96): Logo {
	const [minX, minY, width, height] = logo.viewBox.split(/[\s,]+/).map(Number);
	const k = grid / Math.max(width, height);
	const round = (n: number) => Math.round(n * k);
	let x = 0, y = 0, startX = 0, startY = 0; // position exacte
	let rx = 0, ry = 0, rStartX = 0, rStartY = 0; // position arrondie
	let out = '';
	let previous = '';
	const emit = (command: string, values: number[]) => {
		if (command !== previous || command === 'm') out += command;
		else if (values[0] >= 0) out += ' ';
		out += values.map((v, i) => (i > 0 && v >= 0 ? ` ${v}` : `${v}`)).join('');
		previous = command;
	};
	for (const { command, args } of segments(logo.path)) {
		const lower = command.toLowerCase();
		const relative = command === lower;
		if (lower === 'z') {
			[x, y, rx, ry] = [startX, startY, rStartX, rStartY];
			if (previous !== 'z') out += 'z';
			previous = 'z';
			continue;
		}
		if (lower === 'h' || lower === 'v') {
			const horizontal = lower === 'h';
			const to = (relative ? (horizontal ? x : y) : 0) + args[0];
			const rounded = round(to - (horizontal ? minX : minY));
			emit(lower, [rounded - (horizontal ? rx : ry)]);
			if (horizontal) [x, rx] = [to, rounded];
			else [y, ry] = [to, rounded];
			continue;
		}
		// Les points du segment (contrôles puis extrémité), en absolu exact puis arrondi.
		const pointArgs = lower === 'a' ? args.slice(5) : args;
		const points: [number, number][] = [];
		for (let i = 0; i < pointArgs.length; i += 2) points.push([(relative ? x : 0) + pointArgs[i], (relative ? y : 0) + pointArgs[i + 1]]);
		const rounded = points.map(([px, py]) => [round(px - minX), round(py - minY)]);
		const deltas = rounded.flatMap(([px, py]) => [px - rx, py - ry]);
		emit(lower, lower === 'a' ? [round(args[0]), round(args[1]), Math.round(args[2]), args[3], args[4], ...deltas] : deltas);
		[x, y] = points.at(-1)!;
		[rx, ry] = rounded.at(-1)!;
		if (lower === 'm') [startX, startY, rStartX, rStartY] = [x, y, rx, ry];
	}
	return { name: logo.name, viewBox: `0 0 ${round(width)} ${round(height)}`, path: out };
}
