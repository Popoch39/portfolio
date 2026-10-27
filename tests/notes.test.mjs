// Notes de la figure : autour de la figure de chaque fiche, une note par pièce, reliée à elle par un
// trait. Elle se lit en clair (un verbe, une phrase, les technologies) ou en code (le symbole, sa
// signature et le lien vers lui) ; la ligne de commande de la carte bascule entre les deux lectures,
// sans script. La géométrie (place des notes, traits, viseurs) est écrite au build dans la CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, hasAttr, elements, text, css, moduleGraph } from './helpers/dist.mjs';

const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug) }));

const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomie')) ?? '';
const cardOf = (html) => elements(anatomyOf(html), 'figure')[0] ?? '';
const open = (fragment, name) => tags(fragment, name)[0] ?? '';
const rowsOf = (html) => elements(anatomyOf(html), 'li').filter((li) => attr(open(li, 'li'), 'data-piece') !== undefined && !/class="note\b/.test(open(li, 'li')));
/** Les notes : les `<li class="note">` de la liste des notes, dans la carte. */
const notesOf = (html) => elements(cardOf(html), 'li').filter((li) => /class="note\b/.test(open(li, 'li')));
/** Une face d'une note : le bloc `class="face <lecture>"` qui contient son corps. */
const faceOf = (note, reading) => note.match(new RegExp(`<div class="face ${reading}\\b[^>]*>[\\s\\S]*?</div>`))?.[0] ?? '';
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('chaque fiche pose une note par pièce autour de sa figure, dans l’ordre de la nomenclature', () => {
	for (const { repo, html } of fiches) {
		const lists = elements(cardOf(html), 'ol');
		assert.equal(lists.length, 1, `${repo} : une liste de notes dans la carte`);
		assert.ok(attr(open(lists[0], 'ol'), 'aria-label'), `${repo} : liste de notes sans nom`);
		const ids = rowsOf(html).map((li) => attr(open(li, 'li'), 'data-piece'));
		const notes = notesOf(html);
		assert.deepEqual(notes.map((li) => attr(open(li, 'li'), 'data-piece')), ids, repo);
		notes.forEach((note, i) => assert.match(text(note), new RegExp(`^0${i + 1}`), `${repo} : numéro de la note ${i + 1}`));
	}
});

test('en clair, une note dit ce que fait la pièce : technologies, indice, verbe et phrase', () => {
	for (const { repo, html } of fiches) {
		for (const note of notesOf(html)) {
			const plain = faceOf(note, 'plain');
			const [title, sentence] = elements(plain, 'p').map(text);
			assert.ok(title && title.length <= 28, `${repo} : titre « ${title} »`);
			assert.ok(sentence && sentence.length <= 90 && /[.!?]$/.test(sentence), `${repo} : phrase « ${sentence} »`);
			const logos = tags(note, 'svg').filter((t) => attr(t, 'role') === 'img');
			assert.ok(logos.length >= 1 && logos.length <= 2, `${repo} : ${logos.length} logos`);
			for (const logo of logos) assert.ok(attr(logo, 'aria-label'), `${repo} : logo sans nom`);
			// Les logos tirent leur dessin d'un seul jeu de symboles par page.
			for (const use of tags(note, 'use')) assert.ok(html.includes(`id="${attr(use, 'href').slice(1)}"`), `${repo} : symbole ${attr(use, 'href')} absent`);
		}
	}
});

test('en code, une note montre le symbole, 1 à 3 lignes de signature dans la plage de la pièce et le lien vers le code', () => {
	for (const { repo, html } of fiches) {
		const rows = rowsOf(html);
		notesOf(html).forEach((note, i) => {
			const code = faceOf(note, 'code');
			assert.ok(elements(code, 'p').length >= 1, `${repo} : symbole absent`);
			const href = attr(tags(rows[i], 'a')[0], 'href');
			const links = tags(note, 'a');
			assert.deepEqual(links.map((a) => attr(a, 'href')), [href], `${repo} : lien de la note ${i + 1}`);
			const [, first, last] = href.match(/#L(\d+)-L(\d+)$/);
			const numbers = [...code.matchAll(/class="ln\b[^"]*"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
			assert.ok(numbers.length >= 1 && numbers.length <= 3, `${repo} : ${numbers.length} lignes de signature`);
			numbers.forEach((n, k) => {
				assert.ok(n >= Number(first) && n <= Number(last), `${repo} : ligne ${n} hors de ${first}–${last}`);
				if (k) assert.ok(n > numbers[k - 1], `${repo} : lignes dans le désordre`);
			});
			assert.equal(elements(code, 'code').length, numbers.length + 1, `${repo} : symbole et lignes de code`);
		});
	}
});

test('la ligne de commande bascule la lecture des notes : deux boutons radio, « clair » coché', () => {
	for (const { repo, html } of fiches) {
		const card = cardOf(html);
		const [fieldset] = elements(card, 'fieldset');
		assert.ok(fieldset, `${repo} : pas de bascule`);
		assert.equal(text(elements(fieldset, 'legend')[0] ?? ''), 'Lecture des notes', repo);
		const radios = tags(fieldset, 'input');
		assert.deepEqual(radios.map((r) => attr(r, 'type')), ['radio', 'radio'], repo);
		assert.equal(new Set(radios.map((r) => attr(r, 'name'))).size, 1, `${repo} : un seul groupe`);
		assert.deepEqual(radios.map((r) => attr(r, 'value')), ['clair', 'code'], repo);
		assert.deepEqual(radios.map((r) => hasAttr(r, 'checked')), [true, false], `${repo} : « clair » au repos`);
		assert.match(text(fieldset), /:set lecture=\s*clair\s*\|\s*code/, repo);
		// La bascule est de la CSS : elle lit l'état du bouton coché.
		assert.match(css(html), /:has\([^)]*:checked\)/, `${repo} : la CSS ne lit pas la bascule`);
	}
});

test('chaque pièce a sa marque sur la figure (pointe ou pastille) et son viseur, tus aux technologies d’assistance', () => {
	for (const { repo, html } of fiches) {
		const card = cardOf(html);
		const [marks] = tags(card, 'div').filter((t) => /class="marks\b/.test(t));
		assert.ok(marks, `${repo} : pas de marques sur la figure`);
		assert.equal(attr(marks, 'aria-hidden'), 'true', repo);
		for (const li of rowsOf(html)) {
			const id = attr(open(li, 'li'), 'data-piece');
			const pins = tags(card, 'span').filter((t) => /class="pin\b/.test(t) && attr(t, 'data-piece') === id);
			assert.equal(pins.length, 1, `${repo} : marque de « ${id} »`);
			const finders = tags(card, 'span').filter((t) => /class="finder\b/.test(t) && attr(t, 'data-piece') === id);
			assert.ok(finders.length >= 1, `${repo} : viseur de « ${id} »`);
		}
	}
});

test('la géométrie des notes est écrite au build dans la CSS de la page, pas mesurée par un script', () => {
	for (const { repo, html } of fiches) {
		const styles = css(html);
		for (const li of rowsOf(html)) {
			const id = attr(open(li, 'li'), 'data-piece');
			const rule = new RegExp(`\\.note\\[data-piece="${escape(id)}"\\]\\s*\\{[^}]*--col:\\s*\\d[^}]*--bx:\\s*[\\d.]+[^}]*--sx:\\s*[\\d.]+`);
			assert.match(styles, rule, `${repo} : géométrie de « ${id} »`);
		}
		const [loader] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
		const code = moduleGraph(attr(loader, 'src') ?? '').code;
		// Suivre la mise en page de la carte, c'est la mesurer à chaque changement : la CSS s'en charge.
		assert.doesNotMatch(code, /ResizeObserver/, `${repo} : le script de la page suit la mise en page`);
	}
});

test('la barre d’état de la carte : mode, fichier de la pièce maîtresse, lecture, relevé et nombre de notes', () => {
	for (const { repo, html } of fiches) {
		const card = cardOf(html);
		const [bar] = elements(card, 'div').filter((d) => /class="[^"]*\bstatusline\b/.test(open(d, 'div')));
		assert.ok(bar, `${repo} : pas de barre d’état`);
		const content = text(bar);
		assert.match(content, /^NORMAL/, repo);
		assert.match(content, /lecture=clair/, repo);
		const master = rowsOf(html).find((li) => hasAttr(open(li, 'li'), 'data-master'));
		const file = attr(tags(master, 'a')[0], 'href').match(/\/([^/#]+)#L/)[1];
		assert.ok(content.includes(file), `${repo} : fichier « ${file} » absent de la barre`);
		assert.ok(content.includes(`${rowsOf(html).length} notes`), `${repo} : nombre de notes`);
		assert.ok(tags(bar, 'span').some((t) => hasAttr(t, 'data-releve')), `${repo} : relevé absent`);
	}
});

test('plus de repère ni de script de placement, et l’aperçu de l’accueil reste sans notes', () => {
	for (const { repo, html } of fiches) assert.ok(!html.includes('data-repere'), `${repo} : repère restant`);
	const home = readHome();
	assert.equal(tags(home, 'li').filter((t) => /class="note\b/.test(t)).length, 0);
	assert.equal(tags(home, 'fieldset').length, 0);
});
