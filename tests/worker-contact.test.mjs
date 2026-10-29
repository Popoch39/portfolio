// Le Worker du Buffer (spec #116, ADR 0016), testé par son interface HTTP : son handler `fetch`,
// importé tel quel sous Node, reçoit une vraie `Request` et un `env` simulé, où `send_email` enregistre
// les mails et le Rate Limiting accepte ou refuse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/contact.ts';
import { written } from '../src/buffer/command.ts';
import { fieldsOf } from '../src/buffer/contact-md.ts';

const SITE = 'https://louis.example';

/** Un `env` de Worker : les mails envoyés s'accumulent dans `sent`, la limite répond `allow`. */
function makeEnv({ allow = true, fail = false } = {}) {
	const sent = [];
	const keys = [];
	return {
		sent,
		keys,
		CONTACT_TO: 'louis@example.com',
		CONTACT_FROM: 'portfolio@louis.example',
		SITE_ORIGIN: SITE,
		EMAIL: {
			async send(message) {
				if (fail) throw Object.assign(new Error('livraison impossible'), { code: 'E_DELIVERY_FAILED' });
				sent.push(message);
				return { messageId: 'm-1' };
			},
		},
		CONTACT_LIMIT: {
			async limit({ key }) {
				keys.push(key);
				return { success: allow };
			},
		},
	};
}

const VALID = { type: 'projet', nom: 'Ada Lovelace', email: 'ada@example.com', budget: '5-15k€', message: 'Une machine analytique à brancher sur une API.', lang: 'fr' };

/** Un envoi du Buffer : champs urlencoded par défaut, `json` pour le script, en-têtes à surcharger. */
function post(fields = VALID, { json = false, headers = {}, path = '/api/contact', method = 'POST', multipart = false } = {}) {
	const body = multipart ? Object.entries(fields).reduce((form, [k, v]) => (form.append(k, v), form), new FormData()) : new URLSearchParams(fields);
	return new Request(`${SITE}${path}`, {
		method,
		body: method === 'GET' || method === 'HEAD' ? undefined : body,
		headers: { Origin: SITE, 'CF-Connecting-IP': '203.0.113.7', ...(json ? { Accept: 'application/json' } : {}), ...headers },
	});
}

test('un envoi valide part chez Louis : objet, Reply-To du visiteur, corps façon contact.md', async () => {
	const env = makeEnv();
	await worker.fetch(post(), env);
	assert.equal(env.sent.length, 1);
	const [mail] = env.sent;
	assert.equal(mail.to, 'louis@example.com');
	assert.equal(mail.from, 'portfolio@louis.example');
	assert.equal(mail.replyTo, 'ada@example.com');
	assert.equal(mail.subject, '[portfolio] projet — Ada Lovelace');
	assert.equal(
		mail.text,
		['---', 'type: projet', 'nom: Ada Lovelace', 'email: ada@example.com', 'budget: 5-15k€', 'langue: fr', '---', '', 'Une machine analytique à brancher sur une API.', ''].join('\n'),
	);
});

// « "contact.md" NL, NB écrits » (#120) compte le contact.md que Louis reçoit : à la manière de Vim, ses
// lignes (le fichier finit par un retour à la ligne) et ses octets UTF-8.
test('ce que :wq dit avoir écrit est le corps du mail, au caractère près, lu dans le même Buffer', async () => {
	const cases = [
		VALID,
		{ ...VALID, nom: '  Ada  ', email: ' ada@example.com ', budget: '', message: 'Ligne 1\r\nLigne 2' },
		{ ...VALID, type: 'bonjour', nom: '', budget: '<5k€', lang: 'en' },
	];
	for (const fields of cases) {
		const env = makeEnv();
		await worker.fetch(post(fields), env);
		const [{ text }] = env.sent;
		const data = Object.entries(fields).reduce((form, [k, v]) => (form.append(k, v), form), new FormData());
		assert.equal(written(fieldsOf(data)), `${text.split('\n').length - 1}L, ${Buffer.byteLength(text)}B`, JSON.stringify(fields));
	}
});

test('envoi natif : 303 vers l’ancre succès de la section Contact, à la racine pour le français', async () => {
	const response = await worker.fetch(post(), makeEnv());
	assert.equal(response.status, 303);
	assert.equal(response.headers.get('Location'), '/#contact-ok');
});

