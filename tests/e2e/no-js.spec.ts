import { expect, test } from '@playwright/test';
import { computedTransform, content } from './helpers';

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('all the content is visible, at its final state', async ({ page }) => {
		await page.goto('/');

		const elements = content(page).locator('h1, h2, h3, h4, p, a, img, li, figure, section');
		expect(await elements.count()).toBeGreaterThan(0);
		for (const element of await elements.all()) {
			await expect(element).toBeVisible();
			await expect(element).toHaveCSS('opacity', '1');
		}
		expect(await computedTransform(content(page))).toBe('none');
	});
});
