/**
 * The Formulaire du Café (board A · Le démontage): the Café's two actions open it in place, in café or
 * visio mode, and it sends the proposal to Louis through the site's Worker (`POST /api/contact`, ADR 0010).
 * Without JavaScript the actions stay the `mailto` links of the markup; with it they turn into buttons and
 * the form comes out of its inert template on the first opening.
 *
 * A detail, not a scene: the visitor gets the form under reduced motion too, where its styles only fade.
 * The states are written on the section (`data-cafe-state`, `data-cafe-flavour`, `data-cafe-ok`,
 * `data-cafe-phase`) and the CSS draws them; the phase is the transition in progress, timed as on the board.
 */
import { registerDetail } from '../animation/base';

type Flavour = 'cafe' | 'visio';
type State = 'rest' | 'form' | 'sent';
type Phase = 'open' | 'close' | 'send' | 'switch' | 'again';

/** How long each transition lasts on the board, in ms; the focus moves at its end. */
const PHASES: Record<Phase, number> = { open: 1400, close: 1500, send: 1700, switch: 1200, again: 700 };
/** Under reduced motion every change is a 0.2s fade: the phase only waits for it. */
const REDUCED_PHASE = 220;

const TEXTS = {
	cafe: { heading: 'Un café, à Besançon.', switch: 'plutôt en visio', confirm: 'Envoyé. À très vite autour d’un café.' },
	visio: { heading: 'Une visio, où que vous soyez.', switch: 'plutôt un café', confirm: 'Envoyé. À très vite en visio.' },
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

registerDetail(() => {
	const section = document.querySelector<HTMLElement>('[data-cafe]');
	const template = section?.querySelector<HTMLTemplateElement>('template[data-cafe-form]');
	const restBlock = section?.querySelector<HTMLElement>('[data-cafe-rest]');
	const links = [...(section?.querySelectorAll<HTMLAnchorElement>('a[data-cafe-open]') ?? [])];
	if (!section || !template || !restBlock || links.length === 0) return;
	const address = section.dataset.cafeAddress ?? '';

	// The actions open the form: buttons, no longer links that leave for the mail client.
	const buttons = links.map((link) => {
		const button = document.createElement('button');
		// Every attribute but the address, the component's style scope included.
		for (const { name, value } of link.attributes) if (name !== 'href') button.setAttribute(name, value);
		button.type = 'button';
		button.append(...link.cloneNode(true).childNodes);
		link.replaceWith(button);
		return button;
	});
	const coffee = buttons.find((button) => button.dataset.cafeOpen === 'cafe') ?? buttons[0];

	let panel: ReturnType<typeof buildPanel> | undefined;
	let state: State = 'rest';
	let flavour: Flavour = 'cafe';
	let sending: AbortController | undefined;
	let phaseTimer: ReturnType<typeof setTimeout> | undefined;

	/** Moves to a new state through a phase; `after` runs once the phase has played. */
	function go(next: { state?: State; flavour?: Flavour }, phase: Phase, after?: () => void) {
		clearTimeout(phaseTimer);
		state = next.state ?? state;
		flavour = next.flavour ?? flavour;
		section!.dataset.cafeState = state;
		section!.dataset.cafeFlavour = flavour;
		section!.dataset.cafePhase = phase;
		if (panel) {
			panel.heading.textContent = TEXTS[flavour].heading;
			panel.switchButton.textContent = TEXTS[flavour].switch;
			panel.confirm.textContent = TEXTS[flavour].confirm;
		}
		showVimMode(state === 'form' ? 'INSERT' : 'NORMAL');
		phaseTimer = setTimeout(
			() => {
				delete section!.dataset.cafePhase;
				after?.();
			},
			reducedMotion.matches ? REDUCED_PHASE : PHASES[phase],
		);
	}

	function open(event: Event) {
		const opener = (event.currentTarget as HTMLElement).dataset.cafeOpen;
		panel ??= buildPanel(template!, restBlock!);
		// A proposal already sent starts afresh; one left half-written is found as it was.
		if (state === 'sent') panel.form.reset();
		panel.hint.textContent = '';
		markValid();
		go({ state: 'form', flavour: opener === 'visio' ? 'visio' : 'cafe' }, 'open', () => panel?.fields.nom.focus());
	}

	function close() {
		if (state === 'rest') return;
		if (state === 'sent') return again();
		sending?.abort();
		go({ state: 'rest' }, 'close', () => coffee.focus());
	}

	function again() {
		go({ state: 'rest' }, 'again', () => coffee.focus());
	}

	function switchFlavour() {
		go({ flavour: flavour === 'cafe' ? 'visio' : 'cafe' }, 'switch');
	}

	/** Which of the four fields are in place, as the board's blocks: n (Nom), e (E-mail), w (Quand), m (Message). */
	function validity() {
		const { nom, email, message } = panel!.fields;
		return {
			n: nom.value.trim() !== '',
			e: email.value.trim() !== '' && email.validity.valid,
			w: panel!.quand() !== '',
			m: message.value.trim() !== '',
		};
	}

	function markValid() {
		const valid = validity();
		section!.dataset.cafeOk = Object.entries(valid)
			.filter(([, ok]) => ok)
			.map(([block]) => block)
			.join(' ');
		return valid;
	}

	function onInput(event: Event) {
		markValid();
		// Writing the message leaves the line as it is: it never names the message.
		if (event.target !== panel!.fields.message) panel!.hint.textContent = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		const { fields, hint, send, sendLabel, sendKey } = panel!;
		const valid = markValid();
		const missing = [
			!valid.n && { name: 'votre nom', field: fields.nom },
			!valid.e && { name: 'votre e-mail', field: fields.email },
			!valid.w && { name: 'quand', field: fields.firstChoice },
		].filter((item) => item !== false);
		if (missing.length > 0) {
			hint.textContent = `encore en l’air : ${missing.map((item) => item.name).join(', ')}`;
			missing[0].field.focus();
			return;
		}

		hint.textContent = '';
		sending = new AbortController();
		send.disabled = true;
		sendLabel.textContent = 'envoi…';
		sendKey.hidden = true;
		let sent = false;
		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					mode: flavour,
					nom: fields.nom.value.trim(),
					email: fields.email.value.trim(),
					quand: panel!.quand(),
					message: fields.message.value.trim(),
					site: fields.site.value,
				}),
				signal: sending.signal,
			});
			sent = response.ok;
		} catch {
			// Offline, or aborted by a close: the same answer as a refusal.
		}
		const aborted = sending.signal.aborted;
		sending = undefined;
		send.disabled = false;
		sendLabel.textContent = 'Envoyer';
		sendKey.hidden = false;
		if (aborted) return;
		if (!sent) {
			hint.textContent = `pas parti : réessayez, ou écrivez à ${address}`;
			return;
		}
		go({ state: 'sent' }, 'send', () => panel?.again.focus());
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && state !== 'rest') close();
	}

	// Listens on the section, so the panel's controls, built later, are heard too.
	function onClick(event: MouseEvent) {
		const target = event.target instanceof Element ? event.target.closest('button') : null;
		if (!target || !panel) return;
		if (target === panel.switchButton) switchFlavour();
		else if (target === panel.closeButton) close();
		else if (target === panel.again) again();
	}

	buttons.forEach((button) => button.addEventListener('click', open));
	section.addEventListener('keydown', onKey);
	section.addEventListener('click', onClick);
	section.addEventListener('input', onInput);
	section.addEventListener('submit', submit);

	return () => {
		clearTimeout(phaseTimer);
		sending?.abort();
		buttons.forEach((button, index) => button.replaceWith(links[index]));
		section.removeEventListener('keydown', onKey);
		section.removeEventListener('click', onClick);
		section.removeEventListener('input', onInput);
		section.removeEventListener('submit', submit);
		panel?.root.remove();
		for (const key of ['cafeState', 'cafeFlavour', 'cafePhase', 'cafeOk']) delete section.dataset[key];
		if (state === 'form') showVimMode('NORMAL');
	};
});

