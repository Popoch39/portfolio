// Les pages sont statiques et autonomes : aucune feuille de style externe.
// Règles de D1 révisées pour les figures (ADR 0001) : pour tout script, le JSON-LD et le chargeur
// des figures ; l'attribut `style` n'est toléré que dans les SVG de figure, `animation` et
// `@keyframes` que dans la CSS des figures (kit et palette, sélecteurs `.iso`, noms `iso-`) ;
// jamais de `transition` ni de `:hover`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, elements, css } from './helpers/dist.mjs';

const html = readHome();
const styles = css(html);
const pages = [
	{ name: 'accueil', html },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, html: readFiche(slug) })),
];

/** Le HTML sans les SVG de figure (`<svg class="iso-svg …">`), où le kit émet des attributs `style`. */
const withoutFigures = (page) =>
	elements(page, 'svg').reduce((rest, svg) => (/\bclass="[^"]*\biso-svg\b/.test(tags(svg, 'svg')[0]) ? rest.replace(svg, '') : rest), page);

test('scripts limités au JSON-LD et au chargeur : au plus un module, servi par le site', () => {
	for (const page of pages) {
		const scripts = tags(page.html, 'script').filter((t) => attr(t, 'type') !== 'application/ld+json');
		assert.ok(scripts.length <= 1, `${page.name} : ${scripts.length} scripts hors JSON-LD`);
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

test('la CSS livrée ne contient ni transition ni :hover, et ses animations sont celles du kit', () => {
	for (const page of pages) {
		const pageStyles = css(page.html);
		assert.ok(pageStyles.length > 0, `${page.name} : aucune CSS trouvée`);
		assert.doesNotMatch(pageStyles, /\btransition(-[a-z-]+)?\s*:/i, page.name);
		// La pseudo-classe, pas la requête média `(hover: hover)`, qui teste ce que sait le pointeur.
		assert.doesNotMatch(pageStyles, /(?<!\(\s*hover\s*):hover\b/i, page.name);
		const keyframes = [...pageStyles.matchAll(/@keyframes\s+([\w-]+)/gi)].map((m) => m[1]);
		assert.deepEqual(keyframes.filter((name) => !name.startsWith('iso-')), [], `${page.name} : @keyframes hors du kit`);
		const animated = [...pageStyles.matchAll(/([^{}]+)\{[^{}]*\banimation(?:-[a-z-]+)?\s*:[^{}]*\}/gi)].flatMap((m) => m[1].split(','));
		assert.deepEqual(
			animated.map((selector) => selector.trim()).filter((selector) => !selector.startsWith('.iso')),
			[],
			`${page.name} : animation hors de la CSS du kit`,
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
