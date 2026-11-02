import { expect, test } from '@playwright/test';
import { computedTransform, content, expectSmoothScrolling, scrollPosition, scrollWithWheel, wrapper } from './helpers';

test.describe('smoothed scrolling, motion allowed', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('with the wheel, the wrapped content follows the scroll through a transform', async ({ page }) => {
		await page.goto('/');

		await scrollWithWheel(page, 600);

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expectSmoothScrolling(page);
	});

	test('flipping the preference during the visit stops then restarts smoothed scrolling', async ({ page }) => {
		await page.goto('/');
		await expect(wrapper(page)).toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect.poll(() => computedTransform(content(page))).toBe('none');
		await expect(wrapper(page)).not.toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await scrollWithWheel(page, 600);
		await expectSmoothScrolling(page);
	});
});
