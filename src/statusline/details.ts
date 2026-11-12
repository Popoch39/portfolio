/**
 * What the statusline answers to the visitor on the home page (spec #93): the address yanked, the
 * modes that follow the selection and the focus. Registered as one detail, undone with the context.
 */
import { registerDetail } from '../animation/base';
import { followModes } from './modes';
import { yankAddress } from './yank';

registerDetail(() => {
	const stops = [yankAddress(), followModes()];
	return () => {
		for (const stop of stops) stop();
	};
});
