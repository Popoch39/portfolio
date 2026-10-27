// Le lancement (maquette 2 · Buffer, ADR 0008) : à la première arrivée de la session sur l'accueil,
// `nvim portfolio.md` se tape dans un terminal, le curseur bloc inonde l'écran puis se range dans le
// segment NORMAL de la barre d'état, et l'accueil entre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PROJECTS, attr, css, launchGate, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const ORIGIN = 'https://louis.example';

const VERSIONS = {
	fr: { sections: ['héros', 'projets', 'parcours', 'activité', 'stack', 'contact'], key: 'Échap' },
	en: { sections: ['hero', 'projects', 'career', 'activity', 'stack', 'contact'], key: 'Esc' },
};

/** L'écran du lancement, du début de son élément à l'en-tête du site. */
const screenOf = (html) => {
	const start = html.search(/<div class="launch\b/);
	return start < 0 ? undefined : html.slice(start, html.indexOf('<header', start));
};

/**
 * Exécute le script de la porte dans un faux navigateur. Rend l'attribut du document, le stockage de
 * session et les écouteurs encore inscrits ; `fire` leur envoie un évènement.
 */
function run(script, { referrer = '', hash = '', seen = false, reduced = false, storage = true, animations = [] } = {}) {
	const dataset = {};
	const store = seen ? { launch: '1' } : {};
	const listeners = new Map();
	const sandbox = {
		document: { documentElement: { dataset }, referrer, getAnimations: () => animations },
		location: { hash, origin: ORIGIN, href: `${ORIGIN}/${hash}` },
		matchMedia: (query) => ({ matches: /:\s*reduce\)/.test(query) ? reduced : /:\s*no-preference\)/.test(query) ? !reduced : false }),
		addEventListener: (type, fn) => listeners.set(type, fn),
		removeEventListener: (type, fn) => listeners.get(type) === fn && listeners.delete(type),
	};
	Object.defineProperty(sandbox, 'sessionStorage', {
		get() {
			if (!storage) throw new Error('SecurityError');
			return store;
		},
	});
	vm.runInNewContext(script.replace(/^<script\b[^>]*>|<\/script>$/g, ''), sandbox);
	return { dataset, store, listeners, fire: (type, props = {}) => listeners.get(type)?.({ type, ...props }) };
}

const playing = (page) => 'launch' in page.dataset;

