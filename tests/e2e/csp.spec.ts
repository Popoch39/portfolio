// Not `./fixtures`: the home page is visited directly too, so that the Intro plays.
import { expect, test, type Page } from '@playwright/test';

declare global {
	interface Window {
		testCspViolations?: string[];
	}
}

/** From the first script of the page on, every report of a blocked resource, inline code included. */
async function recordViolations(page: Page) {
	await page.addInitScript(() => {
		window.testCspViolations = [];
		document.addEventListener('securitypolicyviolation', (event) => {
			window.testCspViolations?.push(`${event.effectiveDirective} ${event.blockedURI} ${event.sample}`);
		});
	});
	return () => page.evaluate(() => window.testCspViolations ?? []);
}

/** Walks down the whole page one window at a time, so that every scene plays and loads its layers. */
async function scrollThroughPage(page: Page) {
	for (;;) {
		const left = await page.evaluate(() => {
			scrollBy(0, innerHeight);
			return document.documentElement.scrollHeight - innerHeight - scrollY;
		});
		await page.waitForTimeout(100);
		if (left < 1) break;
	}
}

test.describe('Content Security Policy', () => {
	test('is set on every page, without inline scripts or plugins', async ({ page }) => {
		for (const path of ['/', '/this-page-does-not-exist/']) {
			await page.goto(path);
			const policy = await page
				.locator('meta[http-equiv="content-security-policy"]')
				.getAttribute('content');

			expect(policy).toContain("object-src 'none'");
			expect(policy).toContain("base-uri 'self'");
			expect(policy).toContain("img-src 'self' data:");
			expect(policy).toContain("font-src 'self'");
			expect(policy).toMatch(/script-src[^;]*'sha256-/);
			expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
		}
	});

	test('blocks nothing the Intro needs', async ({ page }) => {
		const violations = await recordViolations(page);
		await page.goto('/');
		await expect(page.locator('html')).toHaveClass(/\bintro\b/);

		await expect(page.locator('#veil')).toBeHidden({ timeout: 20_000 });
		expect(await violations()).toEqual([]);
	});

	test('blocks nothing the scenes need', async ({ page, baseURL }) => {
		const violations = await recordViolations(page);
		await page.goto('/', { referer: baseURL });

		await scrollThroughPage(page);
		expect(await violations()).toEqual([]);
	});

	test('blocks nothing on the 404 page', async ({ page }) => {
		const violations = await recordViolations(page);
		await page.goto('/this-page-does-not-exist/');

		await expect(page.locator('h1')).toBeVisible();
		expect(await violations()).toEqual([]);
	});
});
