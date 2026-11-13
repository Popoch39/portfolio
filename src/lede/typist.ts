/**
 * The lede rewritten in Vim, version after version: real motions (`0`, `w`, `f`, `ciw`), a human
 * typist's uneven rhythm, the keys shown screencast style and the mode echoed in the statusline.
 * Timers, not a GSAP timeline: the rhythm is random and the steps patch the DOM's text, but it registers with the animation base so that reduced motion never starts it and a preference
 * flip puts the first version back.
 */
import { openingEnded, registerScene } from '../animation/base';
import { watchOffScreen } from '../animation/offscreen';
import type { Lede } from '../data/profile';
import * as en from '../i18n/en';
import * as fr from '../i18n/fr';
import { forPage } from '../i18n/lang';
import { restingOn, runs, slipped, slotStarts, type BufferState, type Run, type Slot } from './buffer';
import { showVimMode } from './vim-mode';

const line = forPage({ fr: fr.ledeLine, en: en.ledeLine });

/** Keys kept on screen at most; narrow screens show fewer (CSS). */
const MAX_KEYS = 10;

/** What can hold the typist where it stands; it types on once none is left. */
type Hold = 'opening' | 'off-screen' | 'paused';

/** The rest before the next version is typed: once the Intro has ended, and once the Pause is released. */
const RESTART_MS = 1800;

registerScene(() => {
	const parts = typistParts();
	if (!parts) return;
	const { root, views, pause } = parts;
	const lede = JSON.parse(root.dataset.lede ?? '') as Lede;
	const count = lede.versions.length;

	let state = restingOn(lede, 0);
	let version = 0;
	let stopped = false;

	// One step is pending at a time: its handle alone cancels the whole script.
	let pending: ReturnType<typeof setTimeout> | undefined;
	let queued: [ms: number, run: () => void] | undefined;
	// While any reason holds the typist, no timer waits at all: the queued step waits with it, and is taken on release.
	const holds = new Set<Hold>();
	const schedule = () => {
		if (!queued || holds.size > 0) return;
		const [ms, run] = queued;
		pending = setTimeout(() => {
			queued = undefined;
			run();
		}, ms);
	};
	const later = (ms: number, run: () => void) => {
		clearTimeout(pending);
		queued = [ms, run];
		schedule();
	};
	const hold = (reason: Hold) => {
		holds.add(reason);
		clearTimeout(pending);
	};
	const release = (reason: Hold) => {
		if (holds.delete(reason)) schedule();
	};

	// Off screen, the typist holds its breath: nothing is typed that nobody sees, and nothing wakes it but its return.
	const stopWatching = watchOffScreen(root, (offScreen) => (offScreen ? hold('off-screen') : release('off-screen')));

	// The Pause (WCAG 2.2.2) does not hold the typist mid-word: the version it was on comes back whole, at
	// rest, and the next one is typed from there on release.
	const followPause = () => {
		if (!pause.checked) {
			release('paused');
			return;
		}
		hold('paused');
		queued = [RESTART_MS, cycle];
		settle(version);
	};
	pause.addEventListener('change', followPause);

	const showKeys = (on: boolean) => views.forEach(({ keys }) => (keys.dataset.on = String(on)));

	function draw(patch: Partial<BufferState>) {
		const mode = state.mode;
		state = { ...state, ...patch };
		const drawn = runs(lede, state);
		views.forEach(({ buffer }) => buffer.replaceChildren(...drawn.map(runNode)));
		if (state.mode !== mode) showVimMode(state.mode);
	}

	/** The buffer whole and at rest on a version, the keys put away. */
	function settle(index: number) {
		views.forEach(({ keys }) => keys.replaceChildren());
		showKeys(false);
		state = { ...restingOn(lede, index), mode: state.mode };
		draw({ mode: 'NORMAL' });
	}

	function showVersion(index: number) {
		version = index;
		views.forEach(({ versionNumber, audience }) => {
			versionNumber.textContent = `${index + 1}/${count}`;
			audience.textContent = line.audience(lede.versions[index].audience);
			// Two identical keyframes, alternated: the fade restarts without a forced reflow.
			audience.dataset.run = audience.dataset.run === 'a' ? 'b' : 'a';
		});
	}

	function press(label: string, patch?: Partial<BufferState>, fresh = false) {
		views.forEach(({ keys }) => {
			if (fresh) keys.replaceChildren();
			const cap = document.createElement('kbd');
			cap.textContent = label;
			if (label.length > 1) cap.dataset.wide = '';
			keys.append(cap);
			if (keys.childElementCount > MAX_KEYS) keys.firstElementChild?.remove();
		});
		showKeys(true);
		if (patch) draw(patch);
	}

	type Step = [ms: number, run: () => void];

	// A human typist: uneven gaps, a breath after a space, now and then a hesitation, and on the last
	// version a slip of the fingers, caught and fixed.
	function typeInto(steps: Step[], slot: Slot, text: string, slip: boolean) {
		const start = () => slotStarts(lede, state)[slot];
		const sequence = slip
			? [...slipped(text), '⌫', '⌫', '⌫', ...text.slice(-3)]
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
		steps.push([420, () => press(line.escape, { mode: 'NORMAL', cursor: first + state.what.length - 1 })]);

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
				press(line.escape, { mode: 'NORMAL', cursor: second() + state.whose.length - 1 });
				showVersion(next);
			},
		]);
		steps.push([1100, () => showKeys(false)]);

		let i = 0;
		const go = () => {
			if (stopped) return;
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

	later(RESTART_MS, cycle);
	// The Intro lands its point on the lede's cursor, and the base builds this scene before the Intro is
	// over (the Ouverture): its rest only starts once the Intro has ended.
	hold('opening');
	openingEnded.then(() => {
		if (!stopped) release('opening');
	});
	// Paused before the typist was built (a remembered choice, or during the Intro): the lede is still at rest on
	// its first version, as rendered.
	if (pause.checked) hold('paused');

	// Reverted by a change of motion preference: the lede goes back to its first version, at rest.
	return () => {
		stopped = true;
		clearTimeout(pending);
		stopWatching();
		pause.removeEventListener('change', followPause);
		settle(0);
		showVersion(0);
	};
});

