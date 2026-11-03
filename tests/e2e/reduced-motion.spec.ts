import { expect, test } from './fixtures';
import { expectNativeScrolling, scrollPosition, scrollWithWheel } from './helpers';

test.describe('reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('no smoothed scrolling: the content scrolls natively, without a transform', async ({ page }) => {
		await page.goto('/');

		await scrollWithWheel(page, 600);

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expectNativeScrolling(page);
	});

	test('the marquee stands still', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.marquee-track')).toHaveCSS('animation-name', 'none');
	});
});
