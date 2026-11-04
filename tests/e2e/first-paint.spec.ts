import { expect, test, type Page } from './fixtures';
import { statusline, wrapper } from './helpers';

// The smoother fixes the wrapper and transforms the content: an element positioned against the
// window would then change containing block and jump when smoothing starts (layout shift).
const boxes = (page: Page) =>
	Promise.all([page.locator('h1'), page.locator('.hero-lede'), statusline(page)].map((l) => l.boundingBox()));

test.describe('first paint', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the hero and the statusline keep their place when smoothed scrolling starts', async ({ page }) => {
		await page.goto('/');
		await expect(wrapper(page)).not.toHaveCSS('position', 'fixed');
		await page.evaluate(() => document.fonts.ready);
		const withoutSmoothing = await boxes(page);
		await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(wrapper(page)).toHaveCSS('position', 'fixed');

		expect(await boxes(page)).toEqual(withoutSmoothing);
	});
});
