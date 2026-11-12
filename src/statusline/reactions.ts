/**
 * What the statusline answers on the home page (spec #93). One module, loaded once the page has
 * settled: nothing of it is fetched for the first paint.
 */
import { followModes } from './modes';
import { yankAddress } from './yank';

/** Starts listening; returns the way to stop, for the animation base's context. */
export default function listen() {
	const stops = [yankAddress(), followModes()];
	return () => {
		for (const stop of stops) stop();
	};
}
