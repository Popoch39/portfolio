import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * Every visit arrives from another page of the site, so the Intro (which plays only on a direct
 * visit to the home page) stays out of the specs that are not about it. `intro.spec.ts` imports
 * from `@playwright/test` to visit directly. A `referer` passed to `goto` still wins.
 */
export const test = base.extend({
	page: async ({ page, baseURL }, use) => {
		const goto = page.goto.bind(page);
		page.goto = (url, options) => goto(url, { referer: baseURL, ...options });
		await use(page);
	},
});
