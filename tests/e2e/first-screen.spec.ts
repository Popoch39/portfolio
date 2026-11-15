import { expect, test, type Page } from './fixtures';
import { statuslineTop } from './helpers';

// Laptops and desktops, the first desktop width, a tablet held upright.
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

const bench = (page: Page) => page.locator('[data-bench]');

/** Bottom of each of the name's two lines, then the boxes of the text column and of the bench. */
function readHero(page: Page) {
	return page.evaluate(() => {
		const box = (selector: string) => {
			const found = document.querySelector(selector)?.getBoundingClientRect();
			if (!found) throw new Error(`${selector} missing`);
			return { left: found.left, right: found.right, top: found.top, bottom: found.bottom };
		};
		return {
			lines: [...document.querySelectorAll('h1 .hero-line')].map((line) => line.getBoundingClientRect().bottom),
			text: box('.hero-text'),
			actions: box('.hero-actions'),
			bench: box('[data-bench]'),
		};
	});
}

for (const viewport of [...SCREENS, ...PHONES]) {
	test.describe(`${viewport.width} × ${viewport.height}`, () => {
		test.use({ viewport });

		test('the name stands on two lines, whole on the first screen', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { lines } = await readHero(page);
			expect(lines).toHaveLength(2);
			expect(lines[1] - lines[0]).toBeGreaterThan(20);
			await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
		});
	});
}

for (const viewport of SCREENS.filter(({ width }) => width > 860)) {
	test.describe(`${viewport.width} × ${viewport.height} desktop`, () => {
		test.use({ viewport });

		test('the text on the left and the Établi on the right both fit on the first screen', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { text, actions, bench } = await readHero(page);
			expect(bench.left).toBeGreaterThanOrEqual(text.right);
			const floor = (await statuslineTop(page)) + 1;
			expect(actions.bottom).toBeLessThanOrEqual(floor);
			expect(bench.bottom).toBeLessThanOrEqual(floor);
		});
	});
}

for (const viewport of [...SCREENS.filter(({ width }) => width <= 860), ...PHONES]) {
	test.describe(`${viewport.width} × ${viewport.height} narrow`, () => {
		test.use({ viewport });

		test('the lede is on the first screen, and the Établi stands under the text', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			await expect(page.locator('[data-lede] .sentence')).toBeInViewport({ ratio: 1 });
			const { text, bench } = await readHero(page);
			expect(bench.top).toBeGreaterThanOrEqual(text.bottom);
		});
	});
}

test('Besançon’s mark is in the signal colour, still, with its coordinates', async ({ page }) => {
	await page.goto('/');

	const pin = page.locator('.hero-pin');
	await expect(pin).toHaveCSS('color', 'rgb(255, 91, 20)');
	await expect(page.locator('.hero-mark')).toHaveCSS('animation-name', 'none');
	await expect(page.locator('.hero-mark')).toContainText('Besançon');
	await expect(page.locator('.hero-mark')).toContainText('47°14′16″ N · 6°01′27″ E');
	await expect(bench(page)).toHaveAttribute('role', 'img');
});
