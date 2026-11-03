import { devices, expect, test } from './fixtures';
import { expectNativeScrolling, scrollPosition, swipeUp } from './helpers';

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
});