test('envoi natif depuis la Version anglaise : 303 vers /en/', async () => {
	const response = await worker.fetch(post({ ...VALID, lang: 'en' }), makeEnv());
	assert.equal(response.status, 303);
	assert.equal(response.headers.get('Location'), '/en/#contact-ok');
});

test('envoi du script (Accept: application/json) : { ok: true }, sans redirection', async () => {
	const response = await worker.fetch(post(VALID, { json: true }), makeEnv());
	assert.equal(response.status, 200);
	assert.match(response.headers.get('Content-Type'), /^application\/json/);
	assert.deepEqual(await response.json(), { ok: true });
});

test('un corps multipart est lu comme un corps urlencoded', async () => {
	const env = makeEnv();
	const response = await worker.fetch(post(VALID, { multipart: true, json: true }), env);
	assert.deepEqual(await response.json(), { ok: true });
	assert.equal(env.sent[0].subject, '[portfolio] projet — Ada Lovelace');
});

test('sans nom ni budget : l’objet prend l’adresse, l’en-tête le dit ; « bonjour » ignore le budget', async () => {
	const env = makeEnv();
	await worker.fetch(post({ ...VALID, nom: '', budget: '' }), env);
	await worker.fetch(post({ ...VALID, type: 'bonjour', budget: '<5k€' }), env);
	const [anonyme, bonjour] = env.sent;
	assert.equal(anonyme.subject, '[portfolio] projet — ada@example.com');
	assert.match(anonyme.text, /^nom: —$/m);
	assert.match(anonyme.text, /^budget: —$/m);
	assert.match(bonjour.text, /^budget: sans objet$/m);
});

/** Les champs refusés, chacun avec le code que la ligne de commande du Buffer affiche. */
const INVALID = [
	{ code: 'E1', why: 'type manquant', fields: { ...VALID, type: '' } },
	{ code: 'E1', why: 'type inconnu', fields: { ...VALID, type: 'devis' } },
	{ code: 'E2', why: 'email manquant', fields: { ...VALID, email: '' } },
	{ code: 'E2', why: 'email sans @', fields: { ...VALID, email: 'ada.example.com' } },
	{ code: 'E2', why: 'email sans domaine', fields: { ...VALID, email: 'ada@' } },
	{ code: 'E3', why: 'message vide', fields: { ...VALID, message: '' } },
	{ code: 'E3', why: 'message blanc', fields: { ...VALID, message: ' \n\t ' } },
	{ code: 'E4', why: 'nom de 101 caractères', fields: { ...VALID, nom: 'a'.repeat(101) } },
	{ code: 'E4', why: 'nom sur deux lignes', fields: { ...VALID, nom: 'Ada\r\nBcc: x@example.com' } },
	{ code: 'E4', why: 'budget hors des tranches', fields: { ...VALID, budget: '1M€' } },
	{ code: 'E4', why: 'message de 5 001 caractères', fields: { ...VALID, message: 'a'.repeat(5001) } },
	{ code: 'E4', why: 'langue inconnue', fields: { ...VALID, lang: 'de' } },
];

for (const { code, why, fields } of INVALID) {
	test(`${why} : ${code}, en JSON comme en redirection, et aucun mail`, async () => {
		const env = makeEnv();
		const json = await worker.fetch(post(fields, { json: true }), env);
		assert.deepEqual(await json.json(), { ok: false, code });
		const native = await worker.fetch(post(fields), env);
		assert.equal(native.status, 303);
		assert.equal(native.headers.get('Location'), `/#contact-${code.toLowerCase()}`);
		assert.equal(env.sent.length, 0);
	});
}

test('une erreur depuis la Version anglaise revient sur /en/', async () => {
	const response = await worker.fetch(post({ ...VALID, lang: 'en', email: '' }), makeEnv());
	assert.equal(response.headers.get('Location'), '/en/#contact-e2');
});

