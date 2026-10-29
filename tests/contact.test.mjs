// Section 05 · Contact : le Buffer, un vrai formulaire qui s'envoie sans JS au Worker de `/api/contact`
// (spec #116, ADR 0016), puis l'adresse et les liens, dans les deux Versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, hasAttr, elements, text, css, blocks, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
/** Les seules propriétés qu'on anime : ni layout ni paint par image. */
const CHEAP = new Set(['transform', 'opacity']);

const VERSIONS = [
	{
		locale: 'fr',
		pitch: /Une API, une interface, un outil à construire \? Écrivez-moi\. Ouvert au remote\./,
		links: /GitHub — Popoch39 ↗ Config Neovim ↗ Besançon, France/,
		legends: ['type:', 'budget:'],
		types: ['projet', 'app', 'bonjour'],
		labels: { nom: 'nom:', email: 'email:', message: '# Message — markdown bienvenu' },
		ok: /^"contact\.md" écrit — message envoyé à Louis/,
		errors: { e1: /^E1: type manquant/, e2: /^E2: email/, e3: /^E3: message vide/, e4: /^E4: /, e5: /^E5: envoi impossible/ },
		hint: /le bouton fait pareil/,
		noBudget: '# sans objet, on discute',
		examples: ['Le contexte, le besoin, ce qui existe déjà…', 'À quoi sert l’app, pour qui, sur quels écrans…', 'Bonjour Louis, …'],
		cmd: 'Ligne de commande',
	},
	{
		locale: 'en',
		pitch: /An API, an interface, a tool that needs building\? Drop me a line\. Open to remote\./,
		links: /GitHub — Popoch39 ↗ Neovim config ↗ Besançon, France/,
		legends: ['type:', 'budget:'],
		types: ['project', 'app', 'hello'],
		labels: { nom: 'name:', email: 'email:', message: '# Message — markdown welcome' },
		ok: /^"contact\.md" written — message sent to Louis/,
		errors: { e1: /^E1: missing type/, e2: /^E2: .*email/, e3: /^E3: empty message/, e4: /^E4: /, e5: /^E5: sending failed/ },
		hint: /the button does the same/,
		noBudget: '# not applicable, let’s talk',
		examples: ['The context, the need, what already exists…', 'What the app does, for whom, on which screens…', 'Hi Louis, …'],
		cmd: 'Command line',
	},
];

