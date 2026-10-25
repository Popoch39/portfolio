// La page est statique et autonome : ni JavaScript client, ni feuille de style externe,
// ni mouvement (spec #1 : animations et effets de survol hors périmètre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, css } from './helpers/dist.mjs';

const html = readHome();
const styles = css(html);

test('aucun <script> hormis les données structurées JSON-LD', () => {
	const scripts = tags(html, 'script').filter((t) => attr(t, 'type') !== 'application/ld+json');
	assert.deepEqual(scripts, []);
});

test('aucune feuille de style externe', () => {
	const stylesheets = tags(html, 'link').filter((t) => /\bstylesheet\b/i.test(attr(t, 'rel') ?? ''));
	assert.deepEqual(stylesheets, []);
});

test('aucun attribut style inline', () => {
	const withStyle = (html.match(/<[a-z][^>]*\sstyle=/gi) ?? []).map((t) => t.slice(0, 80));
	assert.deepEqual(withStyle, []);
});

test('la CSS livrée ne contient ni animation, ni transition, ni :hover', () => {
	assert.ok(styles.length > 0, 'aucune CSS trouvée dans la page');
	assert.doesNotMatch(styles, /\banimation(-[a-z-]+)?\s*:/i);
	assert.doesNotMatch(styles, /@keyframes/i);
	assert.doesNotMatch(styles, /\btransition(-[a-z-]+)?\s*:/i);
	assert.doesNotMatch(styles, /:hover\b/i);
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
