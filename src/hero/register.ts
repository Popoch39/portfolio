/**
 * The name out of register: a press on « Écrire » throws the name's second plate off the ink, the way a
 * printer's plate slips, and it snaps back under it (`HeroSheet.astro` draws and moves the plates).
 * A press, so the same for a pointer, a finger and Enter on the focused link; `:active` alone would
 * miss the key and cut the plate short at the release. The link is followed as ever.
 */
import { registerDetail } from '../animation/base';

registerDetail(() => {
	const map = document.querySelector<HTMLElement>('.hero-map');
	// The day's button: the night's copy is out of reach (ADR 0008).
	const button = map?.querySelector<HTMLAnchorElement>('.hero-actions:not([data-night]) .button');
	if (!map || !button) return;

	const slip = () => map.toggleAttribute('data-slipped', true);
	const press = (event: PointerEvent) => {
		if (event.button === 0) slip();
	};
	const key = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.repeat) slip();
	};
	// Taken away once a plate is back, so that the next press plays it again.
	const settle = (event: AnimationEvent) => {
		if (event.animationName === 'register-slip') map.removeAttribute('data-slipped');
	};

	button.addEventListener('pointerdown', press);
	button.addEventListener('keydown', key);
	map.addEventListener('animationend', settle);
	return () => {
		button.removeEventListener('pointerdown', press);
		button.removeEventListener('keydown', key);
		map.removeEventListener('animationend', settle);
		map.removeAttribute('data-slipped');
	};
});
