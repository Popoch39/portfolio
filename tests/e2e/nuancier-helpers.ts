import type { Page } from './fixtures';

/** The Nuancier's papers, back to front as the book rests by default. */
export const papers = [
	'light',
	'dark',
	'solarized-light',
	'nord',
	'gruvbox-light',
	'catppuccin-mocha',
	'tokyo-night',
	'auto',
] as const;
export type Paper = (typeof papers)[number];

/** The slot of the strip at the front of the book. */
export const FRONT = '7';

const names: Record<Paper, RegExp> = {
	light: /^Jour/,
	dark: /^Nuit/,
	'solarized-light': /^Solarized Light/,
	nord: /^Nord/,
	'gruvbox-light': /^Gruvbox Light/,
	'catppuccin-mocha': /^Catppuccin Mocha/,
	'tokyo-night': /^Tokyo Night/,
	auto: /^Auto/,
};

/** A paper of the Nuancier, by the name a screen reader gives it. */
export const paper = (page: Page, name: Paper) => page.getByRole('radio', { name: names[name] });

/** Still: no strip moving, none shown off, the book not shut (the choreography pauses between its steps). */
const still = (page: Page) =>
	page.waitForFunction(() => {
		const fan = document.querySelector<HTMLElement>('[data-nuancier]');
		return (
			!!fan && fan.getAnimations({ subtree: true }).length === 0 && !fan.dataset.phase && !fan.querySelector('[data-launch]')
		);
	});

/**
 * Where a visitor would aim at the strip: the middle of what shows of it, not covered by the others.
 * The strips overlap, and only their heads and spines show. Searched once the fan is still.
 */
export async function visiblePoint(page: Page, name: Paper) {
	await still(page);
	const point = await page.locator(`[data-nuancier] input[value="${name}"]`).evaluate((input) => {
		const strip = input.closest('label')!;
		const { left, top, width, height } = strip.getBoundingClientRect();
		const shown: { x: number; y: number }[] = [];
		for (let y = 0.025; y < 1; y += 0.05) {
			for (let x = 0.025; x < 1; x += 0.05) {
				const at = { x: left + width * x, y: top + height * y };
				if (strip.contains(document.elementFromPoint(at.x, at.y))) shown.push(at);
			}
		}
		if (shown.length === 0) return null;
		const mean = shown.reduce((sum, at) => ({ x: sum.x + at.x / shown.length, y: sum.y + at.y / shown.length }), { x: 0, y: 0 });
		const distance = (at: { x: number; y: number }) => Math.hypot(at.x - mean.x, at.y - mean.y);
		return shown.reduce((best, at) => (distance(at) < distance(best) ? at : best));
	});
	if (!point) throw new Error(`no part of the ${name} strip shows`);
	return point;
}

/**
 * Picks a paper as a visitor does with a mouse: over the book first, which opens it, then a click on
 * what shows of the strip.
 */
export async function pickPaper(page: Page, name: Paper) {
	const over = await visiblePoint(page, await front(page));
	await page.mouse.move(over.x, over.y);
	await opened(page);
	const { x, y } = await visiblePoint(page, name);
	await page.mouse.click(x, y);
}

/** Opens the shut book as a finger does: a tap on the paper in force, the one strip that shows. */
export async function openByTap(page: Page) {
	const { x, y } = await visiblePoint(page, await front(page));
	await page.touchscreen.tap(x, y);
	await opened(page);
}

/** The book open: every strip shows, as a visitor waits for it before aiming at one. */
const opened = (page: Page) =>
	page.waitForFunction(() =>
		[...document.querySelectorAll('[data-nuancier] .slot')].every((slot) => getComputedStyle(slot).opacity === '1'),
	);

/** The paper at the front, once the last pick has put its strip there. */
async function front(page: Page) {
	await still(page);
	return page.locator(`[data-nuancier] [data-slot="${FRONT}"] input`).evaluate((input) => (input as HTMLInputElement).value as Paper);
}
