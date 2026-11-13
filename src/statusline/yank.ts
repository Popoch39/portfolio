/**
 * The Contact's address is yanked (spec #93, detail 13): a click copies it, with the blink of a `yank`
 * and the count of characters in the statusline. A click, so the same for a pointer, a tap and Enter
 * on the focused link. The link still writes a mail: a second click while the statusline says so, or
 * a modified click, follows it.
 */
import { registerDetail } from '../animation/base';
import { statusline } from '../i18n/fr';
import { forPage } from '../i18n/lang';
import { show } from './lane';

const { counted, copied: copiedWord, copyRefused, secondClick } = forPage({ fr: statusline });

/** How long the yank's answer stays, and with it the second click that opens the mail: time to read the hint. */
const ANSWER_DURATION = 4000;

/** Where the statusline's row has room for the hint after the answer; narrower, the answer alone fits whole. */
const wide = matchMedia('(min-width: 1320px)');
/** The narrowest phones, where the row holds 23 characters beside the mode and the Pause: the count loses its verb. */
const tight = matchMedia('(max-width: 359px)');

/** Tells whether the text reached the clipboard. */
async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// No Clipboard API outside a secure context, which a phone opening a preview over the local
		// network is not: the text is copied the old way, from a selection written out of sight.
		const selection = getSelection();
		if (!selection) return false;
		// What the visitor had selected is borrowed, and given back: the copy must not lift `VISUAL`.
		const selected = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index));
		const line = document.createElement('span');
		line.className = 'visually-hidden';
		line.textContent = text;
		document.body.append(line);
		selection.selectAllChildren(line);
		const copied = document.execCommand('copy');
		selection.removeAllRanges();
		for (const range of selected) selection.addRange(range);
		line.remove();
		return copied;
	}
}

// Listens to the address; what it returns leaves it a plain mail link again.
registerDetail(() => {
	const link = document.querySelector<HTMLAnchorElement>('[data-yank]');
	if (!link) return;
	let release = () => {};
	/** Running for as long as the answer stays: while it does, a click follows the link. */
	let answerTimer: ReturnType<typeof setTimeout> | undefined;

	const forget = () => {
		clearTimeout(answerTimer);
		answerTimer = undefined;
		release();
	};

	const yank = async (event: MouseEvent) => {
		// A modified click keeps the link's own behaviour.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		// The address is already copied and the visitor asks again: this time the link is followed.
		if (answerTimer !== undefined) {
			forget();
			return;
		}
		event.preventDefault();
		const address = link.href.replace(/^mailto:/, '');
		// Taken before the copy is awaited: a second click arriving meanwhile already opens the mail.
		answerTimer = setTimeout(forget, ANSWER_DURATION);
		const copied = await copyText(address);
		if (answerTimer === undefined) return;
		if (copied) link.dataset.yank = 'done';
		const count = `"+y · ${counted(address.length)}${tight.matches ? '' : copiedWord}`;
		const answer = copied ? count : copyRefused;
		release = show(wide.matches ? answer + secondClick : answer, { hold: true });
	};
	const settle = () => {
		link.dataset.yank = 'ready';
	};

	// The pointer says the address is copied, not followed, only once a click does copy it.
	settle();
	link.addEventListener('click', yank);
	link.addEventListener('animationend', settle);
	return () => {
		link.removeEventListener('click', yank);
		link.removeEventListener('animationend', settle);
		link.dataset.yank = '';
		forget();
	};
});
