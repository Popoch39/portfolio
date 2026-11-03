import { expect, test } from './fixtures';

// Decorative and hidden from assistive technologies: targeted by its id, like the statusline.
const grain = (page: import('@playwright/test').Page) => page.locator('#grain');

test.describe('paper grain', () => {
	for (const path of ['/', '/this-page-does-not-exist/']) {
		test(`lies over the whole window on ${path}`, async ({ page }) => {
			await page.goto(path);

			await expect(grain(page)).toBeVisible();
			await expect(grain(page)).toHaveAttribute('aria-hidden', 'true');
			const size = page.viewportSize();
			expect(await grain(page).boundingBox()).toEqual({ x: 0, y: 0, width: size?.width, height: size?.height });
		});
	}

	test('never stands in the way of a click', async ({ page }) => {
		await page.goto('/');
		const link = page.getByRole('link').first();

		await link.click({ trial: true });
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('is there too', async ({ page }) => {
			await page.goto('/');

			await expect(grain(page)).toBeVisible();
		});
	});
});
