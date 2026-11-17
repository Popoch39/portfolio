import type { Locator, Page } from './fixtures';

/**
 * Nothing can be heard in a test: the sounds the page starts are counted by watching the Web Audio
 * sources it starts, from an init script that runs before the page's own.
 */
export async function listen(page: Page) {
	await page.addInitScript(() => {
		const played: number[] = [];
		Object.assign(window, { played });
		const start = AudioBufferSourceNode.prototype.start;
		AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
			played.push(performance.now());
			return start.apply(this, args);
		};
	});
}

/** When each sound the page has started since it loaded was started (ms, page clock). */
export const playedAt = (page: Page) => page.evaluate(() => (window as unknown as { played: number[] }).played);

/** How many sounds the page has started since it loaded. */
export const heard = async (page: Page) => (await playedAt(page)).length;

/** A visitor who left the Son on at the last visit. */
export const leftOn = (page: Page) => page.addInitScript(() => localStorage.setItem('son', 'on'));

export const sound = (page: Page) => page.getByRole('button', { name: 'Son' });

/** A key of the Établi, the movable part of its cap. */
export const key = (page: Page, index: number) => page.locator('[data-bench] .k').nth(index);

/** How far the key's cap has gone down, in the drawing's px. */
export const travel = (cap: Locator) =>
	cap.evaluate((element) => {
		const transform = getComputedStyle(element).transform;
		return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
	});

/** The middle of a key's top face, where a pointer presses it. */
export async function topOf(cap: Locator) {
	const face = cap.locator('path').first();
	const box = await face.boundingBox();
	if (!box) throw new Error('the key is not on screen');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
