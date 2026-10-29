// La ligne de commande du Buffer (#120), sans DOM : ce que veut dire une commande tapée, la validation
// E1 à E3, ce que `:wq` écrit et le `mailto:` de repli de E5. Les tests l'importent sous Node, comme le
// registre de la Lunette (ADR 0007). Il porte sa propre table bilingue : la table `ui` du site partirait
// entière avec le module.

/** Les champs du Buffer, tels que le formulaire les envoie (le type en français dans les deux Versions). */
export type Fields = { type: string; nom: string; email: string; budget: string; message: string };

export type Command = { kind: 'write' | 'quit' | 'abandon' | 'none' } | { kind: 'unknown'; line: string };

/** La commande d'une ligne tapée, avec ou sans ses deux-points. */
export function command(line: string): Command {
	const typed = line.trim().replace(/^:/, '').trim();
	if (!typed) return { kind: 'none' };
	if (/^(wq|x|w)$/.test(typed)) return { kind: 'write' };
	if (typed === 'q') return { kind: 'quit' };
	if (typed === 'q!') return { kind: 'abandon' };
	return { kind: 'unknown', line: typed };
}

// La forme d'adresse du Worker (worker/contact.ts) : le client refuse ce que le Worker refuserait.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Un champ refusé, nommé par son message : le Buffer y ramène le curseur. */
export type Refusal = 'e1' | 'e2' | 'e2invalid' | 'e3';

/** Le premier manque du Buffer, dans l'ordre de la planche, ou `undefined` s'il peut partir. */
export function validate({ type, email, message }: Fields): Refusal | undefined {
	if (!type) return 'e1';
	if (!email.trim()) return 'e2';
	if (!EMAIL.test(email.trim())) return 'e2invalid';
	if (!message.trim()) return 'e3';
	return undefined;
}

// Le client a vu l'adresse non vide : refusée par le Worker, elle est mal formée.
const WORKER: Partial<Record<string, Refusal>> = { E1: 'e1', E2: 'e2invalid', E3: 'e3' };

/**
 * Le champ que le Worker refuse, ou `undefined` : E4 (un champ qu'un Buffer intact n'envoie pas), E5 et
 * une réponse illisible mènent au `mailto:` de E5, seul recours que le visiteur ait alors (#120).
 */
export const refused = (code?: string): Refusal | undefined => (code ? WORKER[code] : undefined);

/** Ce que `:wq` écrit, à la manière de Vim : les lignes et les octets UTF-8 de `contact.md`. */
export function written({ type, nom, email, budget, message }: Fields): string {
	const md = ['---', `type: ${type}`, `nom: ${nom}`, `email: ${email}`, `budget: ${budget}`, '---', '# Message', message].join('\n');
	return `${md.split('\n').length}L, ${new TextEncoder().encode(md).length}B`;
}

/** Le `mailto:` prérempli de E5 : l'objet du mail du Worker, et le message. */
export function mailto(to: string, { type, nom, email, message }: Fields): string {
	// `encodeURIComponent` plutôt que `URLSearchParams` : un client mail lirait ses `+` tels quels.
	return `mailto:${to}?subject=${encodeURIComponent(`[portfolio] ${type} — ${nom || email}`)}&body=${encodeURIComponent(message)}`;
}

export const texts = {
	fr: {
		placeholder: 'Tapez :wq puis Entrée pour envoyer',
		e1: 'E1: type manquant — projet, app ou bonjour ?',
		e2: 'E2: email manquant — où vous répondre ?',
		e2invalid: 'E2: email invalide — où vous répondre ?',
		e3: 'E3: message vide',
		// Suivi de l'adresse, en lien.
		e5: 'E5: envoi impossible — réessayez ou écrivez à ',
		e37: 'E37: rien d’envoyé (ajoutez ! pour abandonner)',
		e492: (line: string) => `E492: pas une commande de l’éditeur : ${line}`,
		abandoned: 'Buffer abandonné.',
		sending: 'envoi de contact.md…',
		sent: (size: string) => `"contact.md" ${size} écrits — message envoyé à Louis ✓`,
		thanks: 'Envoyé, merci !',
	},
	en: {
		placeholder: 'Type :wq then Enter to send',
		e1: 'E1: missing type — project, app or hello?',
		e2: 'E2: missing email — where should I reply?',
		e2invalid: 'E2: invalid email — where should I reply?',
		e3: 'E3: empty message',
		e5: 'E5: sending failed — try again or write to ',
		e37: 'E37: nothing sent (add ! to abandon)',
		e492: (line: string) => `E492: Not an editor command: ${line}`,
		abandoned: 'Buffer abandoned.',
		sending: 'sending contact.md…',
		sent: (size: string) => `"contact.md" ${size} written — message sent to Louis ✓`,
		thanks: 'Sent, thank you!',
	},
};
