import { expect, test } from './fixtures';

// Variable Archivo, its italic and Fragment Mono, subsets included (ADR 0002).
const FONT_BUDGET = 90 * 1024;

test('the home page requests nothing outside the site, and its self-hosted fonts fit the budget', async ({
	page,
	baseURL,
}) => {
	const origins = new Set<string>();
	const fonts: Promise<{ url: string; size: number }>[] = [];
	page.on('response', (response) => {
		origins.add(new URL(response.url()).origin);
		if (response.request().resourceType() === 'font') {
			fonts.push(response.body().then((body) => ({ url: response.url(), size: body.length })));
		}
	});

	await page.goto('/', { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);

	expect([...origins]).toEqual([new URL(baseURL ?? '').origin]);
	const loaded = await Promise.all(fonts);
	expect(loaded.length).toBeGreaterThanOrEqual(2);
	for (const font of loaded) expect(font.url).toMatch(/\.woff2$/);
	expect(loaded.reduce((total, font) => total + font.size, 0)).toBeLessThanOrEqual(FONT_BUDGET);
});

test('only the title font is preloaded, and every font displays with swap', async ({ page }) => {
	await page.goto('/');

	const preloads = page.locator('link[rel="preload"][as="font"]');
	await expect(preloads).toHaveCount(1);
	await expect(preloads).toHaveAttribute('crossorigin', '');
	const preloaded = new URL((await preloads.getAttribute('href')) ?? '', page.url()).href;

	const faces = await page.evaluate(() =>
		[...document.styleSheets]
			.flatMap((sheet) => [...sheet.cssRules])
			.filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
			.map((rule) => ({
				family: rule.style.getPropertyValue('font-family'),
				style: rule.style.getPropertyValue('font-style'),
				// Firefox exposes the descriptor under its new name only.
				stretch: rule.style.getPropertyValue('font-stretch') || rule.style.getPropertyValue('font-width'),
				src: /url\("?([^")]+)"?\)/.exec(rule.style.getPropertyValue('src'))?.[1],
			}))
			.filter((face) => face.src),
	);
	// The upright variable Archivo: the face that carries the width axis of the title.
	const titleFace = faces.find((face) => /Archivo/.test(face.family) && face.style === 'normal');
	expect(titleFace?.stretch).toBe('62% 100%');
	expect(new URL(titleFace?.src ?? '', page.url()).href).toBe(preloaded);

	const displays = await page.evaluate(() => [...document.fonts].map((font) => font.display));
	expect(displays.length).toBeGreaterThan(0);
	expect(new Set(displays)).toEqual(new Set(['swap']));
});

test('the title and the labels render in their own fonts, not in a fallback', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);

	const loaded = await page.evaluate(() =>
		[...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
	);
	expect(loaded.some((family) => /Archivo/.test(family))).toBe(true);
	expect(loaded.some((family) => /Fragment Mono/.test(family))).toBe(true);
});
