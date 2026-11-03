import { expect, test } from './fixtures';

// From the first desktop width to past the page's max width, where the grid is centred.
const VIEWPORTS = [
	{ width: 861, height: 800 },
	{ width: 1280, height: 800 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
];

for (const viewport of VIEWPORTS) {
	test.describe(`${viewport.width} × ${viewport.height}`, () => {
		test.use({ viewport });

		test('the block cursor of the title fills the twelfth column of the grid', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { cursor, column } = await page.evaluate(() => {
				const grid = document.querySelector('.hero-grid');
				const cursor = document.querySelector('h1 .cursor');
				if (!grid || !cursor) throw new Error('hero grid or cursor missing');
				const box = grid.getBoundingClientRect();
				const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
				const width = (box.width - 11 * gap) / 12;
				const { left, right } = cursor.getBoundingClientRect();
				return { cursor: { left, right }, column: { left: box.right - width, right: box.right } };
			});
			expect(Math.abs(cursor.left - column.left)).toBeLessThanOrEqual(0.5);
			expect(Math.abs(cursor.right - column.right)).toBeLessThanOrEqual(0.5);
		});
	});
}
