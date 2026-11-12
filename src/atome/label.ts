/**
 * The tower's label the keyboard has focused, if `target` is one. Only a focus that shows: a click or a
 * tap focuses a label too, and has already said what it aims at.
 */
export const keyboardFocusedLabel = (target: EventTarget | null) =>
	target instanceof HTMLElement && target.matches('.atome-label:focus-visible') ? target : undefined;
