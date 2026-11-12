/**
 * The statusline's write lane (spec #93): the one way a detail writes in the statusline, the way Vim
 * answers on its last row. A message takes the place of the branch and the file name, and can hold
 * the mode's segment; the display in force (the lede's mode, the paper) is hidden meanwhile by the
 * row's styles (`data-lane`), never rewritten, so giving it back is only taking the message away.
 * Not announced: the two segments it fills are `aria-hidden` like those they cover, and no live
 * region carries them (`Statusline.astro`).
 */

/** How long a message stays when nobody holds it. */
const MESSAGE_DURATION = 2400;

interface Message {
	text: string;
	mode?: string;
}

export interface MessageOptions {
	/**
	 * A mode shown in place of the statusline's own (`VISUAL`), for as long as the message stays. Held,
	 * it stays under the messages shown after it and comes back when they leave, until it is released.
	 */
	mode?: string;
	/** Stays until released or replaced (a hover, a selection) rather than for a moment. */
	hold?: boolean;
}

const row = document.querySelector<HTMLElement>('#statusline');
// Each segment keeps one text node, whose text alone is rewritten: a node taken out and another put
// in has the browser compute again the style of some eighty elements of the page, at every message.
const messageText = row?.querySelector('[data-lane-message]')?.appendChild(new Text());
const modeText = row?.querySelector('[data-lane-mode]')?.appendChild(new Text());

let timer: ReturnType<typeof setTimeout> | undefined;
/** The message on display: a release only gives back the message it was handed for. */
let current: Message | undefined;
/**
 * The held mode (`VISUAL` while a selection lasts): its cause outlives the messages that pass over it,
 * so it keeps the mode's segment under them and gets the row back when they leave. The mode shown
 * then follows its cause, not whoever wrote last.
 */
let held: Message | undefined;

function render() {
	const text = (current ?? held)?.text ?? '';
	const mode = current?.mode ?? held?.mode ?? '';
	if (messageText && messageText.data !== text) messageText.data = text;
	if (modeText && modeText.data !== mode) modeText.data = mode;
	// The row's styles read which segments show from this mark, written only when one comes or goes:
	// a message replacing another changes its text and nothing else.
	const shown = [text && 'message', mode && 'mode'].filter(Boolean).join(' ');
	if (!row || (row.dataset.lane ?? '') === shown) return;
	if (shown) row.dataset.lane = shown;
	else delete row.dataset.lane;
}

/**
 * Shows a message in the statusline, in place of the last one if any. It leaves on its own after a
 * moment unless held. Returns the way to give the display back before that, which whoever showed it
 * calls from its cleanup; once the message has gone, or has been replaced by another one, it does nothing.
 */
export function show(text: string, { mode, hold = false }: MessageOptions = {}): () => void {
	clearTimeout(timer);
	timer = undefined;
	const shown: Message = { text, mode };
	const release = () => {
		if (shown === current) {
			clearTimeout(timer);
			timer = undefined;
			current = undefined;
		} else if (shown === held) held = undefined;
		else return;
		render();
	};
	if (hold && mode !== undefined) {
		held = shown;
		current = undefined;
	} else {
		current = shown;
		if (!hold) timer = setTimeout(release, MESSAGE_DURATION);
	}
	render();
	return release;
}
