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

/** Where the name stands, where the meridian runs and where Besançon sits on it. */
function readMap(page: Page) {
	return page.evaluate(() => {
		// A zero-size inline box on the baseline of each line: its top is the baseline.
		const baselines = [...document.querySelectorAll('h1 [data-intro="line"]')].map((line) => {
			const probe = document.createElement('span');
			probe.style.cssText = 'display: inline-block; width: 0; height: 0; vertical-align: baseline';
			line.append(probe);
			const { top } = probe.getBoundingClientRect();
			probe.remove();
			return top;
		});
		const box = (selector: string) => {
			const found = document.querySelector(selector)?.getBoundingClientRect();
			if (!found) throw new Error(`${selector} missing`);
			return found;
		};
		const rule = box('.hero-rule');
		const point = box('.hero-point');
		return {
			baselines,
			rule: { left: rule.left, right: rule.right, top: rule.top },
			point: { x: point.left + point.width / 2, y: point.top + point.height / 2 },
		};
	});
}

for (const viewport of [...SCREENS, ...PHONES]) {
	test.describe(`${viewport.width} × ${viewport.height}`, () => {
		test.use({ viewport });

		test('the name stands on the meridian, which runs to the Besançon marker', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { baselines, rule, point } = await readMap(page);
			expect(baselines.length).toBe(2);
			// The last line of the name sits on the rule.
			expect(Math.abs(baselines[1] - rule.top)).toBeLessThanOrEqual(1.5);
			expect(Math.abs(point.x - rule.right)).toBeLessThanOrEqual(1);
			expect(Math.abs(point.y - (rule.top + 0.5))).toBeLessThanOrEqual(1);
			await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
			await expect(page.locator('.hero-point')).toBeInViewport({ ratio: 1 });
		});
	});
}

for (const viewport of SCREENS.filter(({ width }) => width > 860)) {
	test.describe(`${viewport.width} × ${viewport.height} desktop`, () => {
		test.use({ viewport });

		test('the header and the whole map fit on the first screen, the name on one line', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const mapBottom = await page.locator('.hero-map').evaluate((el) => el.getBoundingClientRect().bottom);
			expect(mapBottom).toBeLessThanOrEqual((await statuslineTop(page)) + 1);
			const { baselines } = await readMap(page);
			expect(Math.abs(baselines[0] - baselines[1])).toBeLessThanOrEqual(1);
		});
	});
}

for (const viewport of [...SCREENS.filter(({ width }) => width <= 860), ...PHONES]) {
	test.describe(`${viewport.width} × ${viewport.height} narrow`, () => {
		test.use({ viewport });

		test('the name breaks onto two lines and the lede is on the first screen', async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			const { baselines } = await readMap(page);
			expect(baselines[1] - baselines[0]).toBeGreaterThan(20);
			await expect(page.locator('.hero-lede .sentence')).toBeInViewport({ ratio: 1 });
		});
	});
}

test('the Besançon marker is in the signal colour, still', async ({ page }) => {
	await page.goto('/');

	const point = page.locator('.hero-point');
	await expect(point).toHaveCSS('background-color', 'rgb(255, 91, 20)');
	await expect(point).toHaveCSS('animation-name', 'none');
	await expect(page.locator('.hero-place')).toContainText('47°14′16″ N · 6°01′27″ E');
});
