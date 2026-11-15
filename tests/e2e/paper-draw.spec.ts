// Not `./fixtures`: a visit draws its paper when it comes from elsewhere, without a referrer from the site.
import { expect, test, type Page } from '@playwright/test';
import { drawPaper } from './helpers';
import { paper, pickPaper } from './nuancier-helpers';

/**
 * The visit's paper (ADR 0009): drawn by lot as a visit begins, kept from page to page within it, and
 * the Établi's assembly plays on it.
 */
const at = (time: string) => new Date(`2026-11-09T${time}:00+01:00`);
const root = (page: Page) => page.locator('html');

test.describe('the visit’s paper, without the assembly', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('is drawn on arriving from elsewhere, before the first paint, its strip checked', async ({ page }) => {
		await drawPaper(page, 'solarized-light');
		await page.clock.setFixedTime(at('12:00'));
		await page.goto('/');

		await expect(root(page)).toHaveAttribute('data-bg', 'solarized-light');
		await expect(root(page)).toHaveAttribute('data-theme', 'solarized-light');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(253, 246, 227)');
		await expect(paper(page, 'solarized-light')).toBeChecked();
	});

	test('stays from page to page within the visit', async ({ page, baseURL }) => {
		await drawPaper(page, 'nord');
		await page.goto('/');
		await expect(root(page)).toHaveAttribute('data-bg', 'nord');

		await page.goto('/nowhere', { referer: baseURL });

		await expect(root(page)).toHaveAttribute('data-bg', 'nord');
		await expect(paper(page, 'nord')).toBeChecked();
	});

	test('a paper the site no longer has, kept within the visit, draws again', async ({ page, baseURL }) => {
		await drawPaper(page, 'nord');
		await page.goto('/');
		await page.evaluate(() => sessionStorage.setItem('bg', 'kraft'));

		await page.goto('/nowhere', { referer: baseURL });

		const bg = await page.evaluate(() => sessionStorage.getItem('bg'));
		expect(bg).not.toBe('kraft');
		await expect(root(page)).not.toHaveAttribute('data-bg', 'kraft');
		await expect(page.locator('[data-nuancier] input:checked')).toHaveValue(bg!);
	});

	// On the real clock, like the pick below.
	test('a reload draws again, never the same paper twice in a row', async ({ page }) => {
		await drawPaper(page, 'gruvbox-light');
		await page.goto('/');
		await expect(root(page)).toHaveAttribute('data-bg', 'gruvbox-light');

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
		await drawPaper(page, 'catppuccin-mocha');
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
		await drawPaper(page, 'tokyo-night');
		await page.goto('/');

		await expect(root(page)).toHaveAttribute('data-bg', 'tokyo-night');
		expect(errors).toEqual([]);
	});
});

test.describe('the Établi’s assembly, on the visit’s paper', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	const playing = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('intro'));

	test('plays on the paper drawn, from the first paint', async ({ page }) => {
		await drawPaper(page, 'tokyo-night');
		await page.clock.install({ time: at('12:00') });
		await page.goto('/');

		expect(await playing(page)).toBe(true);
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 27, 38)');
	});

	test('on Auto after sunset, plays at night', async ({ page }) => {
		await drawPaper(page, 'auto');
		await page.clock.install({ time: at('23:00') });
		await page.goto('/');

		expect(await playing(page)).toBe(true);
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 20, 18)');
	});
});
