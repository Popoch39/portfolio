import { describe, expect, spyOn, test } from 'bun:test';
import worker, { type Env, type OutgoingMail } from './index';

/** Bindings as the Worker sees them in production, recording what it does with them. */
function bindings({ allowed = true, sendFails = false } = {}) {
	const sent: OutgoingMail[] = [];
	const limited: string[] = [];
	const assets: string[] = [];
	const env: Env = {
		EMAIL: {
			async send(mail) {
				if (sendFails) throw Object.assign(new Error('delivery failed'), { code: 'E_DELIVERY_FAILED' });
				sent.push(mail);
				return { messageId: 'id' };
			},
		},
		CONTACT_LIMIT: {
			async limit({ key }) {
				limited.push(key);
				return { success: allowed };
			},
		},
		ASSETS: {
			async fetch(request) {
				assets.push(new URL(request.url).pathname);
				return new Response('asset');
			},
		},
	};
	return { env, sent, limited, assets };
}

const VALID = {
	mode: 'cafe',
	nom: 'Ada Lovelace',
	email: 'ada@example.org',
	quand: 'Cette semaine',
	message: 'Une carte des moulins du Doubs.',
	site: '',
};

const post = (body: unknown, init: RequestInit = {}) =>
	new Request('https://louis-pocheron.com/api/contact', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
		...init,
	});

describe('POST /api/contact', () => {
	test('sends a plain-text mail from the site to Louis, the visitor in Reply-To, and answers 200', async () => {
		const { env, sent } = bindings();

		const response = await worker.fetch(post(VALID), env);

		expect(response.status).toBe(200);
		expect(sent).toHaveLength(1);
		const [mail] = sent;
		expect(mail.to).toBe('pocheron.louis@gmail.com');
		expect(mail.from).toEqual({ email: 'contact@louis-pocheron.com', name: 'louis-pocheron.com' });
		expect(mail.replyTo).toEqual({ email: 'ada@example.org', name: 'Ada Lovelace' });
		expect(mail.subject).toBe('Un café ? · Ada Lovelace');
		expect(mail.html).toBeUndefined();
		expect(mail.text).toBe(
			[
				'Mode : café',
				'Nom : Ada Lovelace',
				'E-mail : ada@example.org',
				'Quand : Cette semaine',
				'',
				'Une carte des moulins du Doubs.',
			].join('\n'),
		);
	});

	test('the subject and the body name a visio', async () => {
		const { env, sent } = bindings();

		await worker.fetch(post({ ...VALID, mode: 'visio', quand: 'La semaine prochaine' }), env);

		expect(sent[0].subject).toBe('Une visio ? · Ada Lovelace');
		expect(sent[0].text).toStartWith('Mode : visio\n');
		expect(sent[0].text).toContain('Quand : La semaine prochaine');
	});

	test('the message is optional, the mail says so', async () => {
		const { env, sent } = bindings();

		const response = await worker.fetch(post({ ...VALID, message: undefined, site: undefined }), env);

		expect(response.status).toBe(200);
		expect(sent[0].text).toEndWith('Quand : Cette semaine\n\n(pas de message)');
	});

	test('the fields are trimmed', async () => {
		const { env, sent } = bindings();

		await worker.fetch(post({ ...VALID, nom: '  Ada  ', email: ' ada@example.org ', message: '  \n ' }), env);

		expect(sent[0].subject).toBe('Un café ? · Ada');
		expect(sent[0].replyTo).toEqual({ email: 'ada@example.org', name: 'Ada' });
		expect(sent[0].text).toEndWith('(pas de message)');
	});

	const invalid: [string, unknown][] = [
		['an unknown mode', { ...VALID, mode: 'thé' }],
		['no mode', { ...VALID, mode: undefined }],
		['no name', { ...VALID, nom: undefined }],
		['a blank name', { ...VALID, nom: '   ' }],
		['a name over 100 characters', { ...VALID, nom: 'a'.repeat(101) }],
		['a name over two lines', { ...VALID, nom: 'Ada\nBcc: everyone@example.org' }],
		['no e-mail', { ...VALID, email: undefined }],
		['an e-mail without @', { ...VALID, email: 'ada.example.org' }],
		['an e-mail with a space', { ...VALID, email: 'ada lovelace@example.org' }],
		['an e-mail over 254 characters', { ...VALID, email: `${'a'.repeat(250)}@example.org` }],
		['no when', { ...VALID, quand: undefined }],
		['a when outside the three choices', { ...VALID, quand: 'Demain' }],
		['the displayed label instead of the value', { ...VALID, quand: 'Semaine prochaine' }],
		['a message over 4000 characters', { ...VALID, message: 'a'.repeat(4001) }],
		['a message that is not text', { ...VALID, message: 42 }],
		['the trap field filled', { ...VALID, site: 'https://spam.example' }],
		['a body that is not an object', ['cafe']],
		['a body that is not JSON', 'nom=Ada'],
	];
	for (const [name, body] of invalid) {
		test(`answers 400 to ${name}, and sends nothing`, async () => {
			const { env, sent } = bindings();

			const response = await worker.fetch(post(body), env);

			expect(response.status).toBe(400);
			expect(sent).toHaveLength(0);
		});
	}

	test('answers 400 to a body over 16 KB',async () => {
		const { env, sent } = bindings();

		const response = await worker.fetch(post({ ...VALID, message: 'a'.repeat(17_000) }), env);

		expect(response.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	test('limits the sends per visitor IP, and answers 429 past the limit', async () => {
		const { env, sent, limited } = bindings({ allowed: false });

		const response = await worker.fetch(post(VALID), env);

		expect(response.status).toBe(429);
		expect(limited).toEqual(['203.0.113.7']);
		expect(sent).toHaveLength(0);
	});

	test('answers 502 when the mail binding fails', async () => {
		const { env } = bindings({ sendFails: true });

		const response = await worker.fetch(post(VALID), env);

		expect(response.status).toBe(502);
	});

	test('logs the binding’s error code as a field of its own', async () => {
		const { env } = bindings({ sendFails: true });
		const logged = spyOn(console, 'error').mockImplementation(() => {});

		try {
			await worker.fetch(post(VALID), env);
			expect(logged).toHaveBeenCalledWith('contact: the mail did not leave', {
				code: 'E_DELIVERY_FAILED',
				message: 'delivery failed',
			});
		} finally {
			logged.mockRestore();
		}
	});

	for (const method of ['GET', 'PUT', 'DELETE']) {
		test(`answers 405 to ${method}, naming POST`, async () => {
			const { env, sent } = bindings();

			const response = await worker.fetch(new Request('https://louis-pocheron.com/api/contact', { method }), env);

			expect(response.status).toBe(405);
			expect(response.headers.get('allow')).toBe('POST');
			expect(sent).toHaveLength(0);
		});
	}

	test('its answers are never cached', async () => {
		const { env } = bindings();

		const response = await worker.fetch(post(VALID), env);

		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});

describe('the rest of the site', () => {
	test('another API path is not found', async () => {
		const { env, assets } = bindings();

		const response = await worker.fetch(new Request('https://louis-pocheron.com/api/other', { method: 'POST' }), env);

		expect(response.status).toBe(404);
		expect(assets).toHaveLength(0);
	});

	test('any other URL is handed to the static assets', async () => {
		const { env, assets } = bindings();

		const response = await worker.fetch(new Request('https://louis-pocheron.com/'), env);

		expect(await response.text()).toBe('asset');
		expect(assets).toEqual(['/']);
	});
});
