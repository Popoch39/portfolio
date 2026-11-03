// Not `./fixtures`: these visits are direct, without a referrer from the site.
import { expect, test, type Page } from '@playwright/test';
import { scrollPosition, scrollWithWheel, statusline } from './helpers';

// Decorative and hidden from assistive technologies: targeted by its id, like the statusline.
const veil = (page: Page) => page.locator('#veil');
// The globe, then the blue grid it becomes, drawn over the page.
const grid = (page: Page) => page.locator('#intro-grid');

// The elements the Intro reveals, as a visitor sees them on the page.
const revealed = (page: Page) => [
	page.getByRole('banner').getByRole('link').first(),
	page.locator('h1'),
	page.locator('h1 > *'),
	page.locator('h1 > * > *'),
	page.locator('.hero-lede'),
	page.locator('.hero-facts'),
	page.locator('.hero-actions'),
	statusline(page),
];

/** Every revealed element at rest: fully opaque, without a transform. */
async function expectFinalState(page: Page) {
	for (const group of revealed(page)) {
		for (const element of await group.all()) {
			await expect(element).toHaveCSS('opacity', '1');
			await expect(element).toHaveCSS('transform', 'none');
		}
	}
}

/** Loads the home page as a direct visit (no referrer, no anchor), on a clock the test drives. */
async function visitHome(page: Page, path = '/') {
	await page.clock.install();
	await page.goto(path);
}

test.describe('Intro, motion allowed', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('plays on loading the home page, then the veil gives way to the final state', async ({ page }) => {
		await visitHome(page);
		await expect(veil(page)).toBeVisible();

		await page.clock.runFor(6_000);
		await expect(veil(page)).toBeVisible();

		await page.clock.runFor(4_000);
		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
	});

	test('the grid stays over the page once the veil has lifted, then goes with the Intro', async ({ page }) => {
		await visitHome(page);
		await expect(grid(page)).toBeVisible();

		await page.clock.runFor(7_500);
		await expect(veil(page)).toBeHidden();
		await expect(grid(page)).toBeVisible();

		await page.clock.runFor(2_500);
		await expect(grid(page)).toBeHidden();
	});

	const gestures: [string, (page: Page) => Promise<void>][] = [
		['a key', (page) => page.keyboard.press('a')],
		['a click', (page) => page.mouse.click(400, 300)],
		['the wheel', (page) => scrollWithWheel(page, 300)],
	];
	for (const [name, gesture] of gestures) {
		test(`${name} skips it to the final state in a short fade`, async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(2_000);

			await gesture(page);
			await page.clock.runFor(400);

			await expect(veil(page)).toBeHidden();
			await expect(grid(page)).toBeHidden();
			await expectFinalState(page);
		});
	}

	test('Tab skips it and puts the focus on the first link', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(2_000);

		await page.keyboard.press('Tab');
		await page.clock.runFor(400);

		await expect(veil(page)).toBeHidden();
		await expect(page.getByRole('link').first()).toBeFocused();
	});

	test('scrolling is blocked during the Intro, then given back', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(2_000);

		// The gesture that skips the Intro does not scroll the page.
		await scrollWithWheel(page, 600);
		await page.clock.runFor(400);
		expect(await scrollPosition(page)).toBe(0);

		await scrollWithWheel(page, 600);
		await page.clock.runFor(1_000);
		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
	});

	test('the title is painted at its final state from the first paint, under the veil', async ({ page }) => {
		await visitHome(page);
		await expect(veil(page)).toBeVisible();

		await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
		for (const line of await page.locator('h1 > * > *').all()) {
			await expect(line).toHaveCSS('opacity', '1');
			await expect(line).toHaveCSS('transform', 'none');
		}
	});

	test('nothing moves in the layout when the veil gives way', async ({ page }) => {
		const boxes = () =>
			Promise.all([page.locator('h1'), page.locator('.hero-grid'), statusline(page)].map((l) => l.boundingBox()));
		await visitHome(page);
		await page.evaluate(() => document.fonts.ready);
		const underVeil = await boxes();

		await page.clock.runFor(10_000);

		await expect(veil(page)).toBeHidden();
		expect(await boxes()).toEqual(underVeil);
	});

	test('flipping to reduced motion during the Intro brings the page back to its final state', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(7_000);

		await page.emulateMedia({ reducedMotion: 'reduce' });

		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
	});

	test('does not play with an anchor in the URL', async ({ page }) => {
		await visitHome(page, '/#projets');

		await expect(veil(page)).toBeHidden();
	});

	test('does not play when arriving from another page of the site', async ({ page }) => {
		await page.clock.install();
		await page.goto('/this-page-does-not-exist/');

		await page.getByRole('link', { name: 'Retour à l’accueil' }).click();

		await expect(page).toHaveURL('/');
		await expect(veil(page)).toBeHidden();
	});

	// On the real clock: Playwright's fake one empties `performance.getEntriesByType('navigation')`,
	// where a history navigation shows.
	test('does not play again when coming back through history', async ({ page }) => {
		await page.goto('/');
		await expect(veil(page)).toBeVisible();
		await page.keyboard.press('a');
		await expect(veil(page)).toBeHidden();
		await page.goto('about:blank');

		await page.goBack();

		await expect(page).toHaveURL('/');
		await expect(veil(page)).toBeHidden();
	});
});

test.describe('Intro, reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('does not play: the page is at its final state', async ({ page }) => {
		await visitHome(page);

		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
	});
});

test.describe('Intro, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('no veil: the page is at its final state', async ({ page }) => {
		// `page.clock` and `page.evaluate` need JavaScript: a plain visit.
		await page.goto('/');

		await expect(veil(page)).toBeHidden();
		await expect(page.locator('h1')).toBeVisible();
	});
});
