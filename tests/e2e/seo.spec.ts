import { expect, test, type Page } from './fixtures';

const meta = (page: Page, key: string) =>
	page.locator(`meta[name="${key}"], meta[property="${key}"]`).getAttribute('content');

const canonical = (page: Page) => page.locator('link[rel="canonical"]').getAttribute('href');

/** Heading levels in document order, screen-reader-only headings included. */
const headingLevels = (page: Page) =>
	page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) => headings.map((h) => Number(h.tagName[1])));

function expectHeadingsWithoutSkips(levels: number[]) {
	expect(levels[0]).toBe(1);
	expect(levels.filter((level) => level === 1)).toHaveLength(1);
	for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
}

/** Width and height of a PNG, read from its IHDR header. */
function pngSize(bytes: Uint8Array) {
	expect(new TextDecoder().decode(bytes.subarray(1, 4))).toBe('PNG');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

test.describe('home page', () => {
	test('it carries its language, a title, a description and an absolute canonical URL', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		await expect(page).toHaveTitle(/Louis Pocheron/);
		expect((await page.title()).length).toBeLessThanOrEqual(60);
		const description = await meta(page, 'description');
		expect(description?.length).toBeGreaterThanOrEqual(70);
		expect(description?.length).toBeLessThanOrEqual(160);
		expect(await canonical(page)).toMatch(/^https:\/\/[^/]+\/$/);
		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
	});

	test('the title and the description name both sides of the offer: local websites and GIS, in Besançon', async ({
		page,
	}) => {
		await page.goto('/');

		const title = await page.title();
		expect(title).toMatch(/\bweb\b/i);
		expect(title).toMatch(/\bSIG\b/);
		expect(title).toMatch(/Besançon/);
		const description = await meta(page, 'description');
		expect(description).toMatch(/site vitrine|sites vitrines/i);
		expect(description).toMatch(/\bSIG\b|cartographie/i);
		expect(description).toMatch(/Besançon/);
	});

	test('Open Graph and Twitter describe the page with a 1200×630 image served by the site', async ({
		page,
		request,
	}) => {
		await page.goto('/');

		expect(await meta(page, 'og:url')).toBe(await canonical(page));
		expect(await meta(page, 'og:title')).toMatch(/Louis Pocheron/);
		expect(await meta(page, 'og:description')).toBe(await meta(page, 'description'));
		expect(await meta(page, 'og:locale')).toBe('fr_FR');
		expect(await meta(page, 'og:type')).toBe('profile');
		expect(await meta(page, 'og:image:alt')).toMatch(/\S/);
		expect(await meta(page, 'twitter:card')).toBe('summary_large_image');

		const image = await meta(page, 'og:image');
		expect(image).toMatch(/^https:\/\//);
		expect(await meta(page, 'twitter:image')).toBe(image);
		const response = await request.get(new URL(image ?? '').pathname);
		expect(response.ok()).toBe(true);
		expect(pngSize(await response.body())).toEqual({ width: 1200, height: 630 });
		expect(await meta(page, 'og:image:width')).toBe('1200');
		expect(await meta(page, 'og:image:height')).toBe('630');
	});

	test('a single h1 and a heading outline without skipped levels', async ({ page }) => {
		await page.goto('/');

		expectHeadingsWithoutSkips(await headingLevels(page));
	});

	test('the JSON-LD describes the person behind the portfolio', async ({ page }) => {
		await page.goto('/');

		const blocks = await page
			.locator('script[type="application/ld+json"]')
			.evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent ?? '')));
		const nodes = blocks.flatMap((block) => [block, block.mainEntity, ...(block['@graph'] ?? [])]);
		const person = nodes.find((node) => node?.['@type'] === 'Person');
		expect(person).toMatchObject({ name: 'Louis Pocheron', jobTitle: expect.any(String) });
		expect(person.url).toBe(await canonical(page));
		expect(person.sameAs).toContain('https://github.com/Popoch39');
	});

	test('the JSON-LD names the website at its canonical URL', async ({ page }) => {
		await page.goto('/');

		const blocks = await page
			.locator('script[type="application/ld+json"]')
			.evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent ?? '')));
		const website = blocks.map((block) => block.isPartOf).find((node) => node?.['@type'] === 'WebSite');
		expect(website).toMatchObject({ name: 'Louis Pocheron', url: await canonical(page) });
	});
});

test.describe('not found page', () => {
	test('it answers 404, stays out of the index and keeps a clean heading outline', async ({ page }) => {
		const response = await page.goto('/this-page-does-not-exist/');

		expect(response?.status()).toBe(404);
		expect(await meta(page, 'robots')).toMatch(/noindex/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		expectHeadingsWithoutSkips(await headingLevels(page));
		await expect(page.getByRole('link', { name: /accueil/i })).toHaveAttribute('href', '/');
	});
});

test('robots.txt allows crawling and points to a sitemap that lists the home page, not the 404', async ({
	request,
	page,
}) => {
	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toMatch(/^User-agent: \*$/m);
	const sitemap = /^Sitemap: (https:\/\/\S+)$/m.exec(robots)?.[1];
	expect(sitemap).toBeDefined();

	const response = await request.get(new URL(sitemap ?? '').pathname);
	expect(response.ok()).toBe(true);
	expect(response.headers()['content-type']).toMatch(/xml/);
	const xml = await response.text();
	await page.goto('/');
	expect(xml).toContain(`<loc>${await canonical(page)}</loc>`);
	expect(xml).not.toContain('404');
});
