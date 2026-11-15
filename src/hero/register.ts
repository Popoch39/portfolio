/**
 * The name out of register: a press on « Écrire » throws the name's second plate off the ink, the way a
 * printer's plate slips, and it snaps back under it (`HeroSheet.astro` draws and moves the plates).
 * A press, so the same for a pointer, a finger and Enter on the focused link; `:active` alone would
 * miss the key and cut the plate short at the release. The link is followed as ever.
 */
import { registerDetail } from '../animation/base';

registerDetail(() => {
	const hero = document.querySelector<HTMLElement>('[data-hero]');
	const button = hero?.querySelector<HTMLAnchorElement>('.hero-actions .button');
	if (!hero || !button) return;

	const slip = () => hero.toggleAttribute('data-slipped', true);
	const press = (event: PointerEvent) => {
		if (event.button === 0) slip();
	};
	const key = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.repeat) slip();
	};
	// Taken away once a plate is back, so that the next press plays it again.
	const settle = (event: AnimationEvent) => {
		if (event.animationName === 'register-slip') hero.removeAttribute('data-slipped');
	};

	button.addEventListener('pointerdown', press);
	button.addEventListener('keydown', key);
	hero.addEventListener('animationend', settle);
	return () => {
		button.removeEventListener('pointerdown', press);
		button.removeEventListener('keydown', key);
		hero.removeEventListener('animationend', settle);
		hero.removeAttribute('data-slipped');
	};
});
