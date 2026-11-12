/**
 * The Atome's finished tower answers whoever aims at a bague (spec #93, details 07 and 08): the bague
 * takes the accent and lifts a notch (`Atome.astro` styles `data-aimed`), and the statusline answers
 * `:set stack?`. A tool aimed at (its name in a label, its pastille) gives `stack=<tool>` and its
 * category; a whole bague (its band, its category, its focused label) lists its tools between commas,
 * the way Vim lists an option's values.
 * A pointer hovers, a finger taps, the keyboard focuses a label. Nothing answers while the scene plays.
 */
import { registerDetail } from '../animation/base';
import { show } from '../statusline/lane';

type Gesture = 'hover' | 'tap' | 'focus';

/** What a gesture aims at: a bague, and one of its tools when the gesture is that precise. */
interface Aim {
	bague: string;
	tool?: string;
}

/** How long a tap keeps its bague aimed at: a finger leaves nothing to end it, and nothing stays stuck. */
const TAP_HOLD = 2400;

/** Without a scene (reduced motion, no script of the scene yet), the tower is the page's final state. */
let standing = true;
let towerMoved = () => {};

/** The scene says when its tower stands finished, and when it leaves that state. */
export function towerStands(stands: boolean) {
	if (stands === standing) return;
	standing = stands;
	towerMoved();
}

registerDetail(() => {
	const atome = document.querySelector<HTMLElement>('[data-atome]');
	if (!atome) return;
	// A bague's seat in the drawing and its label: two subtrees the component links by `data-bague`.
	const parts = [...atome.querySelectorAll<HTMLElement>('[data-bague]')];
	const labels = new Map(
		[...atome.querySelectorAll<HTMLElement>('.atome-label')].map((label) => [
			label.dataset.bague,
			{
				category: label.querySelector('.atome-category')?.textContent ?? '',
				tools: [...label.querySelectorAll('.atome-tools li')].map((tool) => tool.textContent ?? ''),
			},
		]),
	);

	/** The gestures in force, the most recent last: it is the one that shows. */
	const aims = new Map<Gesture, Aim>();
	let answer = '';
	let giveBack = () => {};
	let tapEnd: ReturnType<typeof setTimeout> | undefined;

	const render = () => {
		const aimed = standing ? [...aims.values()].at(-1) : undefined;
		for (const part of parts) part.toggleAttribute('data-aimed', part.dataset.bague === aimed?.bague);
		const label = labels.get(aimed?.bague);
		const text = aimed && label ? `stack=${aimed.tool ?? label.tools.join(',')} · ${label.category}` : '';
		if (text === answer) return;
		answer = text;
		if (text) giveBack = show(text, { hold: true });
		else giveBack();
	};
	const aim = (gesture: Gesture, target?: Aim) => {
		aims.delete(gesture);
		if (target) aims.set(gesture, target);
		render();
	};

	const aimOf = (target: EventTarget | null): Aim | undefined => {
		if (!(target instanceof Element) || !atome.contains(target)) return;
		const bague = target.closest<HTMLElement>('[data-bague]')?.dataset.bague;
		if (bague === undefined) return;
		const tool =
			target.closest<HTMLElement>('[data-tool]')?.dataset.tool ?? target.closest('.atome-tools li')?.textContent;
		return { bague, tool: tool ?? undefined };
	};
	/** A label's focus only when it shows: a click or a tap focuses it too, and has already said what it aims at. */
	const focusAimOf = (target: EventTarget | null) =>
		target instanceof Element && target.matches('.atome-label:focus-visible') ? aimOf(target) : undefined;

	/** Where the pointer stood when it last came over something. */
	let overAt = { x: Number.NaN, y: Number.NaN };
	const onOver = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		const still = event.clientX === overAt.x && event.clientY === overAt.y;
		overAt = { x: event.clientX, y: event.clientY };
		const target = aimOf(event.target);
		const held = aims.get('hover');
		// The lift takes a pastille from under a pointer that has not moved and may leave its band
		// there: the tool is still the one aimed at.
		if (still && target?.bague === held?.bague) return;
		// Between two bands the drawing is empty: the bague aimed at stays, rather than drop back under
		// the pointer and lift again.
		const inDrawing = event.target instanceof Element && event.target.closest('.atome-tower');
		if (!target && inDrawing && held) return;
		aim('hover', target);
	};
	const onLeave = () => {
		overAt = { x: Number.NaN, y: Number.NaN };
		aim('hover');
	};
	// On the document: a tap elsewhere ends the aim. A scroll under the finger ends in `pointercancel`, a `pointerup` is a tap.
	const onUp = (event: PointerEvent) => {
		if (event.pointerType !== 'touch') return;
		clearTimeout(tapEnd);
		const target = aimOf(event.target);
		aim('tap', target);
		if (target) tapEnd = setTimeout(() => aim('tap'), TAP_HOLD);
	};
	const onFocusIn = (event: FocusEvent) => aim('focus', focusAimOf(event.target));
	const onFocusOut = () => aim('focus');

	atome.addEventListener('pointerover', onOver);
	atome.addEventListener('pointerleave', onLeave);
	document.addEventListener('pointerup', onUp);
	atome.addEventListener('focusin', onFocusIn);
	atome.addEventListener('focusout', onFocusOut);
	// A pointer at rest or a focused label says nothing when the scene's end arrives under it: the scene does.
	towerMoved = render;
	// A label may hold the focus already, when a preference flips and the details are set up again.
	aim('focus', focusAimOf(document.activeElement));
	return () => {
		atome.removeEventListener('pointerover', onOver);
		atome.removeEventListener('pointerleave', onLeave);
		document.removeEventListener('pointerup', onUp);
		atome.removeEventListener('focusin', onFocusIn);
		atome.removeEventListener('focusout', onFocusOut);
		towerMoved = () => {};
		clearTimeout(tapEnd);
		aims.clear();
		render();
	};
});