for (const { locale, pitch, links, legends, types, labels, ok, errors, hint, noBudget, examples, cmd } of VERSIONS) {
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'contact') ?? '';
	const form = elements(section, 'form')[0] ?? '';
	const inputs = tags(form, 'input');
	const named = (name) => [...inputs, ...tags(form, 'textarea')].filter((t) => attr(t, 'name') === name);
	const labelFor = (id) => elements(form, 'label').find((l) => attr(tags(l, 'label')[0], 'for') === id);
	const hrefs = tags(section, 'a').map((a) => attr(a, 'href'));

	test(`${locale} : la section Contact est la cible de l’ancre #contact, numérotée 05, sans h2`, () => {
		assert.ok(section, 'aucune <section id="contact">');
		assert.match(text(section), /^05/);
		assert.equal(elements(section, 'h2').length, 0);
	});

	test(`${locale} : « :wq » géant est décoratif, ignoré par les lecteurs d’écran`, () => {
		const wq = tags(section, 'p').find((p) => attr(p, 'aria-hidden') === 'true');
		assert.ok(wq, '« :wq » non masqué');
		assert.equal(text(elements(section, 'p').find((p) => p.startsWith(wq))), ':wq');
	});

	test(`${locale} : la phrase d’appel, ouverte au remote`, () => {
		assert.match(text(section), pitch);
	});

	test(`${locale} : le Buffer est un formulaire POST vers /api/contact, qui s’envoie sans JS`, () => {
		const tag = tags(form, 'form')[0];
		assert.ok(tag, 'aucun <form> dans la section Contact');
		assert.equal(attr(tag, 'method'), 'post');
		assert.equal(attr(tag, 'action'), '/api/contact');
		const submit = tags(form, 'button').find((b) => (attr(b, 'type') ?? 'submit') === 'submit');
		assert.ok(submit, 'aucun bouton d’envoi');
	});

	// Le bouton de la colonne de gauche est celui du formulaire : un clic envoie le Buffer, sans JS.
	test(`${locale} : « Enregistrer et envoyer :wq » est le bouton d’envoi, de type submit, dans le formulaire`, () => {
		const buttons = elements(form, 'button');
		const send = buttons.find((b) => text(b).endsWith(':wq'));
		assert.ok(send, 'aucun bouton marqué :wq dans le formulaire');
		assert.equal(attr(tags(send, 'button')[0], 'type'), 'submit');
		assert.match(text(send), /^(Enregistrer et envoyer|Save and send) ?:wq$/);
	});

	// Sur téléphone, les colonnes s'empilent dans cet ordre (#119) ; le HTML le suit, pour que le parcours
	// clavier et la lecture ne sautent pas du bouton aux champs puis reviennent.
	test(`${locale} : :wq, le pitch, la fenêtre, puis le bouton, l’adresse et les liens, dans l’ordre du HTML`, () => {
		const at = (needle) => {
			const i = section.indexOf(needle);
			assert.ok(i >= 0, needle);
			return i;
		};
		const order = ['class="wq"', 'class="pitch"', 'class="win"', 'type="submit"', 'href="mailto:', 'href="https://github.com/Popoch39"'].map(at);
		assert.deepEqual(order, [...order].sort((a, b) => a - b));
	});

	test(`${locale} : la fenêtre contact.md, son onglet, sa barre d’état et sa ligne de commande`, () => {
		const all = text(form);
		assert.match(all, /contact\.md ?\[\+\]/, 'onglet sans [+]');
		assert.match(all, /louis@portfolio/);
		assert.match(all, /NORMAL ?INSERT ?COMMAND/, 'barre d’état sans ses trois modes');
		assert.match(all, /utf-8 ?markdown ?1:1/);
		assert.equal((all.match(/---/g) ?? []).length, 2, 'l’en-tête n’est pas entre deux ---');
		assert.ok(all.includes(noBudget), 'pas de « sans objet » pour bonjour');
		assert.match(text(section), hint);
		// Le chrome de la fenêtre est décoratif : les lecteurs d’écran n’en lisent que les champs.
		const decor = tags(form, 'div').filter((d) => attr(d, 'aria-hidden') === 'true');
		assert.ok(decor.length >= 2, 'onglet et barre d’état non masqués');
		// La ligne de commande est là, libellée, mais cachée tant que le script (#120) ne l’a pas activée.
		const line = tags(form, 'input').find((i) => hasAttr(i, 'hidden'));
		assert.ok(line, 'aucune ligne de commande cachée');
		assert.equal(attr(line, 'name'), undefined, 'la ligne de commande partirait avec le formulaire');
		assert.equal(text(labelFor(attr(line, 'id')) ?? ''), cmd);
	});

	test(`${locale} : un texte d’exemple du message par type, superposés, plus celui par défaut`, () => {
		const [message] = named('message');
		assert.ok(attr(message, 'placeholder'), 'le message n’a pas de texte d’exemple par défaut');
		for (const example of examples) assert.ok(text(form).includes(example), example);
		assert.ok(attr(named('nom')[0], 'placeholder'), 'le nom sans exemple : [+] ne le verrait pas rempli');
		assert.ok(attr(named('email')[0], 'placeholder'), 'l’email sans exemple : [+] ne le verrait pas rempli');
	});

	// Les états du Buffer (curseur, mode, [+], jetons, bonjour, exemples) sont en CSS seule. Sa CSS est
	// globale pour le poids, mais toute rangée sous `.contact` : on la reconnaît à ce préfixe.
	const styles = css(html);
	const scoped = (sheet) => [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => /(^|,)\s*\.contact\b/.test(selector.trim()));

	test(`${locale} : les états de la fenêtre tiennent en CSS, sans JS`, () => {
		const selectors = scoped(styles).map(([, s]) => s).join('\n');
		assert.match(selectors, /:focus-within/, 'ni curseur ni mode au focus');
		assert.match(selectors, /:has\([^)]*:checked/, 'ni jetons ni bonjour au choix');
		assert.match(selectors, /:placeholder-shown/, 'ni [+] ni texte d’exemple');
	});

	test(`${locale} : les animations du Buffer ne touchent que transform et opacity`, () => {
		const keyframes = new Map(blocks(styles, /@keyframes\s+[\w-]+/).map((b) => [b.match(/@keyframes\s+([\w-]+)/)[1], b]));
		for (const [, selector, body] of scoped(styles)) {
			for (const [, list] of body.matchAll(/transition(?:-property)?\s*:([^;]*)/g)) {
				// Les virgules d'un `cubic-bezier(…)` ne séparent pas deux transitions.
				for (const one of list.split(/,(?![^(]*\))/)) {
					const property = one.trim().split(/\s+/)[0];
					if (property === 'none') continue;
					assert.ok(CHEAP.has(property), `${selector.trim()} : transition sur ${property}`);
				}
			}
			// Le minifieur réordonne le raccourci `animation` : le nom est le mot qui désigne un @keyframes.
			for (const [, shorthand] of body.matchAll(/animation(?:-name)?\s*:([^;]*)/g)) {
				if (shorthand.trim() === 'none') continue;
				const name = shorthand.split(/[\s,]+/).find((word) => keyframes.has(word));
				assert.ok(name, `${selector.trim()} : @keyframes introuvable dans « ${shorthand} »`);
				for (const [, property] of keyframes.get(name).matchAll(/[{;]\s*([\w-]+)\s*:/g)) assert.ok(CHEAP.has(property), `${name} anime ${property}`);
			}
		}
	});

	test(`${locale} : le mouvement du Buffer est sous prefers-reduced-motion: no-preference`, () => {
		const still = scoped(withoutBlocks(styles, MOTION));
		const moving = still.filter(([, , body]) => /\b(transition|animation)(-[\w-]+)?\s*:/.test(body) && !/\b(transition|animation)\s*:\s*none/.test(body));
		assert.deepEqual(moving.map(([, s]) => s.trim()), []);
		assert.ok(scoped(blocks(styles, MOTION).join('')).some(([, , body]) => /\btransition\s*:/.test(body)), 'aucune transition du Buffer');
	});

	test(`${locale} : type et budget sont des radios natives groupées, chacune sous sa légende`, () => {
		const fieldsets = elements(form, 'fieldset');
		assert.deepEqual(fieldsets.map((f) => text(elements(f, 'legend')[0] ?? '')), legends);
		const [typeSet, budgetSet] = fieldsets;
		const radios = (set, name) => tags(set, 'input').filter((t) => attr(t, 'type') === 'radio' && attr(t, 'name') === name);
		assert.deepEqual(radios(typeSet, 'type').map((r) => attr(r, 'value')), ['projet', 'app', 'bonjour']);
		assert.deepEqual(radios(typeSet, 'type').map((r) => text(labelFor(attr(r, 'id')) ?? '')), types);
		assert.ok(radios(typeSet, 'type').every((r) => hasAttr(r, 'required')), 'le type est requis');
		assert.deepEqual(radios(budgetSet, 'budget').map((r) => text(attr(r, 'value'))), ['<5k€', '5-15k€', '15-40k€', '?']);
		assert.deepEqual(radios(budgetSet, 'budget').map((r) => text(labelFor(attr(r, 'id')) ?? '')), ['<5k€', '5-15k€', '15-40k€', '?']);
	});

	test(`${locale} : nom, email et message ont chacun leur libellé, et autocomplete là où il le faut`, () => {
		const [nom] = named('nom');
		const [email] = named('email');
		const [message] = named('message');
		assert.equal(text(labelFor(attr(nom, 'id')) ?? ''), labels.nom);
		assert.equal(attr(nom, 'autocomplete'), 'name');
		assert.equal(attr(nom, 'maxlength'), '100');
		assert.equal(text(labelFor(attr(email, 'id')) ?? ''), labels.email);
		assert.equal(attr(email, 'type'), 'email');
		assert.equal(attr(email, 'autocomplete'), 'email');
		assert.ok(hasAttr(email, 'required'), 'l’email est requis');
		assert.ok(message.startsWith('<textarea'), 'le message est un textarea');
		assert.equal(text(labelFor(attr(message, 'id')) ?? ''), labels.message);
		assert.equal(attr(message, 'maxlength'), '5000');
		assert.ok(hasAttr(message, 'required'), 'le message est requis');
	});

	test(`${locale} : la langue part dans un champ caché`, () => {
		const [lang] = named('lang');
		assert.equal(attr(lang, 'type'), 'hidden');
		assert.equal(attr(lang, 'value'), locale);
	});

	test(`${locale} : le pot de miel est hors de la vue, hors du parcours clavier et des lecteurs d’écran`, () => {
		const [pot] = named('site');
		assert.ok(pot, 'aucun pot de miel');
		assert.equal(attr(pot, 'tabindex'), '-1');
		assert.equal(attr(pot, 'autocomplete'), 'off');
		const holder = tags(form, 'div').find((d) => attr(d, 'aria-hidden') === 'true' && /\bpot\b/.test(attr(d, 'class') ?? ''));
		assert.ok(holder, 'pot de miel sans conteneur masqué');
		assert.ok(form.indexOf(holder) < form.indexOf(pot), 'le pot de miel n’est pas dans son conteneur');
		// Hors de la vue sans `display: none`, que certains robots savent lire.
		const rule = css(html).match(/\.pot\b[^{]*\{([^}]*)\}/)?.[1] ?? '';
		assert.match(rule, /position:\s*absolute/);
		assert.match(rule, /clip-path:\s*inset\(50%\)|left:\s*-\d+/);
		assert.doesNotMatch(rule, /display:\s*none/);
	});

	test(`${locale} : les ancres succès et erreur (E1 à E5) sont dans le HTML, affichées par :target`, () => {
		const echo = (id) => elements(form, 'p').find((p) => attr(tags(p, 'p')[0], 'id') === id);
		assert.match(text(echo('contact-ok') ?? ''), ok);
		for (const [code, message] of Object.entries(errors)) assert.match(text(echo(`contact-${code}`) ?? ''), message, code);
		assert.match(css(html), /:target/);
	});

	test(`${locale} : l’adresse mailto reste dans la section`, () => {
		const mail = elements(section, 'a').find((a) => attr(a, 'href')?.startsWith('mailto:'));
		assert.ok(mail, 'lien mailto absent');
		assert.equal(attr(mail, 'href'), 'mailto:pocheron.louis@gmail.com');
		assert.equal(text(mail), 'pocheron.louis@gmail.com');
	});

	test(`${locale} : liens GitHub et config Neovim, puis la ville`, () => {
		assert.deepEqual(
			hrefs.filter((href) => !href.startsWith('mailto:')),
			['https://github.com/Popoch39', 'https://github.com/Popoch39/nvim'],
		);
		assert.match(text(section), links);
	});
}
