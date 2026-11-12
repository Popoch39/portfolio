// Not `./fixtures`: a visit draws its paper when it comes from elsewhere, without a referrer from the site.
import { expect, test, type Page } from '@playwright/test';
import { drawPaper } from './helpers';
import { paper, pickPaper } from './nuancier-helpers';

/**
 * The visit's paper (ADR 0009): drawn by lot as a visit begins, kept from page to page within it, and
 * shown by the Intro, which plays on it.
 */
const at = (time: string) => new Date(`2026-11-09T${time}:00+01:00`);
const root = (page: Page) => page.locator('html');
const veil = (page: Page) => page.locator('#veil');
// Firefox gives the concatenated strings one by one (`"papier " "EN-08"`): joined back into one.
const hudPaper = (page: Page) =>
	page
		.locator('#intro-over .hud-paper')
		.evaluate((el) => getComputedStyle(el, '::before').content.replaceAll('" "', ''));

test.describe('the visit’s paper, without the Intro', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('is drawn on arriving from elsewhere, before the first paint, its strip checked', async ({ page }) => {
		await drawPaper(page, 'kraft');
		await page.clock.setFixedTime(at('12:00'));
		await page.goto('/');

		await expect(root(page)).toHaveAttribute('data-bg', 'kraft');
		await expect(root(page)).toHaveAttribute('data-theme', 'kraft');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(212, 185, 143)');
		await expect(paper(page, 'kraft')).toBeChecked();
	});

	test('stays from page to page within the visit', async ({ page, baseURL }) => {
		await drawPaper(page, 'cyan');
		await page.goto('/');
		await expect(root(page)).toHaveAttribute('data-bg', 'cyan');

		await page.goto('/nowhere', { referer: baseURL });

		await expect(root(page)).toHaveAttribute('data-bg', 'cyan');
		await expect(paper(page, 'cyan')).toBeChecked();
	});

	// On the real clock, like the pick below.
	test('a reload draws again, never the same paper twice in a row', async ({ page }) => {
		await drawPaper(page, 'tracing');
		await page.goto('/');
		await expect(root(page)).toHaveAttribute('data-bg', 'tracing');

		for (let i = 0; i < 5; i++) {
			const before = await page.evaluate(() => sessionStorage.getItem('bg'));
			await page.reload();
			const after = await page.evaluate(() => sessionStorage.getItem('bg'));
			expect(after).not.toBeNull();
			expect(after).not.toBe(before);
		}
	});

	// On the real clock: Playwright's fake one empties the navigation entry, where a reload shows.
	test('a pick in the Nuancier lasts for the visit, and the next one draws again', async ({ page, baseURL }) => {
		await drawPaper(page, 'sanguine');
		await page.goto('/');
		await pickPaper(page, 'dark');
		await expect(root(page)).toHaveAttribute('data-bg', 'dark');

		await page.goto('/nowhere', { referer: baseURL });
		await expect(root(page)).toHaveAttribute('data-bg', 'dark');

		await page.reload();
		await expect(root(page)).not.toHaveAttribute('data-bg', 'dark');
		expect(await page.evaluate(() => localStorage.getItem('bg'))).toBeNull();
	});

	test('still draws when the browser blocks storage', async ({ page }) => {
		const errors: Error[] = [];
		page.on('pageerror', (error) => errors.push(error));
		await page.addInitScript(() => {
			Object.defineProperty(window, 'sessionStorage', {
				get() {
					throw new DOMException('The operation is insecure.', 'SecurityError');
				},
			});
		});
		await drawPaper(page, 'phosphor');
		await page.goto('/');

		await expect(root(page)).toHaveAttribute('data-bg', 'phosphor');
		expect(errors).toEqual([]);
	});
});

test.describe('the Intro, on the visit’s paper', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('plays on the paper drawn, and names it', async ({ page }) => {
		await drawPaper(page, 'phosphor');
		await page.clock.install({ time: at('12:00') });
		await page.goto('/');

		await expect(veil(page)).toBeVisible();
		await expect(veil(page)).toHaveCSS('background-color', 'rgb(11, 19, 13)');
		expect(await hudPaper(page)).toBe('"papier EN-08 · phosphore"');
	});

	test('on the night drawn, plays at night', async ({ page }) => {
		await drawPaper(page, 'dark');
		await page.clock.install({ time: at('12:00') });
		await page.goto('/');

		await expect(veil(page)).toHaveCSS('background-color', 'rgb(20, 20, 18)');
	});

	test('on Auto, plays in daylight even after sunset', async ({ page }) => {
		await drawPaper(page, 'auto');
		await page.clock.install({ time: at('23:00') });
		await page.goto('/');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(veil(page)).toHaveCSS('background-color', 'rgb(239, 238, 233)');
		expect(await hudPaper(page)).toBe('"papier EN-04 · auto · nuit"');
	});
});
