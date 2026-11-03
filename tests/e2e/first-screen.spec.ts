import { expect, test } from './fixtures';
import { statuslineTop } from './helpers';

// Laptops and desktops, the first desktop width, a tablet and a phone held upright.
const SCREENS = [
	{ width: 1280, height: 720 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 1100, height: 800 },
	{ width: 861, height: 700 },
	{ width: 768, height: 1024 },
	{ width: 390, height: 844 },
];

for (const viewport of SCREENS) {
	test.describe(`${viewport.width} × ${viewport.height}`, () => {
		test.use({ viewport });

		test('the header and the whole hero fit on the first screen, above the statusline', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const heroBottom = await page.locator('.hero-grid').evaluate((el) => el.getBoundingClientRect().bottom);
			expect(heroBottom).toBeLessThanOrEqual((await statuslineTop(page)) + 1);
			await expect(page.locator('h1 .cursor')).toBeInViewport({ ratio: 1 });
		});
	});
}

test("the title's blue caret stays, still", async ({ page }) => {
	await page.goto('/');

	const caret = page.locator('h1 .cursor');
	await expect(caret).toHaveCSS('background-color', 'rgb(36, 51, 255)');
	await expect(caret).toHaveCSS('animation-name', 'none');
});
