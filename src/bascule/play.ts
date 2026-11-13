/**
 * The Bascule's Anagramme (ADR 0011), on the page that goes: at a click on the other language, the
 * lede finishes its version, every animated block of the top of the page gets an overlay of letters
 * built from the build's data (`#anagramme`), the real text gives way to it, CSS transitions carry each
 * letter to its place in the other language, and the page navigates there. The browser measures
 * nothing: each place is columns × `1ch` plus pixels, from the data alone.
 *
 * A detail, not a scene: it answers a click whatever the motion preference, its styles giving it in
 * one step under reduced motion. Without JavaScript, the links are plain links.
 */
import { registerDetail } from '../animation/base';
import { holdLede, type LedeHold } from '../lede/control';
import { ARRIVAL_KEY, type AnagramData, type Block, type Decoration, type GlyphPlan, planBlock, totalOf } from './anagram';

/** A margin past the last letter's landing, ms, so that the page that leaves is captured at rest. */
const SETTLE_MS = 40;
/** Under reduced motion every letter fades in or out at once (`Anagramme.astro`). */
const REDUCED_MS = 180;

registerDetail(() => {
	const source = document.getElementById('anagramme');
	const control = document.querySelector<HTMLElement>('[data-bascule]');
	if (!source || !control) return;
	const data = JSON.parse(source.textContent ?? '') as AnagramData;
	const root = document.documentElement;

	/** Overlays of the blocks that never change, built ahead at the first sign of intent. */
	let prepared: Built | undefined;
	let versioned: Built | undefined;
	let lede: LedeHold | undefined;
	let link: HTMLAnchorElement | undefined;
	let frame = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const prepare = () => {
		prepared ??= build(data, data.blocks);
	};

	const otherLanguage = (event: Event) => {
		const target = event.target instanceof Element ? event.target.closest('a[data-bascule-lang]') : null;
		return target instanceof HTMLAnchorElement && !target.hasAttribute('aria-current') ? target : null;
	};

	const onIntent = (event: Event) => {
		if (otherLanguage(event)) prepare();
	};

	const onClick = (event: MouseEvent) => {
		const target = otherLanguage(event);
		if (!target || event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		if (link) return;
		link = target;
		lede = holdLede();
		const version = lede?.version ?? 0;
		prepare();
		// The paper is read now: the Nuancier may have changed it since the hover.
		versioned = build(data, [...(data.versions[version] ?? []), data.papers[paperInForce()]]);
		const total = matchMedia('(prefers-reduced-motion: reduce)').matches
			? REDUCED_MS
			: Math.max(prepared!.total, versioned.total);

		// One task: the real text gives way to its letters in the very frame they are first drawn.
		link.toggleAttribute('data-ag-to', true);
		root.classList.add('ag-on');
		// Their start drawn once, the next frame sets them off: a transition needs a style to leave.
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => root.classList.add('ag-go'));
		});
		const href = link.href;
		const to = link.pathname;
		timer = setTimeout(() => {
			try {
				sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({ v: version, to }));
			} catch {
				// Storage blocked: the other page opens on its first version, typing on from there.
			}
			location.assign(href);
		}, total + SETTLE_MS);
	};

	/** The page as it was before the Bascule: back from the history's cache, or the detail undone. */
	const reset = () => {
		cancelAnimationFrame(frame);
		clearTimeout(timer);
		root.classList.remove('ag-on', 'ag-go');
		versioned?.remove();
		versioned = undefined;
		link?.removeAttribute('data-ag-to');
		link = undefined;
		lede?.resume();
		lede = undefined;
	};

	const onPageShow = (event: PageTransitionEvent) => {
		if (event.persisted && link) reset();
	};

	control.addEventListener('pointerover', onIntent);
	control.addEventListener('pointerdown', onIntent);
	control.addEventListener('focusin', onIntent);
	control.addEventListener('click', onClick);
	addEventListener('pageshow', onPageShow);
	return () => {
		control.removeEventListener('pointerover', onIntent);
		control.removeEventListener('pointerdown', onIntent);
		control.removeEventListener('focusin', onIntent);
		control.removeEventListener('click', onClick);
		removeEventListener('pageshow', onPageShow);
		reset();
		prepared?.remove();
		prepared = undefined;
	};
});

/** The paper the statusline names, from the root's attributes (`SkyTrigger.astro`, the Nuancier). */
function paperInForce() {
	const root = document.documentElement;
	return root.dataset.bg ?? (root.dataset.theme === 'dark' ? 'auto-night' : 'auto-day');
}

interface Built {
	/** When the last of these letters lands, ms. */
	total: number;
	remove: () => void;
}

/**
 * The overlays of some blocks, in every host of each (the day's and the night's), hidden until the
 * Bascule shows them (`ag-on`). Each starts where the real text stands.
 */
