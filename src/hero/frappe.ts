/**
 * The Établi under the visitor's hand (ADR 0013). The Frappe: a key pressed by a click or a tap bottoms
 * out while held. The Effleurement: a key under a passing mouse gives a little (CSS alone). The Son,
 * off until the visitor turns it on and remembered from one visit to the next, lets both be heard, and
 * the clips of the board's assembly when « Rejouer » plays it.
 */
import { openingEnded, registerDetail } from '../animation/base';
import { hold, load, play } from './sound';

const STORED = 'son';
/** Loudness of each sound, a stroke as recorded being 1. */
const GAIN = { stroke: 1, brush: 0.2, clip: 0.22, turnedOn: 0.8 };
/** The clip's impact, from its start: 72 % of its 0.34 s (`cap-clip`, `Etabli.astro`). */
const CLIP_IMPACT = 0.245;
/** The quickest a mouse sweeping the board brushes keys one after the other, in ms. */
const BRUSH_GAP = 40;

// Storage throws when the browser blocks site data: the Son then lasts for this visit only.
function stored(use: (storage: Storage) => string | null | void) {
	try {
		return use(localStorage);
	} catch {
		return null;
	}
}

registerDetail(() => {
	const bench = document.querySelector<HTMLElement>('[data-bench]');
	const button = document.querySelector<HTMLButtonElement>('[data-sound]');
	if (!bench || !button) return;

	let on = stored((storage) => storage.getItem(STORED)) === 'on';
	let down: HTMLElement | undefined;
	let brushed: Element | undefined;
	let brushedAt = -Infinity;
	const clips = new Map<EventTarget, AudioBufferSourceNode>();

	const show = () => button.setAttribute('aria-pressed', String(on));
	const keyOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('.k') : null);
	const strike = (key: HTMLElement, gain: number) => {
		if (on) play({ gain, wide: key.hasAttribute('data-wide') });
	};

	const toggle = () => {
		on = !on;
		show();
		stored((storage) => (on ? storage.setItem(STORED, 'on') : storage.removeItem(STORED)));
		// Heard as soon as it can be: the press that says the board now sounds.
		if (on) load().then(() => on && play({ gain: GAIN.turnedOn }));
	};

	// Only the caps' faces catch the pointer: a mouse moving on one keeps the sound awake.
	const move = (event: PointerEvent) => {
		if (event.pointerType === 'mouse' && on) hold(true);
	};

	const leave = () => {
		brushed = undefined;
		hold(false);
	};

	const brush = (event: PointerEvent) => {
		const key = keyOf(event.target);
		if (event.pointerType !== 'mouse' || !key || key === brushed) return;
		brushed = key;
		const now = performance.now();
		if (down || now - brushedAt < BRUSH_GAP) return;
		brushedAt = now;
		strike(key, GAIN.brush);
	};

	const unbrush = (event: PointerEvent) => {
		if (brushed && !brushed.contains(event.relatedTarget as Node | null)) brushed = undefined;
	};

	const press = (event: PointerEvent) => {
		const key = keyOf(event.target);
		if (!key || event.button !== 0) return;
		down = key;
		key.dataset.down = '';
		if (event.pointerType === 'touch') return;
		// Held by the key while the button is: let go off the board, it still comes back up.
		(event.target as Element).setPointerCapture(event.pointerId);
		strike(key, GAIN.stroke);
	};

	// The strokes are whole, press and release: a mouse hears its own as the key goes down, a finger
	// once it is up, as it may yet start a scroll.
	const lift = (event: PointerEvent, heard: boolean) => {
		const key = down;
		if (!key) return;
		down = undefined;
		delete key.dataset.down;
		if (heard && event.pointerType === 'touch') strike(key, GAIN.stroke);
	};
	const release = (event: PointerEvent) => lift(event, true);
	// A finger that scrolls the page was not pressing a key: back up, unheard.
	const cancel = (event: PointerEvent) => lift(event, false);

	// The assembly replayed: each cap heard as it snaps onto its switch. Not on the arrival, where the
	// visitor has not acted on the page yet, which the browser requires for any sound.
	const clip = (event: AnimationEvent) => {
		if (!on || event.animationName !== 'cap-clip' || !bench.hasAttribute('data-assemble')) return;
		const source = play({ gain: GAIN.clip, at: CLIP_IMPACT });
		if (source) clips.set(event.target as EventTarget, source);
	};
	const unclip = (event: AnimationEvent) => {
		const target = event.target as EventTarget;
		clips.get(target)?.stop();
		clips.delete(target);
	};
	const clipped = (event: AnimationEvent) => clips.delete(event.target as EventTarget);

	// Left on at the last visit: the sound comes once the page has settled, ready for the first gesture.
	if (on)
		openingEnded.then(() => {
			if (on) void load();
		});

	show();
	button.hidden = false;
	button.addEventListener('click', toggle);
	bench.addEventListener('pointermove', move);
	bench.addEventListener('pointerleave', leave);
	bench.addEventListener('pointerover', brush);
	bench.addEventListener('pointerout', unbrush);
	bench.addEventListener('pointerdown', press);
	bench.addEventListener('pointerup', release);
	bench.addEventListener('pointercancel', cancel);
	bench.addEventListener('animationstart', clip);
	bench.addEventListener('animationcancel', unclip);
	bench.addEventListener('animationend', clipped);
	return () => {
		button.removeEventListener('click', toggle);
		bench.removeEventListener('pointermove', move);
		bench.removeEventListener('pointerleave', leave);
		bench.removeEventListener('pointerover', brush);
		bench.removeEventListener('pointerout', unbrush);
		bench.removeEventListener('pointerdown', press);
		bench.removeEventListener('pointerup', release);
		bench.removeEventListener('pointercancel', cancel);
		bench.removeEventListener('animationstart', clip);
		bench.removeEventListener('animationcancel', unclip);
		bench.removeEventListener('animationend', clipped);
		if (down) delete down.dataset.down;
		for (const source of clips.values()) source.stop();
		clips.clear();
		hold(false);
		button.hidden = true;
	};
});
