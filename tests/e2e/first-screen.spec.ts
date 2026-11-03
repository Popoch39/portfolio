import { expect, test } from './fixtures';
import { statuslineTop } from './helpers';

// Laptops and desktops, the first desktop width and a tablet. A phone held upright gives the name
// the column's width instead and lets the rest of the hero run past the first screen (below).
const SCREENS = [
	{ width: 1280, height: 720 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 1100, height: 800 },
	{ width: 861, height: 700 },
	{ width: 768, height: 1024 },
];

// A small phone and a common one, held upright.
const PHONES = [
	{ width: 360, height: 640 },
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

for (const viewport of PHONES) {
	test.describe(`${viewport.width} × ${viewport.height} phone`, () => {
		test.use({ viewport });

		test('each line of the name spans the column, on the first screen', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { column, lines } = await page.evaluate(() => {
				const range = document.createRange();
				const hero = document.querySelector('.hero')?.getBoundingClientRect();
				return {
					column: { left: hero?.left ?? 0, right: hero?.right ?? 0 },
					lines: [...document.querySelectorAll('h1 [data-intro="line"]')].map((line) => {
						range.selectNodeContents(line);
						const box = range.getBoundingClientRect();
						return { left: box.left, right: box.right };
					}),
				};
			});
			expect(lines).toHaveLength(2);
			for (const line of lines) {
				expect(line.left).toBeGreaterThanOrEqual(column.left - 8);
				expect(line.right).toBeLessThanOrEqual(column.right + 1);
				// Within a twentieth of the column's width from its right edge.
				expect(line.right).toBeGreaterThan(column.right - (column.right - column.left) / 20);
			}
			await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
		});
	});
}

test("the title's signal caret stays, still", async ({ page }) => {
	await page.goto('/');

	const caret = page.locator('h1 .cursor');
	await expect(caret).toHaveCSS('background-color', 'rgb(255, 91, 20)');
	await expect(caret).toHaveCSS('animation-name', 'none');
});
