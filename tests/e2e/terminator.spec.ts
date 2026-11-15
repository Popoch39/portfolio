import { expect, test, type Page } from './fixtures';
import { paper as option, pickPaper } from './nuancier-helpers';

/**
 * The sun over Besançon (ADR 0008): the whole site follows it, dark from sunset to sunrise on Auto, and
 * the Nuancier forces the day or the night at any hour. The hero has no night of its own any more
 * (ADR 0012): it takes the page's paper.
 * On 9 November 2026 the sun rises at about 07:30 and sets at about 17:10, Paris time.
 */

const at = (time: string) => new Date(`2026-11-09T${time}:00+01:00`);

const root = (page: Page) => page.locator('html');

async function visitAt(page: Page, time: string) {
	await page.clock.setFixedTime(at(time));
	await page.goto('/');
}

test.describe('the sun over Besançon', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('at noon, the site is in daylight', async ({ page }) => {
		await visitAt(page, '12:00');

		await expect(root(page)).toHaveAttribute('data-theme', 'light');
		await expect(root(page)).toHaveAttribute('data-sky', 'day');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(239, 238, 233)');
	});

	test('at night, the whole site is dark, the hero with it', async ({ page }) => {
		await visitAt(page, '23:00');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 20, 18)');
		await expect(page.locator('h1')).toHaveCSS('color', 'rgb(239, 238, 233)');
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141412');
	});

	test('half an hour after sunset, the site has gone dark', async ({ page }) => {
		await visitAt(page, '17:40');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
	});

	test('the statusline gives the day’s sunrise and sunset at Besançon', async ({ page }) => {
		await visitAt(page, '12:00');

		const times = await page
			.locator('#statusline [data-sun]')
			.evaluateAll((spans) => spans.map((span) => getComputedStyle(span, '::after').content));
		expect(times).toEqual([expect.stringMatching(/^"07:[23]\d"$/), expect.stringMatching(/^"17:[01]\d"$/)]);
	});

	test('the hero is drawn once: one name and one « Écrire » for the keyboard and screen readers', async ({ page }) => {
		await visitAt(page, '23:00');

		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('link', { name: /^Écrire/ })).toHaveCount(1);
	});

	test('the night’s paper brings the night at noon, the day’s the day at night, `auto` the sun back', async ({
		page,
	}) => {
		await visitAt(page, '12:00');
		await expect(option(page, 'auto')).toBeChecked();

		await pickPaper(page, 'dark');
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');

		await page.clock.setFixedTime(at('23:00'));
		await pickPaper(page, 'light');
		await expect(root(page)).toHaveAttribute('data-theme', 'light');

		await pickPaper(page, 'auto');
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
	});

	test('the choice is kept from page to page within the visit, from the first paint', async ({ page }) => {
		await visitAt(page, '12:00');
		await pickPaper(page, 'dark');
		// The pick is kept as the reveal starts, a frame or two after the click: the visit ends after it.
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');

		await page.goto('/');
		await expect(option(page, 'dark')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');

		await pickPaper(page, 'auto');
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
		await page.goto('/');
		await expect(option(page, 'auto')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
	});

	test('is reached with the keyboard: the arrows move from one choice to the next', async ({ page }) => {
		await visitAt(page, '12:00');
		await option(page, 'auto').focus();

		// Auto is the last strip: the arrows wrap round to the first, the day.
		await page.keyboard.press('ArrowRight');
		await expect(option(page, 'light')).toBeChecked();
		await page.keyboard.press('ArrowRight');
		await expect(option(page, 'dark')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
	});

	test('the page’s own night follows the next sunset without a reload', async ({ page }) => {
		await visitAt(page, '17:05');
		await expect(root(page)).toHaveAttribute('data-theme', 'light');

		await page.clock.setFixedTime(at('17:30'));
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
	});

	test('still works for the visit when the browser blocks storage', async ({ page }) => {
		const errors: Error[] = [];
		page.on('pageerror', (error) => errors.push(error));
		await page.addInitScript(() => {
			Object.defineProperty(window, 'sessionStorage', {
				get() {
					throw new DOMException('The operation is insecure.', 'SecurityError');
				},
			});
		});
		await visitAt(page, '12:00');

		await pickPaper(page, 'dark');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		expect(errors).toEqual([]);
	});

	test('reaches the other pages: the 404 follows the sun too', async ({ page }) => {
		await page.clock.setFixedTime(at('23:00'));
		await page.goto('/nowhere');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(option(page, 'auto')).toBeChecked();
	});
});

test.describe('the sun over Besançon, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('leaves the site in daylight, with no switch', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(239, 238, 233)');
		await expect(page.getByRole('radio')).toHaveCount(0);
	});
});
