/**
 * Nothing loops out of sight (CLAUDE.md, Fluidité): what moves on its own stops while no part of it
 * shows in the window, and takes up again where it was on coming back.
 * Called from a registered scene: the returned cleanup disconnects the observer when the context is
 * reverted, so nothing outlives a change of preference.
 */

/** Tells `onChange` whether the element has left the window (`true`) or come back (`false`). */
export function watchOffScreen(element: Element, onChange: (offScreen: boolean) => void) {
	const observer = new IntersectionObserver(([entry]) => onChange(!entry.isIntersecting));
	observer.observe(element);
	return () => observer.disconnect();
}

/**
 * For a CSS loop: `data-offscreen` stands on the element while it is out of view, and its styles pause
 * the loop under it (`animation-play-state`). Another reason to pause (the Pause) adds its own
 * selector: either one is enough.
 */
export function markOffScreen(element: HTMLElement) {
	const stop = watchOffScreen(element, (offScreen) => element.toggleAttribute('data-offscreen', offScreen));
	return () => {
		stop();
		element.removeAttribute('data-offscreen');
	};
}
