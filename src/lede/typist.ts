/**
 * The lede rewritten in Vim, version after version: real motions (`0`, `w`, `f`, `ciw`), a human
 * typist's uneven rhythm, the keys shown screencast style and the mode echoed in the hero and the
 * statusline. Timers, not a GSAP timeline: the rhythm is random and the steps patch the DOM's text,
 * but it registers with the animation base so that reduced motion never starts it and a preference
 * flip puts the first version back.
 */
import { registerScene } from '../animation/base';
import type { Lede } from '../data/profile';
import { restingOn, runs, slotStarts, type BufferState, type Mode, type Run, type Slot } from './buffer';

/** Keys kept on screen at most; narrow screens show fewer (CSS). */
const MAX_KEYS = 10;

registerScene(() => {
	const parts = typistParts();
	if (!parts) return;
	const { root, buffer, versionNumber, audience, keys, heroMode, statusMode, modified } = parts;
	const lede = JSON.parse(root.dataset.lede ?? '') as Lede;
	const count = lede.versions.length;

	let state = restingOn(lede, 0);
	let version = 0;
	let pending: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	// Off screen, the typist holds its breath: nothing is typed that nobody sees.
	let visible = true;
	const observer = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
	});
	observer.observe(root);

	// One step is pending at a time: its handle alone cancels the whole script.
	const later = (ms: number, fn: () => void) => {
		clearTimeout(pending);
		pending = setTimeout(fn, ms);
	};

	function draw(patch: Partial<BufferState>) {
		const mode = state.mode;
		state = { ...state, ...patch };
		buffer.replaceChildren(...runs(lede, state).map(runNode));
		if (state.mode !== mode) showMode(state.mode);
	}

	function showMode(mode: Mode) {
		heroMode.textContent = `-- ${mode} --`;
		statusMode.textContent = mode;
		statusMode.dataset.mode = mode;
		modified.hidden = mode !== 'INSERT';
	}

	function showVersion(index: number) {
		version = index;
		versionNumber.textContent = `${index + 1}/${count}`;
		audience.textContent = `pour : ${lede.versions[index].audience}`;
		// Two identical keyframes, alternated: the fade restarts without a forced reflow.
		audience.dataset.run = audience.dataset.run === 'a' ? 'b' : 'a';
	}

	function press(label: string, patch?: Partial<BufferState>, fresh = false) {
		if (fresh) keys.replaceChildren();
		const cap = document.createElement('kbd');
		cap.textContent = label;
		if (label.length > 1) cap.dataset.wide = '';
		keys.append(cap);
		if (keys.childElementCount > MAX_KEYS) keys.firstElementChild?.remove();
		keys.dataset.on = 'true';
		if (patch) draw(patch);
	}

	type Step = [ms: number, run: () => void];

	// A human typist: uneven gaps, a breath after a space, now and then a hesitation, and on the last
	// version a slip of the fingers, caught and fixed.
	function typeInto(steps: Step[], slot: Slot, text: string, slip: boolean) {
		const start = () => slotStarts(lede, state)[slot];
		const sequence = slip
			? [...text.slice(0, -3), text.at(-2), text.at(-3), text.at(-1), '⌫', '⌫', '⌫', ...text.slice(-3)]
			: [...text];
		sequence.forEach((char, i) => {
			const previous = sequence[i - 1];
			if (char === '⌫') {
				steps.push([
					previous === '⌫' ? 115 : 420,
					() => {
						const value = state[slot].slice(0, -1);
						press('⌫', { [slot]: value, cursor: start() + value.length });
					},
				]);
				return;
			}
			let ms = i === 0 ? 180 : 55 + Math.random() * 95;
			if (previous === ' ' || previous === '’') ms += 70;
			if (i > 0 && Math.random() < 0.07) ms += 260;
			steps.push([
				ms,
				() => {
					const value = state[slot] + char;
					draw({ [slot]: value, cursor: start() + value.length });
				},
			]);
		});
	}

	function cycle() {
		if (stopped) return;
		// The Intro lands its point on the lede's cursor: the base only builds this scene once it has ended.
		if (!visible) {
			later(600, cycle);
			return;
		}
		const next = (version + 1) % count;
		const { what, whose } = lede.versions[next];
		const slip = next === count - 1;
		const first = lede.before.length;
		const second = () => slotStarts(lede, state).whose;
		const steps: Step[] = [];

		// To the first slot: line start, two words forward.
		steps.push([0, () => press('0', { cursor: 0 }, true)]);
		steps.push([210, () => press('w', { cursor: lede.before.indexOf(' ') + 1 })]);
		steps.push([180, () => press('w', { cursor: first })]);
		steps.push([320, () => press('c')]);
		steps.push([110, () => press('i')]);
		steps.push([120, () => press('w', { selected: 'what' })]);
		steps.push([340, () => draw({ selected: undefined, what: '', mode: 'INSERT', cursor: first })]);
		typeInto(steps, 'what', what, false);
		steps.push([420, () => press('Échap', { mode: 'NORMAL', cursor: first + state.what.length - 1 })]);

		// To the second slot: find the "v" of "votre", one word forward.
		steps.push([640, () => press('f', undefined, true)]);
		steps.push([130, () => press('v', { cursor: second() - lede.between.length + lede.between.indexOf('v') })]);
		steps.push([190, () => press('w', { cursor: second() })]);
		steps.push([320, () => press('c')]);
		steps.push([110, () => press('i')]);
		steps.push([120, () => press('w', { selected: 'whose' })]);
		steps.push([340, () => draw({ selected: undefined, whose: '', mode: 'INSERT', cursor: second() })]);
		typeInto(steps, 'whose', whose, slip);
		steps.push([
			420,
			() => {
				press('Échap', { mode: 'NORMAL', cursor: second() + state.whose.length - 1 });
				showVersion(next);
			},
		]);
		steps.push([1100, () => (keys.dataset.on = 'false')]);

		let i = 0;
		const go = () => {
			if (stopped) return;
			if (!visible) {
				later(400, go);
				return;
			}
			if (i >= steps.length) {
				later(2600, cycle);
				return;
			}
			const [ms, run] = steps[i++];
			later(ms, () => {
				run();
				go();
			});
		};
		go();
	}

	later(1800, cycle);

	// Reverted by a change of motion preference: the lede goes back to its first version, at rest.
	return () => {
		stopped = true;
		clearTimeout(pending);
		observer.disconnect();
		keys.replaceChildren();
		keys.dataset.on = 'false';
		state = { ...restingOn(lede, 0), mode: state.mode };
		draw({ mode: 'NORMAL' });
		showVersion(0);
	};
});

function runNode({ text, kind }: Run) {
	if (kind === 'text') return document.createTextNode(text);
	const span = document.createElement('span');
	span.dataset.kind = kind;
	span.textContent = text;
	return span;
}

/** The lede's elements and the mode indicators the typist writes to; `null` when one is missing. */
function typistParts() {
	const root = document.querySelector<HTMLElement>('[data-lede]');
	const parts = {
		root,
		buffer: root?.querySelector<HTMLElement>('[data-buffer]'),
		versionNumber: root?.querySelector<HTMLElement>('[data-version-number]'),
		audience: root?.querySelector<HTMLElement>('[data-audience]'),
		keys: root?.querySelector<HTMLElement>('[data-keys]'),
		heroMode: document.querySelector<HTMLElement>('.hero-mode'),
		statusMode: document.querySelector<HTMLElement>('#statusline [data-vim-mode]'),
		modified: document.querySelector<HTMLElement>('#statusline [data-vim-modified]'),
	};
	return allPresent(parts) ? parts : null;
}

function allPresent<T extends object>(parts: T): parts is { [K in keyof T]: NonNullable<T[K]> } {
	return Object.values(parts).every(Boolean);
}
