// Section 02 · Parcours : trois étapes professionnelles, puis la formation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'parcours') ?? '';

test('la section Parcours est la cible de l’ancre #parcours et porte son h2', () => {
	assert.ok(section, 'aucune <section id="parcours">');
	const h2s = elements(section, 'h2');
	assert.equal(h2s.length, 1);
	assert.equal(text(h2s[0]), 'Parcours');
});

test('l’en-tête numérote la section et résume le parcours', () => {
	const content = text(section);
	assert.match(content, /^02\s*Parcours/);
	assert.match(content, /~4 ans · santé, énergie, sport/);
});

const articles = elements(section, 'article');
/** Texte des éléments masqués aux lecteurs d'écran (non imbriqués, comme `elements`). */
const hiddenTexts = (fragment) =>
	(fragment.match(/<(\w+)\b[^>]*\saria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g) ?? []).map(text);

test('trois étapes, chacune un <article> titré par l’entreprise en h3', () => {
	assert.equal(articles.length, 3);
	assert.deepEqual(
		articles.map((a) => {
			const h3s = elements(a, 'h3');
			assert.equal(h3s.length, 1, 'un seul h3 par étape');
			return text(h3s[0]);
		}),
		['Da Viking Code', 'Conseil départemental olympique et sportif', 'Jordel Média'],
	);
});

test('chaque étape donne période, ville, rôle et missions en liste', () => {
	const [current, , internship] = articles;
	assert.match(text(current), /mars 2023 → aujourd’hui · Dijon/);
	assert.match(text(current), /Concepteur & développeur d’applications/);
	const missions = elements(elements(current, 'ul')[0] ?? '', 'li');
	assert.equal(missions.length, 5);
	// Le client du secteur de l'énergie reste anonyme.
	assert.match(text(missions[2]), /pour un grand acteur de l’énergie/);
	assert.match(text(internship), /sept\. → déc\. 2021 · Doucier/);
	assert.match(text(internship), /Stage — développeur web/);
});

test('les années géantes et les tirets des missions sont ignorés des lecteurs d’écran', () => {
	assert.deepEqual(hiddenTexts(articles[0]), ['2023', '—', '—', '—', '—', '—']);
	assert.deepEqual(hiddenTexts(articles[1]), ['2022', '—', '—', '—']);
	assert.deepEqual(hiddenTexts(articles[2]), ['2021', '—']);
});

test('Formation : un h3 suivi d’une liste ordonnée de quatre lignes (dates, diplôme, établissement)', () => {
	const after = section.split(/<h3\b[^>]*>Formation<\/h3>/)[1];
	assert.ok(after, 'aucun h3 « Formation »');
	assert.match(after, /^\s*<ol\b/, 'le h3 doit être suivi de la liste');
	assert.deepEqual(elements(elements(after, 'ol')[0], 'li').map(text), [
		'2022 — 2023 Concepteur & développeur d’applications Access Code School, Besançon',
		'2020 — 2021 Développeur web & développeur mobile Access Code School, Besançon',
		'2018 — 2020 Langues étrangères appliquées (LEA) UFR SLHS, Besançon',
		'2018 Baccalauréat économique et social Lycée Carnot, Dijon',
	]);
});
