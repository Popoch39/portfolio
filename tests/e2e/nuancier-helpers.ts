import type { Page } from './fixtures';

export type Paper = 'light' | 'dark' | 'cyan' | 'auto';

const names: Record<Paper, RegExp> = { light: /^Jour/, dark: /^Nuit/, cyan: /^Cyanotype/, auto: /^Auto/ };

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
	const front = await page
		.locator('[data-nuancier] [data-slot="3"] input')
		.evaluate((input) => (input as HTMLInputElement).value as Paper);
	const over = await visiblePoint(page, front);
	await page.mouse.move(over.x, over.y);
	const { x, y } = await visiblePoint(page, name);
	await page.mouse.click(x, y);
}
