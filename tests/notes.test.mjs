// Notes de la figure : autour de la figure de chaque fiche, une note par pièce, reliée à elle par un
// trait. Elle se lit en clair (un verbe, une phrase, les technologies) ou en code (le symbole, sa
// signature et le lien vers lui) ; la ligne de commande de la carte bascule entre les deux lectures,
// que le module de la page recopie sur la carte pour la CSS. La géométrie (place des notes, traits,
// viseurs) est écrite au build dans la CSS.
// Chaque version dit tout dans sa langue : notes, ligne de commande, barre d'état et libellés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, hasAttr, elements, text, css, moduleGraph } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		anatomy: 'Anatomie',
		list: 'Notes de la figure',
		legend: 'Lecture des notes',
		command: /^:set lecture=\s*clair\s*\|\s*code$/,
		status: 'lecture=clair',
		echo: (n) => `${n} substitutions sur ${n} lignes`,
		codeLabel: (path, first, last) => `Code : ${path}, lignes ${first} à ${last}`,
	},
	{
		locale: 'en',
		anatomy: 'Anatomy',
		list: 'Figure notes',
		legend: 'Note view',
		command: /^:set view=\s*plain\s*\|\s*code$/,
		status: 'view=plain',
		echo: (n) => `${n} substitutions on ${n} lines`,
		codeLabel: (path, first, last) => `Code: ${path}, lines ${first} to ${last}`,
	},
];

const open = (fragment, name) => tags(fragment, name)[0] ?? '';
/** Une face d'une note : le bloc `class="face <lecture>"` qui contient son corps. */
const faceOf = (note, reading) => note.match(new RegExp(`<div class="face ${reading}\\b[^>]*>[\\s\\S]*?</div>`))?.[0] ?? '';
/** Le titre et la phrase d'une note en clair. */
const plainOf = (note) => elements(faceOf(note, 'plain'), 'p').map(text);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Le corps `{…}` qui suit la position `at` du code, accolades imbriquées comprises. */
const bodyAfter = (code, at) => {
	const start = code.indexOf('{', at);
	if (start < 0) return '';
	let end = start;
	for (let depth = 1; depth > 0 && end < code.length; ) depth += code[++end] === '{' ? 1 : code[end] === '}' ? -1 : 0;
	return code.slice(start, end + 1);
};

/**
 * Le gestionnaire que le module de la page branche sur l'évènement `change` de la bascule `.lecture`,
 * en ligne ou nommé, ou `undefined`. Le module importe d'autres morceaux et attend au sommet : on ne
 * l'exécute pas, on suit dans son code l'élément `.lecture` jusqu'à son écoute.
 */
const lectureHandler = (code) => {
	const quote = '["\'`]';
	const toggle = code.match(new RegExp(`([\\w$]+)\\s*=\\s*[\\w$]+\\??\\.querySelector\\(\\s*${quote}\\.lecture${quote}\\s*\\)`))?.[1];
	if (!toggle) return undefined;
	const listen = new RegExp(`(?<![\\w$])${escape(toggle)}\\??\\.addEventListener\\(\\s*${quote}change${quote}\\s*,\\s*`).exec(code);
	if (!listen) return undefined;
	const at = listen.index + listen[0].length;
	const name = code.slice(at).match(/^([\w$]+)\s*[,)]/)?.[1];
	if (!name) return bodyAfter(code, at);
	const definition = new RegExp(`(?<![\\w$.])(?:${escape(name)}\\s*=|function\\s+${escape(name)}\\s*\\()`).exec(code);
	return definition ? bodyAfter(code, definition.index) : undefined;
};

