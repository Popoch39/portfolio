// Réduit les polices à ce que le site affiche (ADR 0005) : relève dans le build les caractères dont
// chaque police a besoin, coupe les sources de src/vendor/fonts/ avec subset-font (harfbuzz) et écrit
// les woff2 servis par le site → src/fonts/, avec le relevé qui les explique (src/fonts/releve.json).
// Lancé à la main (`pnpm build && pnpm polices`) quand un texte gagne un caractère : `pnpm test`
// échoue tant qu'un caractère du build manque à la police qui le dessine. Relancé sans changement,
// il réécrit les mêmes octets.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import subsetFont from 'subset-font';

const root = new URL('../', import.meta.url);

/** L'ASCII imprimable, et les points de suspension que `text-overflow: ellipsis` dessine sans qu'ils soient écrits. */
const BASE = String.fromCharCode(...Array.from({ length: 95 }, (_, i) => 32 + i)) + '…';

/**
 * Les features gardées : celles que le navigateur applique d'office, parmi celles que livrait Google
 * Fonts (qui n'avait pas `rlig` pour la mono). Les autres (fractions, chiffres tabulaires…), aucune
 * règle CSS ne les demande à ces polices : les garder coûterait des glyphes jamais dessinés.
 */
const ARCHIVO_FEATURES = ['ccmp', 'kern', 'liga', 'locl', 'mark', 'mkmk', 'rvrn'];

/**
 * Les trois polices servies. Sans hinting, comme celles que servait Google Fonts : il ne joue que
 * sous Windows et pèse un tiers de la mono. L'axe de largeur s'arrête à 100 % : le site ne dessine
 * rien de plus large, et l'italique n'est dessinée qu'à 100 %.
 */
const FONTS = {
	romaine: { source: 'Archivo[wdth,wght].ttf', output: 'archivo.woff2', axes: { wdth: { min: 62, max: 100 } }, features: ARCHIVO_FEATURES },
	italique: { source: 'Archivo-Italic[wdth,wght].ttf', output: 'archivo-italique.woff2', axes: { wdth: 100 }, features: ARCHIVO_FEATURES },
	mono: { source: 'FragmentMono-Regular.ttf', output: 'fragment-mono.woff2', features: ['calt', 'ccmp', 'locl', 'mark', 'mkmk'] },
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: String.fromCharCode(0xa0) };
const decode = (html) =>
	html.replace(/&(?:#x([\da-f]+)|#(\d+)|(\w+));/gi, (entity, hex, dec, name) =>
		hex || dec ? String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec)) : (ENTITIES[name] ?? entity),
	);

/** Les caractères qu'un texte fait dessiner, sans les caractères de contrôle. */
const charsOf = (text) => [...text].filter((char) => !/\p{Cc}/u.test(char));

/**
 * Les caractères de la romaine et de la mono : l'ASCII imprimable, plus tout caractère d'un fichier
 * du build (HTML, SVG, modules JS), où qu'il soit : texte, CSS (`content`), attribut ou chaîne. Leurs
 * capitales en plus, pour `text-transform: uppercase`.
 */
function upright(files) {
	const chars = new Set(BASE);
	for (const content of files) for (const char of charsOf(decode(content))) if (char.codePointAt(0) > 0x7e) chars.add(char);
	for (const char of [...chars]) for (const upper of char.toUpperCase()) chars.add(upper);
	return chars;
}

/** Les caractères de l'italique : le texte des `<em>` et des `<i>` des pages, et l'espace qui les sépare. */
function italic(pages) {
	const chars = new Set(' ');
	for (const html of pages) {
		for (const [, , inner] of html.matchAll(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
			for (const char of charsOf(decode(inner.replace(/<[^>]+>/g, '')))) chars.add(char);
		}
	}
	return chars;
}

/** Les fichiers du build dont on relève le texte, par extension. */
function distFiles(dir = new URL('dist/', root)) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? distFiles(new URL(`${entry.name}/`, dir)) : ['.html', '.svg', '.js'].includes(extname(entry.name)) ? [new URL(entry.name, dir)] : [],
	);
}

/** Un ensemble de caractères en chaîne triée : le relevé ne bouge que si un caractère change. */
const sorted = (chars) => [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');

async function main() {
	if (!existsSync(new URL('dist/index.html', root))) throw new Error('dist/index.html introuvable : lancer `pnpm build` avant `pnpm polices`.');
	const files = distFiles();
	const contents = files.map((file) => readFileSync(file, 'utf8'));
	const pages = contents.filter((_, i) => files[i].pathname.endsWith('.html'));
	const releve = { romaine: sorted(upright(contents)), italique: sorted(italic(pages)) };
	releve.mono = releve.romaine;
	for (const [name, { source, output, axes, features }] of Object.entries(FONTS)) {
		const font = await subsetFont(readFileSync(new URL(`src/vendor/fonts/${source}`, root)), releve[name], {
			targetFormat: 'woff2',
			keepFeatures: features,
			noHinting: true,
			...(axes && { variationAxes: axes }),
		});
		writeFileSync(new URL(`src/fonts/${output}`, root), font);
		console.log(`Police écrite : src/fonts/${output} (${font.length} o, ${[...releve[name]].length} caractères)`);
	}
	// Un relevé par ligne : le diff dit quels caractères ont fait changer quelle police.
	const lines = Object.entries(releve).map(([name, chars]) => `\t${JSON.stringify(name)}: ${JSON.stringify(chars)}`);
	writeFileSync(new URL('src/fonts/releve.json', root), `{\n${lines.join(',\n')}\n}\n`);
	console.log('Relevé écrit : src/fonts/releve.json');
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
