// Le mode normal hors de la Lunette (ADR 0007), importé tel quel sous Node : la machine à séquences et
// son showcmd, puis les déplacements (`gg`, `G`, `]]`, `[[`), sur des API du navigateur simulées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motions, normalMode } from '../src/lunette/normal.ts';

/** Une machine sur `sequences`, avec le showcmd qu'elle tient et les séquences qu'elle a jouées. */
function machine(names) {
	const ran = [];
	const shown = { text: '' };
	const sequences = Object.fromEntries(names.map((name) => [name, () => ran.push(name)]));
	const press = normalMode(sequences, (keys) => (shown.text = keys));
	return { press, ran, shown };
}

test('g attend dans le showcmd, le g suivant joue gg et l’efface', () => {
	const { press, ran, shown } = machine(['gg', 'G', ':']);
	assert.equal(press('g'), true);
	assert.equal(shown.text, 'g');
	assert.deepEqual(ran, []);
	assert.equal(press('g'), true);
	assert.deepEqual(ran, ['gg']);
	assert.equal(shown.text, '');
});

test('une séquence d’une touche joue tout de suite, sans passer par le showcmd', () => {
	const { press, ran, shown } = machine(['gg', 'G', ':']);
	assert.equal(press('G'), true);
	assert.deepEqual(ran, ['G']);
	assert.equal(shown.text, '');
});

test('une autre touche interrompt la séquence : le showcmd s’efface et elle est laissée au navigateur', () => {
	const { press, ran, shown } = machine(['gg', ']]', '[[']);
	press(']');
	assert.equal(shown.text, ']');
	assert.equal(press('x'), false);
	assert.equal(shown.text, '');
	// L'attente est vidée : `]` repart de zéro au lieu de compléter `]]`.
	press(']');
	assert.equal(shown.text, ']');
	assert.deepEqual(ran, []);
});

test('une touche hors de toute séquence est laissée au navigateur', () => {
	const { press, ran } = machine(['gg', 'G']);
	assert.equal(press('j'), false);
	assert.deepEqual(ran, []);
});

test('une séquence laissée en plan s’efface après le délai, comme le timeoutlen de Vim', (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const { press, ran, shown } = machine(['gg']);
	press('g');
	t.mock.timers.tick(999);
	assert.equal(shown.text, 'g');
	t.mock.timers.tick(1);
	assert.equal(shown.text, '');
	// Le `g` suivant recommence la séquence, il ne la termine pas.
	press('g');
	assert.deepEqual(ran, []);
	assert.equal(shown.text, 'g');
});

test('la machine accueille gd et yy à côté de gg : g attend l’une ou l’autre', () => {
	const { press, ran, shown } = machine(['gg', 'gd', 'yy']);
	press('g');
	press('d');
	press('y');
	assert.equal(shown.text, 'y');
	press('y');
	press('g');
	press('g');
	assert.deepEqual(ran, ['gd', 'yy', 'gg']);
	assert.equal(shown.text, '');
});

/**
 * Une page simulée : la fenêtre défilée à `scrollY`, les sections de la navigation à `tops` (positions
 * dans la page), et le mouvement réduit demandé ou non. Rend les défilements demandés.
 */
function page({ scrollY = 0, height = 5000, tops = [], reduce = false }) {
	const scrolls = [];
	const links = tops.map((_, i) => ({ hash: `#s${i}` }));
	const sections = new Map(tops.map((top, i) => [`#s${i}`, { getBoundingClientRect: () => ({ top: top - scrollY }) }]));
	// `(prefers-reduced-motion)` seule vaut `reduce` : la seule autre valeur est `no-preference`.
	const reduces = (query) => /^\(prefers-reduced-motion(: reduce)?\)$/.test(query);
	Object.assign(globalThis, {
		scrollY,
		scrollTo: (options) => scrolls.push(options),
		matchMedia: (query) => ({ matches: reduce && reduces(query) }),
		document: {
			documentElement: { scrollHeight: height },
			querySelectorAll: () => links,
			querySelector: (selector) => sections.get(selector) ?? null,
		},
	});
	return scrolls;
}

test('gg remonte en haut de la page et G descend en bas, en douceur', () => {
	const scrolls = page({ scrollY: 1200, height: 5000 });
	motions.gg();
	motions.G();
	assert.deepEqual(scrolls, [
		{ top: 0, behavior: 'smooth' },
		{ top: 5000, behavior: 'smooth' },
	]);
});

test('en mouvement réduit, le défilement est instantané', () => {
	const scrolls = page({ scrollY: 1200, tops: [800, 1600], reduce: true });
	motions.gg();
	motions[']]']();
	assert.deepEqual(scrolls, [
		{ top: 0, behavior: 'instant' },
		{ top: 1600, behavior: 'instant' },
	]);
});

test(']] passe à la section suivante, [[ à la précédente, celle du haut de la fenêtre comprise', () => {
	// La fenêtre au début de la deuxième section : ]] mène à la troisième, [[ à la première.
	const scrolls = page({ scrollY: 1600, tops: [800, 1600, 2400] });
	motions[']]']();
	motions['[[']();
	assert.deepEqual(
		scrolls.map(({ top }) => top),
		[2400, 800],
	);
	// Au milieu de la deuxième : [[ revient à son début.
	const middle = page({ scrollY: 2000, tops: [800, 1600, 2400] });
	motions['[[']();
	assert.deepEqual(
		middle.map(({ top }) => top),
		[1600],
	);
});

test(']] après la dernière section et [[ avant la première ne bougent pas ; sans section, non plus', () => {
	const scrolls = page({ scrollY: 3000, tops: [800, 1600, 2400] });
	motions[']]']();
	const above = page({ scrollY: 0, tops: [800, 1600, 2400] });
	motions['[[']();
	const none = page({ scrollY: 500 });
	motions[']]']();
	motions['[[']();
	assert.deepEqual([...scrolls, ...above, ...none], []);
});
