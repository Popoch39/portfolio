// Le script du Buffer (#120), importé au premier focus par son écouteur (focus.ts) : la ligne de commande,
// la position `ln:col`, et l'envoi sans rechargement (validation E1 à E3, `:wq` qui se tape, spinner, puis
// succès figé ou E5 et son `mailto:`). Sans lui, le formulaire s'envoie nativement (ADR 0016).
import css from './buffer.css?inline';
import { command, mailto, refused, texts, validate, written, type Fields, type Refusal } from './command.ts';

/** Le spinner en ASCII : les spinners braille manquent à Fragment Mono (ADR 0005). */
const FRAMES = '|/-\\';

/** Le champ de chaque refus, que la validation ou le Worker l'ait prononcé. */
const FIELD: Record<Refusal, string> = { e1: '[name=type]', e2: '#buffer-email', e2invalid: '#buffer-email', e3: '#buffer-message' };

type Reply = { ok: boolean; code?: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const read = (data: FormData, name: string) => {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
};

/** Branche le Buffer de `form` ; `at` est l'instant du premier focus, d'où se mesure le délai pour le Worker. */
export function start(form: HTMLFormElement, at: number) {
	const t = texts[document.documentElement.lang.startsWith('en') ? 'en' : 'fr'];
	const win = form.querySelector<HTMLElement>('.win');
	const line = form.querySelector<HTMLElement>('.cmd');
	const cmd = form.querySelector<HTMLInputElement>('#buffer-cmd');
	const send = form.querySelector<HTMLButtonElement>('.send');
	if (!win || !line || !cmd || !send) return;
	const position = win.querySelector('.at');
	const lines = [...win.querySelectorAll('.buf > .ln')];
	const echoes = line.querySelectorAll<HTMLElement>('.echo');
	const returned = line.querySelector('.echo:target');

	document.head.append(Object.assign(document.createElement('style'), { textContent: css }));

	// La sortie de la ligne de commande : le message dans une région live polie, le spinner à côté, muet,
	// pour que chaque tour ne soit pas annoncé. Insérée dès le chargement, bien avant son premier message :
	// une région ajoutée en même temps que son texte ne serait pas lue.
	const out = document.createElement('p');
	out.className = 'say';
	const spinner = document.createElement('span');
	spinner.setAttribute('aria-hidden', 'true');
	const message = document.createElement('span');
	message.setAttribute('role', 'status');
	out.append(spinner, message);
	line.append(out);

	/** Écrit un message dans la ligne de commande (sans texte, l'efface), suivi d'un lien éventuel. */
	const say = (text = '', kind = '', link?: HTMLElement) => {
		for (const echo of echoes) echo.hidden = true;
		out.dataset.kind = kind;
		message.replaceChildren(...(text ? [text] : []), ...(link ? [link] : []));
		// Le message prend la place du texte d'aide, comme dans Vim.
		cmd.placeholder = text ? '' : t.placeholder;
	};

	cmd.hidden = false;
	// Le message du repli sans JS, s'il y en a un, passe dans la sortie du script.
	say(returned?.textContent ?? '', returned?.classList.contains('error') ? 'error' : returned ? 'ok' : '');

	// `ln:col` : la ligne du Buffer où est le curseur (celles du message s'y ajoutent), et sa colonne.
	const locate = () => {
		const field = document.activeElement;
		if (!position || !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
		const index = lines.findIndex((ln) => ln.contains(field));
		if (index < 0) return;
		// Un champ email ne donne pas sa sélection : le curseur est alors compté en fin de saisie.
		const before = field.type === 'radio' ? '' : field.value.slice(0, field.selectionStart ?? field.value.length);
		position.textContent = `${index + before.split('\n').length}:${before.length - before.lastIndexOf('\n')}`;
	};
	for (const type of ['focusin', 'input', 'click', 'keyup']) form.addEventListener(type, locate);

	/** Ramène le curseur sur le champ refusé et dit pourquoi. */
	const refuse = (refusal: Refusal) => {
		form.querySelector<HTMLElement>(FIELD[refusal])?.focus();
		say(t[refusal], 'error');
	};

	let busy = false;

	const submit = async () => {
		if (busy) return;
		const data = new FormData(form);
		const fields: Fields = {
			type: read(data, 'type'),
			nom: read(data, 'nom'),
			email: read(data, 'email'),
			budget: read(data, 'budget'),
			message: read(data, 'message'),
		};
		const missing = validate(fields);
		if (missing) return refuse(missing);
		busy = true;
		data.set('delai', String(Math.round(performance.now() - at)));
		const reply: Promise<Reply> = fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
			.then((response) => response.json())
			// Réseau coupé, Worker arrêté ou réponse illisible : le Buffer reste à réessayer.
			.catch(() => ({ ok: false, code: 'E5' }));

		win.dataset.sending = '';
		// La ligne se libère pour la commande qui se tape.
		say();
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!still) {
			for (const typed of [':', ':w', ':wq']) {
				cmd.value = typed;
				await wait(90);
			}
		}
		cmd.value = '';
		say(t.sending);
		let frame = 0;
		const turn = (now: number) => {
			spinner.textContent = `${FRAMES.charAt(Math.floor(now / 100) % FRAMES.length)} `;
			frame = requestAnimationFrame(turn);
		};
		if (!still) frame = requestAnimationFrame(turn);

		const { ok, code } = await reply;
		cancelAnimationFrame(frame);
		spinner.textContent = '';
		delete win.dataset.sending;

		if (ok) {
			say(t.sent(written(fields)), 'ok');
			win.dataset.sent = '';
			// Le texte du bouton seul : sa touche `:wq` reste, et la pilule garde sa hauteur.
			const label = send.firstChild;
			if (label) label.textContent = `${t.thanks} `;
			for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button')) {
				field.disabled = true;
			}
			return;
		}
		busy = false;
		const refusal = refused(code);
		if (refusal) return refuse(refusal);
		const address = form.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')?.href.slice('mailto:'.length) ?? '';
		say(t.e5, 'error', Object.assign(document.createElement('a'), { href: mailto(address, fields), textContent: address }));
	};

	form.noValidate = true;
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		void submit();
	});

	cmd.addEventListener('input', () => say());
	cmd.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') cmd.value = '';
		if (event.key !== 'Enter' || event.isComposing) return;
		// Entrée exécute la commande au lieu d'envoyer le formulaire.
		event.preventDefault();
		const typed = command(cmd.value);
		if (typed.kind === 'write') return void submit();
		cmd.value = '';
		if (typed.kind === 'quit') say(t.e37, 'error');
		else if (typed.kind === 'abandon') {
			form.reset();
			say(t.abandoned);
		} else if (typed.kind === 'unknown') say(t.e492(typed.line), 'error');
	});
}
