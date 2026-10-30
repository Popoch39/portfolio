// La ligne de commande du Buffer (#120) : un module pur, sans DOM, importé tel quel sous Node comme le
// registre de la Lunette. Il interprète la commande tapée, valide le Buffer dans l'ordre E1, E2, E3, compte
// ce que `:wq` écrit et prépare le `mailto:` de repli de E5, dans les deux Versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { command, mailto, refused, texts, validate, written } from '../src/buffer/command.ts';

const full = { type: 'projet', nom: 'Camille Martin', email: 'camille@studio.fr', budget: '5-15k€', message: 'Bonjour,\nune API à construire.', lang: 'fr' };

test(':wq, :x et :w envoient, avec ou sans deux-points, blancs autour ignorés', () => {
	for (const line of [':wq', 'wq', ' :x ', ':w']) assert.deepEqual(command(line), { kind: 'write' }, line);
});

test(':q refuse de quitter sans enregistrer, :q! abandonne le Buffer', () => {
	assert.deepEqual(command(':q'), { kind: 'quit' });
	assert.deepEqual(command('q!'), { kind: 'abandon' });
});

test('une ligne vide ne fait rien, toute autre commande est inconnue, citée sans ses deux-points', () => {
	assert.deepEqual(command(':'), { kind: 'none' });
	assert.deepEqual(command(''), { kind: 'none' });
	assert.deepEqual(command(':wqa'), { kind: 'unknown', line: 'wqa' });
	assert.deepEqual(command(':e trekker'), { kind: 'unknown', line: 'e trekker' });
});

test('la validation suit l’ordre de la planche : type, puis email, puis message', () => {
	assert.equal(validate({ ...full, type: '', email: '', message: '' }), 'e1');
	assert.equal(validate({ ...full, email: '', message: '' }), 'e2');
	assert.equal(validate({ ...full, email: '  ' }), 'e2');
	assert.equal(validate({ ...full, message: ' \n ' }), 'e3');
	assert.equal(validate(full), undefined);
	// Nom et budget sont facultatifs.
	assert.equal(validate({ ...full, nom: '', budget: '' }), undefined);
});

test('une adresse mal formée est refusée par E2, comme le Worker, avec son propre message', () => {
	assert.equal(validate({ ...full, email: 'camille@studio' }), 'e2invalid');
	assert.equal(validate({ ...full, email: 'camille studio.fr' }), 'e2invalid');
});

test('un refus du Worker sur E1 à E3 renvoie au champ ; E4, E5 ou une réponse illisible mènent au mailto de E5', () => {
	assert.equal(refused('E1'), 'e1');
	// Le client a vu l'adresse non vide : refusée par le Worker, elle est mal formée.
	assert.equal(refused('E2'), 'e2invalid');
	assert.equal(refused('E3'), 'e3');
	for (const code of ['E4', 'E5', undefined]) assert.equal(refused(code), undefined, String(code));
});

test('les messages de la planche, en français et en anglais', () => {
	assert.equal(texts.fr.e1, 'E1: type manquant — projet, app ou bonjour ?');
	assert.equal(texts.fr.e2, 'E2: email manquant — où vous répondre ?');
	assert.equal(texts.fr.e3, 'E3: message vide');
	assert.equal(texts.fr.e37, 'E37: rien d’envoyé (ajoutez ! pour abandonner)');
	assert.equal(texts.fr.abandoned, 'Buffer abandonné.');
	assert.equal(texts.fr.e492('wqa'), 'E492: pas une commande de l’éditeur : wqa');
	assert.equal(texts.fr.sending, 'envoi de contact.md…');
	assert.equal(texts.fr.sent('9L, 412B'), '"contact.md" 9L, 412B écrits — message envoyé à Louis ✓');
	assert.equal(texts.fr.thanks, 'Envoyé, merci !');
	assert.match(texts.fr.e5, /^E5: envoi impossible — réessayez ou écrivez à $/);
	assert.equal(texts.en.e1, 'E1: missing type — project, app or hello?');
	assert.equal(texts.en.e492('wqa'), 'E492: Not an editor command: wqa');
	assert.equal(texts.en.sent('9L, 412B'), '"contact.md" 9L, 412B written — message sent to Louis ✓');
	assert.equal(texts.en.thanks, 'Sent, thank you!');
	// Les deux tables ont les mêmes clés : une langue ne manque jamais un message.
	assert.deepEqual(Object.keys(texts.en).sort(), Object.keys(texts.fr).sort());
});

// Le contact.md compté est le corps du mail (worker-contact.test.mjs le vérifie au caractère près).
test('« écrits » compte les lignes et les octets UTF-8 de contact.md : l’en-tête du Buffer puis le message', () => {
	// ---, type, nom, email, budget, langue, ---, une ligne vide, puis les deux lignes du message : 10 lignes.
	const md = '---\ntype: projet\nnom: Camille Martin\nemail: camille@studio.fr\nbudget: 5-15k€\nlangue: fr\n---\n\nBonjour,\nune API à construire.\n';
	assert.equal(Buffer.byteLength(md), 127);
	assert.equal(written(full), '10L, 127B');
});

test('le mailto de E5 reprend l’objet du Worker et le message, encodés', () => {
	const href = mailto('louis@example.fr', full);
	const url = new URL(href);
	assert.equal(url.protocol, 'mailto:');
	assert.equal(url.pathname, 'louis@example.fr');
	assert.equal(url.searchParams.get('subject'), '[portfolio] projet — Camille Martin');
	assert.equal(url.searchParams.get('body'), full.message);
	// Des espaces en %20 : `+` resterait tel quel dans le client mail.
	assert.doesNotMatch(href, /\+/);
	// Sans nom, l'objet prend l'adresse, comme le Worker.
	assert.equal(new URL(mailto('louis@example.fr', { ...full, nom: '' })).searchParams.get('subject'), '[portfolio] projet — camille@studio.fr');
});
