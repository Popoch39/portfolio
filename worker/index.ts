/**
 * The site's Worker: the static assets answer every URL first, except `/api/*` (`run_worker_first` in
 * `wrangler.jsonc`), the only server logic of a static site (ADR 0010). One route: the Formulaire du Café
 * sends its proposal to Louis by mail.
 */

interface MailAddress {
	email: string;
	name?: string;
}

/** The structured message of the `send_email` binding (Cloudflare Email Service, `send()`). */
export interface OutgoingMail {
	to: string;
	from: MailAddress;
	replyTo: MailAddress;
	subject: string;
	text: string;
	html?: string;
}

export interface Env {
	/** `send_email`: throws an `Error` with a `code` when the mail cannot leave. */
	EMAIL: { send(mail: OutgoingMail): Promise<{ messageId: string }> };
	/** Rate Limiting: a budget of sends per key over a short period. */
	CONTACT_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
	ASSETS: { fetch(request: Request): Promise<Response> };
}

/** Louis's address, verified as a destination in Email Routing; the binding is pinned to it as well. */
const TO = 'pocheron.louis@gmail.com';
/** An address on the site's domain: the only kind of sender the binding accepts. */
const FROM: MailAddress = { email: 'contact@louis-pocheron.com', name: 'louis-pocheron.com' };

const MODES = { cafe: { label: 'café', subject: 'Un café ?' }, visio: { label: 'visio', subject: 'Une visio ?' } };
/** The values the form sends; the chip reads « Semaine prochaine » for the second one. */
const WHEN = ['Cette semaine', 'La semaine prochaine', 'Plus tard'];

/** Generous for a form of four fields, small enough that nobody mails Louis a book. */
const MAX_BODY = 16_384;
const MAX_NAME = 100;
/** The longest address SMTP carries. */
const MAX_EMAIL = 254;
const MAX_MESSAGE = 4000;

/** The browser's own check for `type=email` (HTML standard): what it lets through, the route accepts. */
const EMAIL =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
/** Line breaks and other control characters: a name travels in the subject and in a header. */
const CONTROL = /[\p{Cc}]/u;

interface Proposal {
	mode: keyof typeof MODES;
	name: string;
	email: string;
	when: string;
	message: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/api/contact') return contact(request, env);
		if (pathname.startsWith('/api/')) return answer(404);
		return env.ASSETS.fetch(request);
	},
};

async function contact(request: Request, env: Env) {
	if (request.method !== 'POST') return answer(405, { allow: 'POST' });
	// Counted before anything is read: a robot pays for its invalid attempts too.
	const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const { success } = await env.CONTACT_LIMIT.limit({ key: ip });
	if (!success) return answer(429);

	const proposal = parse(await request.text());
	if (!proposal) return answer(400);

	try {
		await env.EMAIL.send(mailOf(proposal));
	} catch (error) {
		console.error('contact: the mail did not leave', error);
		return answer(502);
	}
	return answer(200);
}

/** The proposal when every field holds, `null` otherwise, whatever the browser checked. */
function parse(body: string): Proposal | null {
	if (body.length > MAX_BODY) return null;
	let data: unknown;
	try {
		data = JSON.parse(body);
	} catch {
		return null;
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
	// The wire keys are the form's field names, in French (ADR 0010): read once here, under English names.
	const { mode, nom: rawName, email, quand: when, message = '', site = '' } = data as Record<string, unknown>;

	// The trap field: hidden from people, filled in by robots that fill everything.
	if (site !== '') return null;
	if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) return null;
	if (typeof rawName !== 'string' || typeof email !== 'string' || typeof message !== 'string') return null;
	if (typeof when !== 'string' || !WHEN.includes(when)) return null;

	const name = rawName.trim();
	const address = email.trim();
	const text = message.trim();
	if (!name || name.length > MAX_NAME || CONTROL.test(name)) return null;
	if (address.length > MAX_EMAIL || !EMAIL.test(address)) return null;
	if (text.length > MAX_MESSAGE) return null;
	return { mode: mode as Proposal['mode'], name, email: address, when, message: text };
}

/** Plain text, every field spelled out: Louis answers with a click on « Répondre ». */
function mailOf({ mode, name, email, when, message }: Proposal): OutgoingMail {
	return {
		to: TO,
		from: FROM,
		replyTo: { email, name },
		subject: `${MODES[mode].subject} · ${name}`,
		text: [
			`Mode : ${MODES[mode].label}`,
			`Nom : ${name}`,
			`E-mail : ${email}`,
			`Quand : ${when}`,
			'',
			message || '(pas de message)',
		].join('\n'),
	};
}

function answer(status: number, headers: Record<string, string> = {}) {
	return Response.json(
		{ ok: status === 200 },
		{ status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } },
	);
}