function build(data: AnagramData, blocks: (Block | undefined)[]): Built {
	const added: Element[] = [];
	const hosts: Element[] = [];
	const inks: HTMLElement[] = [];
	const followers: HTMLElement[] = [];
	let total = 0;
	for (const block of blocks) {
		// A paper the build does not know (one added since) is left to change at the arrival.
		if (!block) continue;
		const plans = planBlock(block);
		total = Math.max(total, totalOf(plans));
		for (const host of document.querySelectorAll<HTMLElement>(`[data-ag-host="${block.host}"]`)) {
			const overlay = document.createElement('span');
			overlay.className = 'ag';
			overlay.dataset.agKey = block.key;
			overlay.dataset.align = block.align;
			overlay.setAttribute('aria-hidden', 'true');
			if (block.shifted) {
				for (const [paper, columns] of Object.entries(data.paper)) overlay.style.setProperty(`--ps-${paper}`, String(columns));
			}
			overlay.append(...plans.map((plan) => glyph(plan, block, host)));
			host.append(overlay);
			host.toggleAttribute('data-ag-live', true);
			added.push(overlay);
			hosts.push(host);
			const ink = block.scale === undefined ? null : host.closest<HTMLElement>('.button');
			if (ink && block.scale !== undefined) {
				ink.style.setProperty('--ag-scale', String(block.scale));
				ink.toggleAttribute('data-ag-ink', true);
				inks.push(ink);
			}
			if (block.follow) {
				const [scope, element, px] = block.follow;
				const follower = host.closest(scope)?.querySelector<HTMLElement>(element);
				if (follower) {
					follower.style.setProperty('--ag-follow', `${px}px`);
					follower.toggleAttribute('data-ag-follow', true);
					followers.push(follower);
				}
			}
		}
	}
	return {
		total,
		remove: () => {
			added.forEach((overlay) => overlay.remove());
			hosts.forEach((host) => host.removeAttribute('data-ag-live'));
			inks.forEach((ink) => {
				ink.removeAttribute('data-ag-ink');
				ink.style.removeProperty('--ag-scale');
			});
			followers.forEach((follower) => {
				follower.removeAttribute('data-ag-follow');
				follower.style.removeProperty('--ag-follow');
			});
		},
	};
}

const KIND_CLASS = { pair: 'p', out: 'o', in: 'n' } as const;

/**
 * A letter: its x on the outer box, its y on the middle one (two boxes, two curves: the arc), the hop
 * and the colour on the inner one, and a second copy of it in the accent whose opacity is the tint.
 */
function glyph(plan: GlyphPlan, block: Block, host: HTMLElement) {
	const outer = span(`g ${KIND_CLASS[plan.kind]} ${decorations(plan, block).join(' ')}${plan.char === ' ' ? ' sp' : ''}`);
	const style = [`--d:${plan.delay}ms`, `--e:${plan.delay + plan.duration}ms`];
	plan.variants.forEach((variant, v) => {
		for (const [name, value] of Object.entries(variant)) style.push(`--${name}${v}:${value}`);
	});
	outer.style.cssText = style.join(';');
	const content = () => {
		const unit = block.units?.[plan.char];
		const node = unit ? host.querySelector(unit)?.cloneNode(true) : undefined;
		// A space alone on its line gets no underline drawn: a slot's space is a letter of no ink (`.sp`),
		// one without a descender, so that the line is not broken under it.
		return node ?? document.createTextNode(plan.char === ' ' ? 'x' : plan.char);
	};
	const inner = span(`gi${block.units?.[plan.char] ? ' gu' : ''}`);
	inner.append(content());
	if (plan.kind === 'pair') {
		const tint = span('gt');
		tint.append(content());
		inner.append(tint);
	}
	const middle = span('gy');
	middle.append(inner);
	outer.append(middle);
	return outer;
}

/** The classes a letter's rest takes from each side: `us`/`ut` underlined, `cs`/`ct` the cursor, `m` the mark. */
function decorations(plan: GlyphPlan, block: Block) {
	const inRange = (ranges: Decoration[] | undefined, kind: Decoration[0], index: number | undefined) =>
		index !== undefined && (ranges ?? []).some(([k, start, end]) => k === kind && index >= start && index < end);
	const classes: string[] = [];
	const { from, to } = block.deco ?? {};
	if (inRange(from, 'u', plan.from)) classes.push('us');
	if (inRange(to, 'u', plan.to)) classes.push('ut');
	if (inRange(from, 'c', plan.from)) classes.push('cs');
	if (inRange(to, 'c', plan.to)) classes.push('ct');
	if (inRange(from, 'm', plan.from) || inRange(to, 'm', plan.to)) classes.push('m');
	return classes;
}

function span(className: string) {
	const element = document.createElement('span');
	element.className = className;
	return element;
}
