/**
 * The typist's handle for the Bascule (ADR 0011), in a module of its own so that the Bascule does not
 * bundle the typist: set while the typist is built, gone when its scene is reverted.
 */

export interface LedeHold {
	/** The version the lede now rests on, whole. */
	version: number;
	/** Types on from there. */
	resume: () => void;
}

let hold: (() => LedeHold) | undefined;

/** The typist offers its hold; the function it returns withdraws it. */
export function offerLedeHold(take: () => LedeHold) {
	hold = take;
	return () => {
		if (hold === take) hold = undefined;
	};
}

/**
 * Stops the typist and has the version it was typing finish at once; `undefined` when no typist runs
 * (reduced motion, or not built yet): the lede then rests on the version the page shows.
 */
export function holdLede(): LedeHold | undefined {
	return hold?.();
}

/** A page prerendered for a later navigation (Speculation Rules) runs before anyone sees it. */
export function prerendering() {
	return (document as Document & { prerendering?: boolean }).prerendering === true;
}
