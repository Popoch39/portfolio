/**
 * The statusline's modes follow the visitor (spec #93, detail 14). Selecting text in the page puts it
 * in `VISUAL` with the count of characters selected, whatever made the selection (a drag, a long
 * press, the keyboard); the selection lifted, the mode in force is back. A link focused from the
 * keyboard shows its target there, as a browser does for a hovered link.
 */
import { show } from './lane';

// Short, as Vim's own count is: beside `VISUAL` it needs no verb, and it fits a 320px phone's row.
const counted = (count: number) => (count > 1 ? `${count} caractères` : '1 caractère');

/** A link's target as written in the page, without the scheme a visitor does not need to read. */
const target = (link: HTMLAnchorElement) => (link.getAttribute('href') ?? '').replace(/^https?:\/\//, '');

/** Listens to the selection and the focus; returns the way to stop and give the row back. */
export function followModes() {
	let releaseVisual = () => {};
	let releaseTarget = () => {};
	let frame = 0;
	let shownCount = 0;

	const readSelection = () => {
		frame = 0;
		const count = getSelection()?.toString().length ?? 0;
		if (count === shownCount) return;
		shownCount = count;
		if (count === 0) releaseVisual();
		else releaseVisual = show(counted(count), { mode: 'VISUAL', hold: true });
	};
	// A drag fires the event at every move: the selection is read once per frame.
	const selectionChanged = () => {
		frame ||= requestAnimationFrame(readSelection);
	};

	const showTarget = (focused: EventTarget | null) => {
		const link = focused instanceof Element ? focused.closest<HTMLAnchorElement>('a[href]') : null;
		// The keyboard's focus only: a click's own would repeat what the visitor has just pointed at.
		if (link?.matches(':focus-visible')) releaseTarget = show(target(link), { hold: true });
	};
	const focused = (event: FocusEvent) => showTarget(event.target);
	const blurred = () => releaseTarget();

	document.addEventListener('selectionchange', selectionChanged);
	document.addEventListener('focusin', focused);
	document.addEventListener('focusout', blurred);
	// The visitor may have selected text or reached a link before the page settled: the mode never lies.
	showTarget(document.activeElement);
	readSelection();
	return () => {
		document.removeEventListener('selectionchange', selectionChanged);
		document.removeEventListener('focusin', focused);
		document.removeEventListener('focusout', blurred);
		cancelAnimationFrame(frame);
		releaseVisual();
		releaseTarget();
	};
}