const notesIn = (locale) => {
	const { anatomy } = VERSIONS.find((version) => version.locale === locale);
	const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(anatomy)) ?? '';
	const cardOf = (html) => elements(anatomyOf(html), 'figure')[0] ?? '';
	return {
		cardOf,
		/** Lignes de la nomenclature : les `<li>` à crochet de pièce, hors notes. */
		rowsOf: (html) => elements(anatomyOf(html), 'li').filter((li) => attr(open(li, 'li'), 'data-piece') !== undefined && !/class="note\b/.test(open(li, 'li'))),
		/** Les notes : les `<li class="note">` de la liste des notes, dans la carte. */
		notesOf: (html) => elements(cardOf(html), 'li').filter((li) => /class="note\b/.test(open(li, 'li'))),
	};
};

for (const version of VERSIONS) {
	const { locale } = version;
	const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug, locale) }));
	const { cardOf, rowsOf, notesOf } = notesIn(locale);

	test(`${locale} : chaque fiche pose une note par pièce autour de sa figure, dans l’ordre de la nomenclature`, () => {
		for (const { repo, html } of fiches) {
			const lists = elements(cardOf(html), 'ol');
			assert.equal(lists.length, 1, `${repo} : une liste de notes dans la carte`);
			assert.equal(attr(open(lists[0], 'ol'), 'aria-label'), version.list, `${repo} : nom de la liste de notes`);
			const ids = rowsOf(html).map((li) => attr(open(li, 'li'), 'data-piece'));
			const notes = notesOf(html);
			assert.deepEqual(notes.map((li) => attr(open(li, 'li'), 'data-piece')), ids, repo);
			notes.forEach((note, i) => assert.match(text(note), new RegExp(`^0${i + 1}`), `${repo} : numéro de la note ${i + 1}`));
		}
	});

	test(`${locale} : en clair, une note dit ce que fait la pièce : technologies, indice, verbe et phrase`, () => {
		for (const { repo, html } of fiches) {
			for (const note of notesOf(html)) {
				const [title, sentence] = plainOf(note);
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

	test(`${locale} : en code, une note montre le symbole, 1 à 3 lignes de signature dans la plage de la pièce et le lien vers le code`, () => {
		for (const { repo, html } of fiches) {
			const rows = rowsOf(html);
			notesOf(html).forEach((note, i) => {
				const code = faceOf(note, 'code');
				assert.ok(elements(code, 'p').length >= 1, `${repo} : symbole absent`);
				const href = attr(tags(rows[i], 'a')[0], 'href');
				const links = tags(note, 'a');
				assert.deepEqual(links.map((a) => attr(a, 'href')), [href], `${repo} : lien de la note ${i + 1}`);
				const [, path, first, last] = href.match(/\/blob\/[0-9a-f]{40}\/(.+)#L(\d+)-L(\d+)$/);
				assert.equal(attr(links[0], 'aria-label'), version.codeLabel(path, first, last), `${repo} : nom du lien de la note ${i + 1}`);
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

	test(`${locale} : la ligne de commande bascule la lecture des notes : deux boutons radio, le premier coché`, () => {
		for (const { repo, html } of fiches) {
			const card = cardOf(html);
			const [fieldset] = elements(card, 'fieldset');
			assert.ok(fieldset, `${repo} : pas de bascule`);
			const legend = elements(fieldset, 'legend')[0] ?? '';
			assert.equal(text(legend), version.legend, repo);
			const radios = tags(fieldset, 'input');
			assert.deepEqual(radios.map((r) => attr(r, 'type')), ['radio', 'radio'], repo);
			assert.equal(new Set(radios.map((r) => attr(r, 'name'))).size, 1, `${repo} : un seul groupe`);
			assert.deepEqual(radios.map((r) => hasAttr(r, 'checked')), [true, false], `${repo} : lecture en clair au repos`);
			assert.match(text(fieldset.replace(legend, '')), version.command, repo);
			// La CSS lit la lecture sur un attribut de la carte, que le module de la page recopie du bouton
			// coché : un `:has()` sur la bascule restylait la carte à chaque image de la figure (ADR 0003).
			const [annot] = tags(card, 'div').filter((t) => /class="annot\b/.test(t));
			assert.equal(attr(annot, 'data-lecture'), 'clair', `${repo} : lecture en clair au repos, sans script`);
			const styles = css(html);
			assert.match(styles, /\.annot(?:\[[^\]]*\])*\[data-lecture=["']?code["']?\]/, `${repo} : la CSS ne lit pas la lecture`);
			assert.doesNotMatch(styles, /:has\([^)]*:checked\)/, `${repo} : la CSS lit encore la bascule par :has()`);
			const [loader] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
			const handler = lectureHandler(moduleGraph(attr(loader, 'src') ?? '').code);
			assert.ok(handler, `${repo} : le module n'écoute pas la bascule`);
			assert.match(handler, /\.dataset\.lecture\s*=(?!=)|\.setAttribute\(\s*["'`]data-lecture["'`]/, `${repo} : le module ne recopie pas la lecture sur la carte`);
		}
	});

	test(`${locale} : la ligne de commande fait écho à la bascule : « ${version.echo('N')} »`, () => {
		for (const { repo, html } of fiches) {
			const echoes = elements(cardOf(html), 'span').filter((s) => /class="msg\b/.test(open(s, 'span')));
			assert.deepEqual(echoes.map(text), [version.echo(notesOf(html).length), version.echo(notesOf(html).length)], repo);
		}
	});

	test(`${locale} : chaque pièce a sa marque sur la figure (pointe ou pastille) et son viseur, tus aux technologies d’assistance`, () => {
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

	test(`${locale} : la géométrie des notes est écrite au build dans la CSS de la page, pas mesurée par un script`, () => {
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

	test(`${locale} : la barre d’état de la carte : mode, fichier de la pièce maîtresse, lecture, relevé et nombre de notes`, () => {
		for (const { repo, html } of fiches) {
			const card = cardOf(html);
			const [bar] = elements(card, 'div').filter((d) => /class="[^"]*\bstatusline\b/.test(open(d, 'div')));
			assert.ok(bar, `${repo} : pas de barre d’état`);
			const content = text(bar);
			assert.match(content, /^NORMAL/, repo);
			assert.ok(content.includes(version.status), `${repo} : « ${version.status} » absent de la barre`);
			const master = rowsOf(html).find((li) => hasAttr(open(li, 'li'), 'data-master'));
			const file = attr(tags(master, 'a')[0], 'href').match(/\/([^/#]+)#L/)[1];
			assert.ok(content.includes(file), `${repo} : fichier « ${file} » absent de la barre`);
			assert.ok(content.includes(`${rowsOf(html).length} notes`), `${repo} : nombre de notes`);
			assert.ok(tags(bar, 'span').some((t) => hasAttr(t, 'data-releve')), `${repo} : relevé absent`);
		}
	});

	test(`${locale} : plus de repère ni de script de placement, et l’aperçu de l’accueil reste sans notes`, () => {
		for (const { repo, html } of fiches) assert.ok(!html.includes('data-repere'), `${repo} : repère restant`);
		const home = readHome(locale);
		assert.equal(tags(home, 'li').filter((t) => /class="note\b/.test(t)).length, 0);
		assert.equal(tags(home, 'fieldset').length, 0);
	});
}

// Les deux versions d'une note disent la même chose, chacune dans sa langue : aucune note anglaise ne
// reprend le titre ou la phrase de la française, et les indices et symboles, du code, restent.
test('chaque note anglaise traduit le titre et la phrase de la française, et garde son indice et son symbole', () => {
	const fr = notesIn('fr');
	const en = notesIn('en');
	for (const { slug, repo } of PROJECTS) {
		const french = fr.notesOf(readFiche(slug, 'fr'));
		const english = en.notesOf(readFiche(slug, 'en'));
		assert.equal(english.length, french.length, repo);
		french.forEach((note, i) => {
			const [frTitle, frSentence] = plainOf(note);
			const [enTitle, enSentence] = plainOf(english[i]);
			assert.notEqual(enTitle, frTitle, `${repo} : titre de la note ${i + 1} non traduit`);
			assert.notEqual(enSentence, frSentence, `${repo} : phrase de la note ${i + 1} non traduite`);
			assert.equal(text(faceOf(english[i], 'code')), text(faceOf(note, 'code')), `${repo} : lecture code de la note ${i + 1}`);
			const clue = (html) => text(elements(html, 'span').find((s) => /class="ty\b/.test(open(s, 'span'))) ?? '');
			assert.equal(clue(english[i]), clue(note), `${repo} : indice de la note ${i + 1}`);
		});
	}
});
