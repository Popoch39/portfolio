import { devices, expect, test, type Page } from './fixtures';
import { friseSection } from './frise-helpers';
import { expectNativeScrolling, scrollPosition, swipeUp, topInPage, topOnceStill, verticalTranslation } from './helpers';

// Chromium project only (see playwright.config.ts): Firefox does not emulate `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

test.describe('under a finger', () => {
	test.use({
		viewport,
		userAgent,
		deviceScaleFactor,
		hasTouch: true,
		isMobile: true,
		reducedMotion: 'no-preference',
	});

	test('no smoothing: the page scrolls natively under the finger', async ({ page }) => {
		await page.goto('/');

		await swipeUp(page, 400);

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expectNativeScrolling(page);
	});

	// Pinned by a transform, the section is moved by script a frame behind the compositor's scroll:
	// on iOS it jumps into place and the fling dies at the start of every pinned scene.
	for (const [scene, section] of [
		['Frise', friseSection],
		['Atome', (page: Page) => page.locator('section:has([data-atome])')],
	] as const) {
		test(`${scene}: the browser holds the pinned section in place, not a script`, async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const pinned = section(page);
			const start = await topInPage(pinned);

			for (const screens of [1, 2]) {
				await page.evaluate(([top, at]) => scrollTo(0, top + at * innerHeight), [start, screens]);
				await topOnceStill(pinned);

				await expect(pinned).toHaveCSS('position', 'fixed');
				expect(await verticalTranslation(pinned)).toBe(0);
			}
		});
	}
});