for (const [locale, version] of Object.entries(VERSIONS)) {
	const html = readHome(locale);
	const gate = launchGate(html) ?? '';
	const screen = screenOf(html) ?? '';

	test(`${locale} : l’écran du lancement, caché aux lecteurs d’écran, tape \`nvim portfolio.md\` et charge chaque section`, () => {
		assert.ok(screen, 'écran absent');
		assert.equal(attr(tags(screen, 'div')[0], 'aria-hidden'), 'true');
		// Une ligne par `<div>` sans `<div>` dedans : le terminal, puis les deux côtés de sa barre.
		const lines = [...screen.matchAll(/<div\b[^>]*>((?:(?!<div\b)[\s\S])*?)<\/div>/g)].map((m) => text(m[1])).filter(Boolean);
		assert.deepEqual(lines.slice(0, 2), ['$ nvim portfolio.md', '"portfolio.md" — 6 sections']);
		// Chaque section de l'accueil, dans l'ordre, suivie de ses points de conduite et de `ok`.
		const loaded = lines.slice(2, 2 + version.sections.length).map((line) => line.match(/^(\S+) \.{3,} ok$/)?.[1]);
		assert.deepEqual(loaded, version.sections);
		assert.match(lines[2 + version.sections.length], /^-- INSERT --portfolio\.md$/);
		assert.match(text(screen), new RegExp(`${version.key}INSERT → NORMAL$`));
	});

	test(`${locale} : la porte précède l’écran, qui précède l’en-tête : l’attribut est posé avant le premier rendu`, () => {
		assert.ok(gate, 'script de la porte absent');
		const at = (fragment) => html.indexOf(fragment);
		assert.ok(at(gate) < at(screen) && at(screen) < at('<header'), 'ordre : porte, écran, en-tête');
		// Le plafond du script en ligne de la transition (transition.test.mjs).
		assert.ok(gate.length < 1500, `porte de ${gate.length} o`);
	});

	test(`${locale} : le lancement joue à la première arrivée de la session, venue d’ailleurs`, () => {
		for (const referrer of ['', 'https://github.com/Popoch39']) {
			const page = run(gate, { referrer });
			assert.ok(playing(page), `référent « ${referrer} »`);
			assert.ok(page.store.launch, 'session non marquée');
		}
	});

	test(`${locale} : il ne joue ni deux fois par session, ni depuis le site, ni vers une ancre, ni en mouvement réduit, ni sans stockage`, () => {
		const cases = {
			'déjà vu': { seen: true },
			'depuis une fiche': { referrer: `${ORIGIN}/projets/trekker/` },
			'vers une ancre': { hash: '#contact' },
			'mouvement réduit': { reduced: true },
			'stockage refusé': { storage: false },
		};
		for (const [name, options] of Object.entries(cases)) {
			const page = run(gate, options);
			assert.ok(!playing(page), name);
			assert.equal(page.listeners.size, 0, `${name} : écouteurs inscrits`);
		}
	});

	test(`${locale} : une touche, un clic, la molette, un défilement ou le départ de la page le terminent sur-le-champ`, () => {
		for (const type of ['keydown', 'click', 'wheel', 'scroll', 'pagehide']) {
			const page = run(gate);
			page.fire(type);
			assert.ok(!playing(page), type);
			assert.equal(page.listeners.size, 0, `${type} : écouteurs restants ${[...page.listeners.keys()]}`);
		}
	});

	// Une fois le bleu en train de se ranger (5500 ms), couper ferait sauter l'accueil à sa place : la
	// suite se joue en accéléré, et la fin de `launch-done` le termine.
	test(`${locale} : pendant l’entrée de l’accueil, une touche accélère la fin au lieu de la couper`, () => {
		const animation = (animationName, currentTime) => ({ animationName, currentTime, playbackRate: 1, updatePlaybackRate(rate) { this.playbackRate = rate; } });
		const entering = [animation('launch-done', 6000), animation('launch-enter', 6000), animation('iso-spin', 6000)];
		const page = run(gate, { animations: entering });
		page.fire('keydown');
		assert.ok(playing(page), 'coupé pendant l’entrée');
		assert.deepEqual(entering.map((a) => a.playbackRate > 1), [true, true, false]);
		assert.deepEqual([...page.listeners.keys()], ['animationend'], 'les touches suivantes ne relancent rien');
		page.fire('animationend', { animationName: 'launch-done' });
		assert.ok(!playing(page));

		const covered = [animation('launch-done', 5300), animation('launch-enter', 5300)];
		const early = run(gate, { animations: covered });
		early.fire('click');
		assert.ok(!playing(early), 'sous le bleu, le saut coupe');
	});

	test(`${locale} : la fin de sa dernière animation le termine, pas celle d’une autre`, () => {
		const page = run(gate);
		page.fire('animationend', { animationName: 'launch-flood' });
		page.fire('animationend', { animationName: 'iso-spin' });
		assert.ok(playing(page));
		page.fire('animationend', { animationName: 'launch-done' });
		assert.ok(!playing(page));
		assert.equal(page.listeners.size, 0);
		assert.match(css(html), /@keyframes launch-done\b/, 'l’animation attendue par la porte n’existe pas');
	});

	// La frappe se règle en colonnes dans la CSS, et chaque ligne de sortie y a son rang.
	test(`${locale} : la frappe compte une colonne par caractère de la commande, et chaque ligne de sortie a son rang`, () => {
		const styles = css(html);
		const columns = 'nvim portfolio.md'.length;
		assert.ok(styles.includes(`steps(${columns},end)`), `steps(${columns})`);
		assert.match(styles, new RegExp(`translateX?\\(${columns}ch\\)`));
		assert.match(styles, new RegExp(`translate\\(-${columns}ch`));
		const outputs = (screen.match(/<div class="out\b/g) ?? []).length;
		for (let rank = 1; rank < outputs; rank++) {
			assert.match(styles, new RegExp(`\\.out[^{]*:nth-child\\(${rank + 2}\\)[^{]*\\{--rank:${rank}\\}`), `rang ${rank}`);
		}
	});

	test(`${locale} : sans l’attribut (sans JS, ou une fois fini), l’écran n’est pas affiché`, () => {
		assert.match(css(html), /\.launch(?:\[[^\]]+\]|:where\([^)]*\))*\s*\{[^}]*display:\s*none/);
	});

	test(`${locale} : rien du lancement ne s’anime hors de la requête de mouvement non réduit`, () => {
		const outside = withoutBlocks(css(html), /@media \(prefers-reduced-motion:\s*no-preference\)/);
		assert.doesNotMatch(outside, /@keyframes\s+launch-/);
		assert.doesNotMatch(outside, /\[data-launch\][^{}]*\{[^{}]*\banimation/);
	});

	// LCP : le héros est peint au premier rendu, sous l'écran. Ses animations ne le masquent qu'une fois
	// l'écran couvert par le bleu, donc ne remplissent jamais en arrière (`both`, `backwards`).
	test(`${locale} : les animations de l’accueil ne le masquent pas avant leur départ`, () => {
		const rules = [...css(html).matchAll(/([^{}]*\[data-launch\][^{}]*)\{([^{}]*\banimation\s*:[^{}]*)\}/g)].filter(([, selector]) =>
			/\.(hero|site-header)\b/.test(selector),
		);
		assert.ok(rules.length >= 3, `${rules.length} règles d’entrée de l’accueil`);
		for (const [, selector, body] of rules) {
			assert.match(body, /\bforwards\b/, selector);
			assert.doesNotMatch(body, /\b(both|backwards)\b/, selector);
		}
	});
}

test('les fiches n’ont ni porte ni écran de lancement', () => {
	for (const locale of Object.keys(VERSIONS)) {
		for (const { slug } of PROJECTS) {
			const html = readFiche(slug, locale);
			assert.equal(launchGate(html), undefined, `${locale} ${slug} : porte`);
			assert.equal(screenOf(html), undefined, `${locale} ${slug} : écran`);
			assert.doesNotMatch(css(html), /data-launch/, `${locale} ${slug} : CSS du lancement`);
		}
	}
});
