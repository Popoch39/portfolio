import { expect, test } from './fixtures';
import { scrolledToBottom, statusline, topOnceStill } from './helpers';

// From the small phone to the 1440p screen, through the grid breakpoints.
const WIDTHS = [320, 375, 414, 600, 768, 860, 861, 1024, 1100, 1280, 1440, 1920, 2560];

for (const width of WIDTHS) {
	test.describe(`${width} px wide window`, () => {
		test.use({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });

		test('nothing overflows horizontally, the name fits in the window', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { horizontalOverflow, titleRight } = await page.evaluate(() => ({
				horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
				titleRight: Math.max(
					...[...document.querySelectorAll('h1 > *')].map((line) => line.getBoundingClientRect().right),
				),
			}));
			expect(horizontalOverflow).toBeLessThanOrEqual(0);
			expect(titleRight).toBeLessThanOrEqual(width);
		});

		test('no grid cell spills out of its section', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			// Inside the centred column, between its gutters. Project rows bleed 14px on purpose (hover
			// background), and the marquee, outside the column, runs wider than the window, clipped by its band.
			// The hero's night (ADR 0008) reaches map widths either side of its line, clipped by the map.
			const spills = await page.evaluate(() => {
				const column = document.querySelector('main .wrap');
				if (!column) return ['no .wrap'];
				const box = column.getBoundingClientRect();
				const gutter = Number.parseFloat(getComputedStyle(column).paddingLeft);
				const [left, right] = [box.left + gutter, box.right - gutter];
				return [...document.querySelectorAll('main .wrap *')]
					.filter((el) => !el.matches('.project, .visually-hidden') && !el.closest('.sky'))
					.filter((el) => {
						const box = el.getBoundingClientRect();
						return box.width > 0 && (box.left < left - 1 || box.right > right + 1);
					})
					.map((el) => `${el.tagName}.${el.className}`);
			});
			expect(spills).toEqual([]);
		});

		test('the statusline stays at the bottom of the window without hiding the end of the page', async ({
			page,
		}) => {
			await page.goto('/');
			const bar = statusline(page);
			await expect(bar).toBeInViewport({ ratio: 1 });

			await page.keyboard.press('End');
			await scrolledToBottom(page);

			const lastLink = page.locator('#contact').getByRole('link').last();
			await topOnceStill(lastLink);
			const linkBottom = await lastLink.evaluate((el) => el.getBoundingClientRect().bottom);
			const box = await bar.boundingBox();
			expect(box?.y).toBeGreaterThanOrEqual(linkBottom);
			expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(800, 0);
		});
	});
}

test.describe('navigation on a phone', () => {
	test.use({ viewport: { width: 375, height: 700 } });

	test('the section links stay visible and big enough for a finger', async ({ page }) => {
		await page.goto('/');

		const links = page.getByRole('navigation', { name: 'Sections' }).getByRole('link');
		await expect(links).toHaveCount(3);
		for (const link of await links.all()) {
			await expect(link).toBeInViewport();
			const box = await link.boundingBox();
			expect(box?.height).toBeGreaterThanOrEqual(24);
		}
	});
});
