// Section 01 · Projets : en-tête de section et liste des dépôts sélectionnés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'projets') ?? '';

test('la section Projets est la cible de l’ancre #projets et porte son h2', () => {
	assert.ok(section, 'aucune <section id="projets">');
	const h2s = elements(section, 'h2');
	assert.equal(h2s.length, 1);
	assert.equal(text(h2s[0]), 'Projets');
});

test('l’en-tête numérote la section et annonce le volume de dépôts', () => {
	const content = text(section);
	assert.match(content, /^01\s*Projets/);
	assert.match(content, /6 sélectionnés · 41 dépôts publics/);
});

test('six projets en liste ordonnée, chacun lié à sa fiche', () => {
	const lists = elements(section, 'ol');
	assert.equal(lists.length, 1);
	const items = elements(lists[0], 'li');
	assert.equal(items.length, 6);
	const hrefs = items.map((li) => {
		const links = tags(li, 'a');
		assert.equal(links.length, 1, 'un seul lien par projet');
		return attr(links[0], 'href');
	});
	assert.deepEqual(
		hrefs,
		[
			'typomaniac',
			'claude-tmux-notify',
			'claude-status-line',
			'pointcloud-viewer',
			'trekker',
			'ma-parcelle',
		].map((slug) => `/projets/${slug}/`),
	);
});

// La flèche suit celle du reste du site : « ↗ » sort vers un autre site, « → » reste sur celui-ci.
test('chaque lien se lit : numéro, nom, description, stack, année', () => {
	const [first, second] = elements(section, 'li').map((li) => text(elements(li, 'a')[0]));
	assert.equal(
		first,
		'01 typomaniac Jeu de dactylo multijoueur : runs solo, duels classés en Bo3, MMR et classement. Serveur de duel autoritaire en WebSocket. TypeScript · Elysia · Bun · React 19 2026 →',
	);
	assert.match(second, /^02 claude-tmux-notify\.nvim Un toast Neovim .* Lua · Neovim · tmux · ★ 3 2026 →$/);
});
