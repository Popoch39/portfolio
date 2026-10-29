// Section 05 · Contact : le Buffer, un vrai formulaire qui s'envoie sans JS au Worker de `/api/contact`
// (spec #116, ADR 0016), puis l'adresse et les liens, dans les deux Versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, hasAttr, elements, text, css } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		pitch: /Une API, une interface, un outil à construire \? Écrivez-moi\. Ouvert au remote\./,
		links: /GitHub — Popoch39 ↗ Config Neovim ↗ Besançon, France$/,
		legends: ['type:', 'budget:'],
		types: ['projet', 'app', 'bonjour'],
		labels: { nom: 'nom:', email: 'email:', message: '# Message — markdown bienvenu' },
		ok: /^"contact\.md" écrit — message envoyé à Louis/,
		errors: { e1: /^E1: type manquant/, e2: /^E2: email/, e3: /^E3: message vide/, e4: /^E4: /, e5: /^E5: envoi impossible/ },
	},
	{
		locale: 'en',
		pitch: /An API, an interface, a tool that needs building\? Drop me a line\. Open to remote\./,
		links: /GitHub — Popoch39 ↗ Neovim config ↗ Besançon, France$/,
		legends: ['type:', 'budget:'],
		types: ['project', 'app', 'hello'],
		labels: { nom: 'name:', email: 'email:', message: '# Message — markdown welcome' },
		ok: /^"contact\.md" written — message sent to Louis/,
		errors: { e1: /^E1: missing type/, e2: /^E2: .*email/, e3: /^E3: empty message/, e4: /^E4: /, e5: /^E5: sending failed/ },
	},
];

for (const { locale, pitch, links, legends, types, labels, ok, errors } of VERSIONS) {
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
