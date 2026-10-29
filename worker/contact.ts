// Le Worker du Buffer (ADR 0016) : il reçoit `POST /api/contact`, sur la même origine que le site
// resté sur Cloudflare Pages, et écrit à Louis par le binding `send_email`. Sans dépendance ni import :
// les tests l'importent tel quel sous Node, qui retire les types.

/** Ce que le Worker utilise du binding `send_email` : son API structurée. */
interface SendEmail {
	send(message: { to: string; from: string; replyTo: string; subject: string; text: string }): Promise<{ messageId: string }>;
}

/** Ce que le Worker utilise d'un binding Rate Limiting. */
interface RateLimit {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
	/** L'adresse vérifiée de Louis, seule destination permise au binding. */
	CONTACT_TO: string;
	/** L'expéditeur, sur le domaine du site. */
	CONTACT_FROM: string;
	/** L'origine du site (`https://domaine`), seule admise à envoyer. */
	SITE_ORIGIN: string;
	EMAIL: SendEmail;
	CONTACT_LIMIT: RateLimit;
}

/** Le seul chemin servi : la route du Worker sur le domaine du site. */
const PATH = '/api/contact';

type Fields ={ type: string; nom: string; email: string; budget: string; message: string; lang: string };

const read = (form: FormData, name: string): string => {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
};

/** Le corps du mail, en texte brut : l'en-tête de `contact.md` puis le message. */
function mailText({ type, nom, email, budget, message, lang }: Fields): string {
	// Pour « bonjour », le Buffer remplace la ligne budget : une tranche cochée avant de changer de type ne compte plus.
	const range = type === 'bonjour' ? 'sans objet' : budget || '—';
	return ['---', `type: ${type}`, `nom: ${nom || '—'}`, `email: ${email}`, `budget: ${range}`, `langue: ${lang}`, '---', '', message, ''].join('\n');
}

/** Le code d'une réponse : `ok`, ou l'erreur que la ligne de commande du Buffer affiche. */
type Outcome = 'ok' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

const TYPES = ['projet', 'app', 'bonjour'];
const BUDGETS = ['', '<5k€', '5-15k€', '15-40k€', '?'];
const LANGS = ['fr', 'en'];
const MAX_NOM = 100;
const MAX_MESSAGE = 5000;
// Une forme d'adresse, pas une preuve : le Reply-To d'une adresse fausse ne gêne que son auteur.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
/** Le pot de miel : un champ que le Buffer cache, et qu'un robot qui remplit tout remplit aussi. */
const HONEYPOT = 'site';
/** En deçà, du premier focus à l'envoi, personne n'a rempli le Buffer à la main. */
const MIN_DELAY_MS = 3000;

/** Un robot : pot de miel rempli, ou délai (mesuré par le script seulement) fourni et trop court. */
function isBot(form: FormData): boolean {
	if (read(form, HONEYPOT)) return true;
	const delay = read(form, 'delai');
	return delay !== '' && !(Number(delay) >= MIN_DELAY_MS);
}

/**
 * Le premier champ refusé, dans l'ordre des codes du Buffer, ou `undefined`. E4 couvre tout le reste :
 * un champ invalide ou trop long, qu'un Buffer intact ne peut pas envoyer.
 */
function invalid({ type, nom, email, budget, message, lang }: Fields): Outcome | undefined {
	if (!TYPES.includes(type)) return 'E1';
	if (email.length > MAX_EMAIL || !EMAIL.test(email)) return 'E2';
	if (!message.trim()) return 'E3';
	// Un retour à la ligne dans le nom passerait dans l'objet du mail.
	if (nom.length > MAX_NOM || /[\r\n]/.test(nom)) return 'E4';
	if (!BUDGETS.includes(budget) || !LANGS.includes(lang) || message.length > MAX_MESSAGE) return 'E4';
	return undefined;
}

/**
 * La réponse au Buffer. Le script, qui demande du JSON, reçoit `{ ok, code? }` ; l'envoi natif est
 * renvoyé (303, donc en GET) vers l'ancre de la section Contact que `:target` affiche, dans sa Version.
 */
function reply(request: Request, lang: string, outcome: Outcome): Response {
	if (request.headers.get('Accept')?.includes('application/json')) {
		return Response.json(outcome === 'ok' ? { ok: true } : { ok: false, code: outcome });
	}
	const home = lang === 'en' ? '/en/' : '/';
	return new Response(null, { status: 303, headers: { Location: `${home}#contact-${outcome.toLowerCase()}` } });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (new URL(request.url).pathname !== PATH) return new Response('Not Found', { status: 404 });
		if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
		// Tout navigateur envoie `Origin` avec un POST : son absence, comme une autre origine, n'est pas le Buffer.
		if (request.headers.get('Origin') !== env.SITE_ORIGIN) return new Response('Forbidden', { status: 403 });
		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			// Ni urlencoded ni multipart : rien qu'un Buffer n'enverrait. La Version est inconnue, donc la racine.
			return reply(request, '', 'E4');
		}
		const fields: Fields = {
			type: read(form, 'type'),
			nom: read(form, 'nom').trim(),
			email: read(form, 'email').trim(),
			budget: read(form, 'budget'),
			// L'envoi natif écrit les fins de ligne en CRLF : elles comptent pour un caractère, comme dans le `textarea`.
			message: read(form, 'message').replace(/\r\n?/g, '\n'),
			lang: read(form, 'lang'),
		};
		// « Succès » sans rien envoyer : le robot n'apprend pas qu'il est repéré.
		if (isBot(form)) return reply(request, fields.lang, 'ok');
		const error = invalid(fields);
		if (error) return reply(request, fields.lang, error);
		// Après la validation : une faute de frappe corrigée ne consomme pas l'envoi suivant.
		const { success } = await env.CONTACT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? '' });
		if (!success) return reply(request, fields.lang, 'E5');
		try {
			await env.EMAIL.send({
				to: env.CONTACT_TO,
				from: env.CONTACT_FROM,
				replyTo: fields.email,
				subject: `[portfolio] ${fields.type} — ${fields.nom || fields.email}`,
				text: mailText(fields),
			});
		} catch {
			// La cause (adresse non vérifiée, quota du jour…) n'aide pas le visiteur : E5 lui propose le `mailto:`.
			return reply(request, fields.lang, 'E5');
		}
		return reply(request, fields.lang, 'ok');
	},
};