function runNode({ text, kind, tiers }: Run) {
	if (kind === 'text') return document.createTextNode(text);
	if (kind === 'break') {
		const br = document.createElement('br');
		br.dataset.tiers = tiers?.join(' ');
		return br;
	}
	const span = document.createElement('span');
	span.dataset.kind = kind;
	span.textContent = text;
	return span;
}

/** What the typist writes to in one copy of the lede. */
type View = NonNullable<ReturnType<typeof viewOf>>;

function viewOf(root: Element | null) {
	const view = {
		buffer: root?.querySelector<HTMLElement>('[data-buffer]'),
		versionNumber: root?.querySelector<HTMLElement>('[data-version-number]'),
		audience: root?.querySelector<HTMLElement>('[data-audience]'),
		keys: root?.querySelector<HTMLElement>('[data-keys]'),
	};
	return allPresent(view) ? view : null;
}

/**
 * The lede's elements the typist writes to; `null` when one is missing. The lede's copy on the hero's night
 * (ADR 0008) gets every keystroke too, so that both halves read alike.
 */
function typistParts() {
	const root = document.querySelector<HTMLElement>('[data-lede]');
	const views = [root, ...document.querySelectorAll('[data-lede-night]')].map(viewOf);
	const parts = {
		root,
		pause: document.querySelector<HTMLInputElement>('#pause'),
	};
	return allPresent(parts) && allPresent(views) ? { ...parts, views } : null;
}

function allPresent<T extends object>(parts: T): parts is { [K in keyof T]: NonNullable<T[K]> } {
	return Object.values(parts).every(Boolean);
}