/** Puts the form in the page from its template, after the paragraph and the actions, whose place it takes. */
function buildPanel(template: HTMLTemplateElement, restBlock: HTMLElement) {
	const root = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
	restBlock.after(root);
	const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
	const form = find<HTMLFormElement>('form');
	return {
		root,
		form,
		heading: find<HTMLElement>('[data-cafe-heading]'),
		switchButton: find<HTMLButtonElement>('[data-cafe-switch]'),
		closeButton: find<HTMLButtonElement>('[data-cafe-close]'),
		send: find<HTMLButtonElement>('[data-cafe-send]'),
		sendLabel: find<HTMLElement>('[data-cafe-send-label]'),
		sendKey: find<HTMLElement>('[data-cafe-send-key]'),
		hint: find<HTMLElement>('[data-cafe-hint]'),
		confirm: find<HTMLElement>('[data-cafe-confirm]'),
		again: find<HTMLButtonElement>('[data-cafe-again]'),
		fields: {
			nom: form.elements.namedItem('nom') as HTMLInputElement,
			email: form.elements.namedItem('email') as HTMLInputElement,
			message: form.elements.namedItem('message') as HTMLTextAreaElement,
			site: form.elements.namedItem('site') as HTMLInputElement,
			firstChoice: find<HTMLInputElement>('input[name="quand"]'),
		},
		quand: () => (form.elements.namedItem('quand') as RadioNodeList).value,
	};
}

/**
 * The statusline's Vim mode, written as the Lede's typist does (`src/lede/typist.ts`): INSERT while the
 * visitor writes in the form, NORMAL otherwise.
 */
function showVimMode(mode: 'INSERT' | 'NORMAL') {
	const indicator = document.querySelector<HTMLElement>('#statusline [data-vim-mode]');
	const modified = document.querySelector<HTMLElement>('#statusline [data-vim-modified]');
	if (!indicator) return;
	indicator.textContent = mode;
	indicator.dataset.mode = mode;
	if (modified) modified.hidden = mode !== 'INSERT';
}
