// Les pages sont statiques et autonomes : aucune feuille de style externe.
// Règles de D1 révisées pour les figures (ADR 0001) : pour tout script, le JSON-LD et le chargeur
// des figures ; l'attribut `style` n'est toléré que dans les SVG de figure, `animation` et
// `@keyframes` que dans la CSS des figures (kit et palette, sélecteurs `.iso`, noms `iso-`) ;
// jamais de `:hover`, et `transition` seulement dans la CSS des notes de la figure (ADR 0003). La view
// transition lettre à lettre (ADR 0004) ajoute son script en ligne, ses `@keyframes` `vt-` et ses
// animations de pseudo-éléments `::view-transition-*`. La Lunette (ADR 0007) n'ajoute aucun script :
// le module de la page importe son écouteur, et elle-même n'arrive qu'à la première commande.
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

test('scripts limités au JSON-LD, au chargeur (au plus un module, servi par le site) et à la view transition', () => {
	for (const page of pages) {
		const all = elements(page.html, 'script').filter((s) => attr(tags(s, 'script')[0], 'type') !== 'application/ld+json');
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

test('une seule police préchargée, en woff2', () => {
	const preloads = tags(html, 'link').filter((t) => attr(t, 'rel') === 'preload' && attr(t, 'as') === 'font');
	assert.equal(preloads.length, 1);
	assert.match(attr(preloads[0], 'href') ?? '', /\.woff2$/);
});

test('Archivo est servie depuis le site, avec ses plages de graisse et de largeur', () => {
	const faces = styles.match(/@font-face\s*{[^}]*}/gi) ?? [];
	const archivo = faces.filter((f) => /font-family:[^;]*Archivo/i.test(f) && /src:\s*url\(/i.test(f));
	assert.ok(archivo.length > 0, '@font-face Archivo absent');
	for (const face of archivo) {
		assert.match(face, /url\(["']?\/[^)]+\.woff2/, 'police non auto-hébergée');
		assert.match(face, /font-weight:\s*100 900/);
		assert.match(face, /font-stretch:\s*62% 125%/);
	}
	const styleNames = archivo.map((f) => f.match(/font-style:\s*(\w+)/)?.[1]).sort();
	assert.deepEqual(styleNames, ['italic', 'normal']);
});

test('Fragment Mono est servie depuis le site', () => {
	const faces = styles.match(/@font-face\s*{[^}]*}/gi) ?? [];
	assert.ok(faces.some((f) => /font-family:[^;]*Fragment Mono/i.test(f) && /url\(["']?\/[^)]+\.woff2/.test(f)));
});
