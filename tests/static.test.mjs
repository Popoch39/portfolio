// Les pages sont statiques et autonomes : aucune feuille de style externe.
// Règles de D1 révisées pour les figures (ADR 0001) : pour tout script, le JSON-LD et le chargeur
// des figures ; l'attribut `style` n'est toléré que dans les SVG de figure, `animation` et
// `@keyframes` que dans la CSS des figures (kit et palette, sélecteurs `.iso`, noms `iso-`) ;
// jamais de `:hover`, et `transition` seulement dans la CSS des notes de la figure (ADR 0003). La view
// transition lettre à lettre (ADR 0004) ajoute son script en ligne, ses `@keyframes` `vt-` et ses
// animations de pseudo-éléments `::view-transition-*`. Les polices sont réduites en local (ADR 0005) :
// romaine et italique d'Archivo préchargées, axe de largeur coupé à ce que le site dessine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, elements, css, withoutBlocks } from './helpers/dist.mjs';

const html = readHome();
const styles = css(html);
const pages = [
	{ name: 'accueil', html },
	{ name: 'accueil anglais', html: readHome('en') },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, html: readFiche(slug) })),
	...PROJECTS.map(({ slug }) => ({ name: `fiche anglaise ${slug}`, html: readFiche(slug, 'en') })),
];

/** Le HTML sans les SVG de figure (`<svg class="iso-svg …">`), où le kit émet des attributs `style`. */
const withoutFigures = (page) =>
	elements(page, 'svg').reduce((rest, svg) => (/\bclass="[^"]*\biso-svg\b/.test(tags(svg, 'svg')[0]) ? rest.replace(svg, '') : rest), page);

test('scripts limités au JSON-LD, au chargeur (au plus un module, servi par le site), à la view transition et aux règles de prérendu', () => {
	for (const page of pages) {
		// Les règles de prérendu (ADR 0006), vérifiées par speculation.test.mjs : un bloc de JSON, pas du code.
		const rules = elements(page.html, 'script').filter((s) => attr(tags(s, 'script')[0], 'type') === 'speculationrules');
		assert.equal(rules.length, 1, `${page.name} : règles de prérendu`);
		const all = elements(page.html, 'script').filter((s) => !['application/ld+json', 'speculationrules'].includes(attr(tags(s, 'script')[0], 'type') ?? ''));
		// Le script de la transition, vérifié par transition.test.mjs : le seul en ligne.
		const transition = all.filter((s) => !attr(tags(s, 'script')[0], 'src') && /pagereveal/.test(s));
		assert.equal(transition.length, 1, `${page.name} : script de la transition`);
		const scripts = all.filter((s) => !transition.includes(s)).map((s) => tags(s, 'script')[0]);
		assert.ok(scripts.length <= 1, `${page.name} : ${scripts.length} scripts hors JSON-LD et transition`);
		for (const script of scripts) {
			assert.equal(attr(script, 'type'), 'module', page.name);
			assert.match(attr(script, 'src') ?? '', /^\/_astro\/[\w.-]+\.js$/, `${page.name} : ${script}`);
		}
	}
});

test('aucune feuille de style externe', () => {
	for (const page of pages) {
		const stylesheets = tags(page.html, 'link').filter((t) => /\bstylesheet\b/i.test(attr(t, 'rel') ?? ''));
		assert.deepEqual(stylesheets, [], page.name);
	}
});

test('aucun attribut style inline hors des SVG de figure', () => {
	for (const page of pages) {
		const withStyle = (withoutFigures(page.html).match(/<[a-z][^>]*\sstyle=/gi) ?? []).map((t) => t.slice(0, 80));
		assert.deepEqual(withStyle, [], page.name);
	}
});

