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

	test('the marquee and the title cursor stand still', async ({ page }) => {
		await page.goto('/');

		for (const element of await page.locator('.marquee-track, .cursor').all()) {
			await expect(element).toHaveCSS('animation-name', 'none');
		}
	});
});