test('aux bornes : nom de 100 caractères, message de 5 000, chaque tranche de budget, chaque type', async () => {
	const env = makeEnv();
	const cases = [
		{ ...VALID, nom: 'a'.repeat(100), message: 'a'.repeat(5000) },
		...['<5k€', '5-15k€', '15-40k€', '?', ''].map((budget) => ({ ...VALID, budget })),
		...['projet', 'app', 'bonjour'].map((type) => ({ ...VALID, type })),
	];
	for (const fields of cases) assert.deepEqual(await (await worker.fetch(post(fields, { json: true }), env)).json(), { ok: true });
	assert.equal(env.sent.length, cases.length);
});

test('pot de miel rempli : « succès » pour ne pas renseigner le robot, et aucun mail', async () => {
	const env = makeEnv();
	assert.deepEqual(await (await worker.fetch(post({ ...VALID, site: 'https://spam.example' }, { json: true }), env)).json(), { ok: true });
	assert.equal((await worker.fetch(post({ ...VALID, site: 'x' }), env)).headers.get('Location'), '/#contact-ok');
	assert.equal(env.sent.length, 0);
});

test('délai fourni et trop court : « succès » sans mail ; délai suffisant ou absent : le mail part', async () => {
	const env = makeEnv();
	assert.deepEqual(await (await worker.fetch(post({ ...VALID, delai: '800' }, { json: true }), env)).json(), { ok: true });
	assert.deepEqual(await (await worker.fetch(post({ ...VALID, delai: 'vite' }, { json: true }), env)).json(), { ok: true });
	assert.equal(env.sent.length, 0);
	await worker.fetch(post({ ...VALID, delai: '45000' }, { json: true }), env);
	await worker.fetch(post(VALID, { json: true }), env);
	assert.equal(env.sent.length, 2);
});

test('limite atteinte pour cette IP : E5, et aucun mail', async () => {
	const env = makeEnv({ allow: false });
	assert.deepEqual(await (await worker.fetch(post(VALID, { json: true }), env)).json(), { ok: false, code: 'E5' });
	assert.equal((await worker.fetch(post({ ...VALID, lang: 'en' }), env)).headers.get('Location'), '/en/#contact-e5');
	assert.deepEqual(env.keys, ['203.0.113.7', '203.0.113.7']);
	assert.equal(env.sent.length, 0);
});

test('envoi refusé par send_email : E5', async () => {
	const env = makeEnv({ fail: true });
	assert.deepEqual(await (await worker.fetch(post(VALID, { json: true }), env)).json(), { ok: false, code: 'E5' });
	assert.equal((await worker.fetch(post(VALID), env)).headers.get('Location'), '/#contact-e5');
});

test('une autre méthode que POST est refusée (405, Allow: POST), sans mail', async () => {
	const env = makeEnv();
	for (const method of ['GET', 'PUT', 'DELETE']) {
		const response = await worker.fetch(post(VALID, { method }), env);
		assert.equal(response.status, 405, method);
		assert.equal(response.headers.get('Allow'), 'POST');
	}
	assert.equal(env.sent.length, 0);
});

test('un autre chemin que /api/contact est refusé (404), sans mail', async () => {
	const env = makeEnv();
	for (const path of ['/api/contact/', '/api/contacts', '/api', '/']) assert.equal((await worker.fetch(post(VALID, { path }), env)).status, 404, path);
	assert.equal(env.sent.length, 0);
});

test('une origine étrangère, ou aucune, est refusée (403), sans mail ni limite consommée', async () => {
	const env = makeEnv();
	assert.equal((await worker.fetch(post(VALID, { headers: { Origin: 'https://spam.example' } }), env)).status, 403);
	assert.equal((await worker.fetch(post(VALID, { headers: { Origin: 'null' } }), env)).status, 403);
	const anonymous = new Request(`${SITE}/api/contact`, { method: 'POST', body: new URLSearchParams(VALID) });
	assert.equal((await worker.fetch(anonymous, env)).status, 403);
	assert.equal(env.sent.length, 0);
	assert.equal(env.keys.length, 0);
});

test('un corps qui n’est pas un formulaire : E4', async () => {
	const request = new Request(`${SITE}/api/contact`, { method: 'POST', body: '{"type":"projet"}', headers: { Origin: SITE, Accept: 'application/json', 'Content-Type': 'application/json' } });
	assert.deepEqual(await (await worker.fetch(request, makeEnv())).json(), { ok: false, code: 'E4' });
});