test('la CSS livrée n’a ni :hover ni transition hors des notes de la figure, et ses animations sont celles du kit', () => {
	for (const page of pages) {
		const pageStyles = css(page.html);
		assert.ok(pageStyles.length > 0, `${page.name} : aucune CSS trouvée`);
		// ADR 0003 : les transitions ne vivent que dans la CSS des notes, sous `.annot`
		// (`view-transition-name` n'en est pas une).
		const transitioned = [...pageStyles.matchAll(/([^{}]+)\{[^{}]*(?<!view-)\btransition(?:-[a-z-]+)?\s*:[^{}]*\}/gi)].flatMap((m) => m[1].split(/,(?![^(]*\))/));
		assert.deepEqual(
			transitioned.map((selector) => selector.trim()).filter((selector) => !selector.startsWith('.annot')),
			[],
			`${page.name} : transition hors des notes`,
		);
		// La pseudo-classe, pas la requête média `(hover: hover)`, qui teste ce que sait le pointeur.
		assert.doesNotMatch(pageStyles, /(?<!\(\s*hover\s*):hover\b/i, page.name);
		const keyframes = [...pageStyles.matchAll(/@keyframes\s+([\w-]+)/gi)].map((m) => m[1]);
		assert.deepEqual(
			keyframes.filter((name) => !name.startsWith('iso-') && !name.startsWith('vt-')),
			[],
			`${page.name} : @keyframes hors du kit et de la transition`,
		);
		// Les étapes des `@keyframes vt-…` portent `animation-timing-function`.
		const animated = [...withoutBlocks(pageStyles, /@keyframes\s+vt-/).matchAll(/([^{}]+)\{[^{}]*\banimation(?:-[a-z-]+)?\s*:[^{}]*\}/gi)].flatMap((m) =>
			m[1].split(/,(?![^(]*\))/),
		);
		assert.deepEqual(
			animated.map((selector) => selector.trim()).filter((selector) => !selector.startsWith('.iso') && !selector.startsWith('::view-transition-')),
			[],
			`${page.name} : animation hors de la CSS du kit et de la transition`,
		);
	}
});

/** Les `@font-face` d'Archivo servis par le site (les faces de repli n'ont qu'un `local()`), par style. */
const archivoFaces = (pageStyles) =>
	Object.fromEntries(
		(pageStyles.match(/@font-face\s*{[^}]*}/gi) ?? [])
			.filter((f) => /font-family:[^;]*Archivo/i.test(f) && /src:\s*url\(/i.test(f))
			.map((face) => [face.match(/font-style:\s*(\w+)/)?.[1], face]),
	);

test('la romaine et l’italique d’Archivo sont préchargées, et elles seules', () => {
	for (const page of pages) {
		const faces = archivoFaces(css(page.html));
		const fileOf = (face) => face?.match(/url\(["']?(\/[^)"']+\.woff2)/)?.[1];
		const preloads = tags(page.html, 'link').filter((t) => attr(t, 'rel') === 'preload' && attr(t, 'as') === 'font');
		assert.deepEqual(preloads.map((t) => attr(t, 'href')).sort(), [fileOf(faces.normal), fileOf(faces.italic)].sort(), page.name);
		for (const preload of preloads) assert.equal(attr(preload, 'type'), 'font/woff2', page.name);
	}
});

test('Archivo est servie depuis le site, avec ses plages de graisse et de largeur', () => {
	const faces = archivoFaces(styles);
	assert.deepEqual(Object.keys(faces).sort(), ['italic', 'normal']);
	for (const face of Object.values(faces)) {
		assert.match(face, /url\(["']?\/[^)]+\.woff2/, 'police non auto-hébergée');
		assert.match(face, /font-weight:\s*100 900/);
	}
	// Les titres condensés vont de 62 % à 100 % ; l'italique n'est dessinée qu'à 100 % (ADR 0005).
	assert.match(faces.normal, /font-stretch:\s*62% 100%/);
	assert.match(faces.italic, /font-stretch:\s*100%/);
});

test('Fragment Mono est servie depuis le site', () => {
	const faces = styles.match(/@font-face\s*{[^}]*}/gi) ?? [];
	assert.ok(faces.some((f) => /font-family:[^;]*Fragment Mono/i.test(f) && /url\(["']?\/[^)]+\.woff2/.test(f)));
});

test('aucune page ne s’adresse à Google Fonts', () => {
	for (const page of pages) assert.doesNotMatch(page.html, /fonts\.(googleapis|gstatic)\.com/, page.name);
});
