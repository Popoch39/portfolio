import { expect, test } from './fixtures';
import { computedTransform, content } from './helpers';

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('all the content is visible, at its final state', async ({ page }) => {
		await page.goto('/');

		// The hero's night (ADR 0008) is a drawing over the content, aria-hidden: without JavaScript, there is none.
		const elements = content(page).locator(
			':is(h1, h2, h3, h4, p, a, img, li, figure, section):not(.sky *)',
		);
		expect(await elements.count()).toBeGreaterThan(0);
		for (const element of await elements.all()) {
			await expect(element).toBeVisible();
			await expect(element).toHaveCSS('opacity', '1');
		}
		expect(await computedTransform(content(page))).toBe('none');
	});
});
