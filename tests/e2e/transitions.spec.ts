import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectSmoothScrolling, scrollWithWheel } from './helpers';

const NOT_FOUND = '/this-page-does-not-exist/';

/** Console errors and uncaught exceptions, collected over the whole visit. */
function errorsOf(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (message) => {
		// The browser logs the expected 404 status of the not found page itself as an error.
		const notFoundDocument = message.location().url.endsWith(NOT_FOUND) && message.text().includes('404');
		if (message.type() === 'error' && !notFoundDocument) errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	return errors;
}

/** All the CSS the browser receives for a page: inline `<style>` blocks and linked sheets. */
async function servedCss(request: APIRequestContext, path: string): Promise<string> {
	const html = await (await request.get(path)).text();
	const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
	const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
		.map((m) => /href="([^"]+)"/.exec(m[0])?.[1])
		.filter((href): href is string => !!href);
	const sheets = await Promise.all(
		links.map(async (href) => (await request.get(new URL(href, `http://x${path}`).pathname)).text()),
	);
	return [...inline, ...sheets].join('\n');
}

test('the served CSS declares the cross-document view transition', async ({ request }) => {
	expect(await servedCss(request, '/')).toMatch(/@view-transition\s*\{\s*navigation:\s*auto\s*;?\s*\}/);
});

test.describe('navigation between pages, motion allowed', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the not found page leads back to the home page, each with its own title and description', async ({
		page,
	}) => {
		await page.goto('/');
		const homeTitle = await page.title();
		const homeDescription = await page.locator('meta[name="description"]').getAttribute('content');

		await page.goto(NOT_FOUND);
		await expect(page).not.toHaveTitle(homeTitle);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
		await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
			'content',
			homeDescription ?? '',
		);

		await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
		await expect(page).toHaveURL('/');
		await expect(page).toHaveTitle(homeTitle);
	});

	test('going to another page then back finds the home page with smoothed scrolling, without errors', async ({
		page,
	}) => {
		const errors = errorsOf(page);
		await page.goto('/');
		await page.goto(NOT_FOUND);

		await page.goBack();
		await expect(page).toHaveURL('/');
		await scrollWithWheel(page, 600);

		await expectSmoothScrolling(page);
		expect(errors).toEqual([]);
	});
});
