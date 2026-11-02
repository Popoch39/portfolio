import { expect, test } from '@playwright/test';
import { contenu, transformationCalculee } from './outils';

test.describe('sans JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('tout le contenu est visible, à son état final', async ({ page }) => {
		await page.goto('/');

		const elements = contenu(page).locator('h1, h2, h3, h4, p, a, img, li, figure, section');
		expect(await elements.count()).toBeGreaterThan(0);
		for (const element of await elements.all()) {
			await expect(element).toBeVisible();
			await expect(element).toHaveCSS('opacity', '1');
		}
		expect(await transformationCalculee(contenu(page))).toBe('none');
	});
});
