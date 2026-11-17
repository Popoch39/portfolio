import { heard, key, listen, sound, topOf, travel } from './etabli-sound-helpers';
import { devices, expect, test, type Page } from './fixtures';
import { scrollPosition, swipe } from './helpers';

// Chromium project only (see playwright.config.ts): Firefox does not emulate `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

/** Touches a point of the window and keeps the finger there. */
async function touchDown(page: Page, at: { x: number; y: number }) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
	return async () => {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await cdp.detach();
	};
}

test.describe('the Frappe, under a finger', () => {
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true });

	test.beforeEach(async ({ page }) => {
		await listen(page);
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
	});

	test('a key bottoms out under the finger, and comes back up when it lifts', async ({ page }) => {
		const cap = key(page, 20);

		const lift = await touchDown(page, await topOf(cap));
		await expect.poll(() => travel(cap)).toBeCloseTo(5, 1);
		await lift();
		await expect.poll(() => travel(cap)).toBe(0);
	});

	test('the Son on, a tap is heard once the finger is up: the press, then the release', async ({ page }) => {
		await sound(page).tap();
		await expect.poll(() => heard(page)).toBe(1);
		const at = await topOf(key(page, 20));

		const lift = await touchDown(page, at);
		await page.waitForTimeout(100);
		expect(await heard(page)).toBe(1);
		await lift();

		await expect.poll(() => heard(page)).toBe(3);
	});

	test('a finger that scrolls the page from a key presses nothing, and is not heard', async ({ page }) => {
		await sound(page).tap();
		await expect.poll(() => heard(page)).toBe(1);
		const cap = key(page, 20);

		await swipe(page, await topOf(cap), { x: 0, y: -300 });

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expect.poll(() => travel(cap)).toBe(0);
		expect(await heard(page)).toBe(1);
	});
});
