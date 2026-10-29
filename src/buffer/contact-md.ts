// Le `contact.md` du Buffer (ADR 0016), partagé par le Worker, qui l'envoie à Louis, et par le script, qui
// compte ce que `:wq` écrit et prépare le `mailto:` de E5 : un seul gabarit, pour que les deux disent la
// même chose. Pur et sans import : Node l'importe tel quel dans les tests, wrangler l'embarque dans le Worker.

/** Les champs du Buffer, tels que le Worker les lit (le type en français dans les deux Versions). */
export type Fields = { type: string; nom: string; email: string; budget: string; message: string; lang: string };

// Une forme d'adresse, pas une preuve : le Reply-To d'une adresse fausse ne gêne que son auteur.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const read = (data: FormData, name: string) => {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
};

/** Les champs d'un envoi du Buffer, nettoyés comme le mail les écrit. */
export function fieldsOf(data: FormData): Fields {
	return {
		type: read(data, 'type'),
		nom: read(data, 'nom').trim(),
		email: read(data, 'email').trim(),
		budget: read(data, 'budget'),
		// L'envoi natif écrit les fins de ligne en CRLF : elles comptent pour un caractère, comme dans le `textarea`.
		message: read(data, 'message').replace(/\r\n?/g, '\n'),
		lang: read(data, 'lang'),
	};
}

/** L'objet du mail : l'adresse quand le nom manque. */
export const subject = ({ type, nom, email }: Fields) => `[portfolio] ${type} — ${nom || email}`;

/** `contact.md`, corps du mail en texte brut : l'en-tête puis le message. */
export function contactMd({ type, nom, email, budget, message, lang }: Fields): string {
	// Pour « bonjour », le Buffer remplace la ligne budget : une tranche cochée avant de changer de type ne compte plus.
	const range = type === 'bonjour' ? 'sans objet' : budget || '—';
	return ['---', `type: ${type}`, `nom: ${nom || '—'}`, `email: ${email}`, `budget: ${range}`, `langue: ${lang}`, '---', '', message, ''].join('\n');
}
