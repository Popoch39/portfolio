/**
 * The Établi's assembly as the page's opening (ADR 0012), and « Rejouer ». The assembly itself is CSS
 * (`Etabli.astro`, `HeroSheet.astro`), started before the first paint by the `intro` class that the inline
 * trigger sets (`IntroTrigger.astro`); this module only tells the animation base when it has ended.
 */
import { registerDetail, registerOpening } from '../animation/base';

const PLAYING = 'intro';
const root = document.documentElement;

registerOpening((end, idle) => {
	const hero = document.querySelector<HTMLElement>('[data-hero]');
	if (!root.classList.contains(PLAYING) || !hero) return;
	let finished = false;

	// The parts move on the compositor: the main thread is free for the scenes, which the base builds as
	// soon as the page has settled, while they fly. Among them, what stops the loops out of view.
	idle();

	// Ended when the hero's last animation has; one cancelled by a change of preference ends it too.
	const running = document
		.getAnimations()
		.filter((animation) => animation.effect instanceof KeyframeEffect && hero.contains(animation.effect.target));
	Promise.allSettled(running.map((animation) => animation.finished)).then(finish);

	// The inline trigger's belt may take the class away first (a starved phone): the opening ends with it.
	const lifted = new MutationObserver(() => {
		if (!root.classList.contains(PLAYING)) finish();
	});
	lifted.observe(root, { attributeFilter: ['class'] });

	function finish() {
		if (finished) return;
		finished = true;
		lifted.disconnect();
		root.classList.remove(PLAYING);
		end();
	}
	return finish;
});

registerDetail(() => {
	const bench = document.querySelector<HTMLElement>('[data-bench]');
	const button = document.querySelector<HTMLButtonElement>('[data-replay]');
	if (!bench || !button) return;

	// A replay starts the assembly's animations on the bench, and takes them away once they have all
	// ended: the board is back at rest, nothing held. Pressed again mid-way, it runs them from their start,
	// cancelled and played in the same task: no frame shows the board between the two.
	let run = 0;
	const settle = () => {
		const current = ++run;
		Promise.allSettled(bench.getAnimations({ subtree: true }).map((animation) => animation.finished)).then(() => {
			if (current === run) bench.removeAttribute('data-assemble');
		});
	};
	const replay = () => {
		if (root.classList.contains(PLAYING)) return;
		if (bench.hasAttribute('data-assemble')) {
			for (const animation of bench.getAnimations({ subtree: true })) {
				animation.cancel();
				animation.play();
			}
		} else bench.setAttribute('data-assemble', '');
		settle();
	};

	button.hidden = false;
	button.addEventListener('click', replay);
	return () => {
		button.removeEventListener('click', replay);
		button.hidden = true;
		run++;
		bench.removeAttribute('data-assemble');
	};
});
