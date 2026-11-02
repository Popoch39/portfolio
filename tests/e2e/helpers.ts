import { expect, type Locator, type Page } from '@playwright/test';

export const wrapper = (page: Page) => page.locator('#smooth-wrapper');
export const content = (page: Page) => page.locator('#smooth-content');
export const header = (page: Page) => page.getByRole('banner');
// Decorative, hence hidden from assistive technologies: targeted by its id.
export const statusline = (page: Page) => page.locator('#statusline');

export const scrollPosition = (page: Page) => page.evaluate(() => scrollY);

/** Vertical offset (px) that the computed transform imposes on the element, 0 without a transform. */
export function verticalTranslation(element: Locator): Promise<number> {
	return element.evaluate((el) => {
		const transform = getComputedStyle(el).transform;
		return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
	});
}

export function computedTransform(element: Locator): Promise<string> {
	return element.evaluate((el) => getComputedStyle(el).transform);
}

/** The wrapped content follows the scroll through a transform: smoothing is at work. */
export async function expectSmoothScrolling(page: Page) {
	await expect.poll(() => verticalTranslation(content(page))).toBeLessThan(0);
}

/** Neither a transform nor a fixed wrapper: the content moves up as much as the page has scrolled. */
export async function expectNativeScrolling(page: Page) {
	await expect.poll(() => computedTransform(content(page))).toBe('none');
	await expect(wrapper(page)).not.toHaveCSS('position', 'fixed');
	const { top, scrolled } = await content(page).evaluate((el) => ({
		top: el.getBoundingClientRect().top,
		scrolled: scrollY,
	}));
	expect(top).toBeCloseTo(-scrolled, 0);
}

/** The document has scrolled all the way down. */
export async function scrolledToBottom(page: Page) {
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY))
		.toBeLessThan(1);
}

/**
 * Top of the element in the window once scrolling has stopped (smoothed or not):
 * still for ten frames in a row.
 */
export function topOnceStill(element: Locator): Promise<number> {
	return element.evaluate(
		(el) =>
			new Promise<number>((resolve) => {
				let previous = Number.NaN;
				let stillFrames = 0;
				const measure = () => {
					const top = el.getBoundingClientRect().top;
					stillFrames = Math.abs(top - previous) < 0.5 ? stillFrames + 1 : 0;
					previous = top;
					if (stillFrames >= 10) resolve(top);
					else requestAnimationFrame(measure);
				};
				requestAnimationFrame(measure);
			}),
	);
}

/** Top of the fixed statusline: whatever goes under it is hidden. */
export async function statuslineTop(page: Page) {
	const box = await statusline(page).boundingBox();
	if (!box) throw new Error('statusline missing');
	return box.y;
}

/** The element stops at the top of the window: no fixed bar covers the top. */
export async function expectAtTopOfWindow(element: Locator) {
	await expect.poll(async () => Math.abs(await topOnceStill(element))).toBeLessThanOrEqual(1);
}

/** The element stops fully visible, between the top of the window and the fixed statusline. */
export async function expectVisibleAboveStatusline(page: Page, element: Locator) {
	const limit = await statuslineTop(page);
	await expect
		.poll(async () => {
			const top = await topOnceStill(element);
			const bottom = await element.evaluate((el) => el.getBoundingClientRect().bottom);
			return top >= -1 && bottom <= limit + 1;
		})
		.toBe(true);
}

/** Position of the element in the page, without transforms (neither smoothing nor scene). */
export function topInPage(element: Locator): Promise<number> {
	return element.evaluate((el) => {
		let top = 0;
		for (let n: Element | null = el; n instanceof HTMLElement; n = n.offsetParent) {
			top += n.offsetTop;
		}
		return top;
	});
}

/**
 * Gives the page more room to scroll. Waits until the document has become scrollable, smoother
 * included (it recomputes the body height).
 */
export async function lengthenPage(page: Page) {
	await content(page).evaluate((el) => {
		const block = document.createElement('div');
		block.dataset.testLengthen = '';
		block.style.height = '300vh';
		el.append(block);
	});
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
		.toBeGreaterThan(1000);
}

/**
 * Swipes a finger up in the middle of the window (Chromium only, `hasTouch` context).
 * `Input.synthesizeScrollGesture` does not scroll the headless shell: touch events are replayed instead.
 */
export async function swipeUp(page: Page, distance: number) {
	const size = page.viewportSize();
	if (!size) throw new Error('swipeUp: window without a size');
	const x = size.width / 2;
	const start = size.height * 0.8;
	const steps = 10;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
	for (let i = 1; i <= steps; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x, y: start - (distance * i) / steps }],
		});
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

export async function scrollWithWheel(page: Page, deltaY: number) {
	const size = page.viewportSize();
	// The wheel acts under the pointer: in the middle, it is neither over the statusline nor outside the page.
	if (size) await page.mouse.move(size.width / 2, size.height / 2);
	await page.mouse.wheel(0, deltaY);
}
