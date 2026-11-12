import { expect, test, type Page } from './fixtures';

/**
 * The hero's graticule runs on over the whole home page (03 · Nuancier): the page's lines meet the
 * map's at its frame, at every width, and the layer that draws them widens nothing.
 */

/** How far the page's lines fall from the map's, px, across and down; 0 when they meet. */
function offsets(page: Page) {
	return page.evaluate(() => {
		const south = document.querySelector('.hero-map > .hero-south')!.getBoundingClientRect();
		const grid = document.querySelector('.paper-grid')!.getBoundingClientRect();
		const style = getComputedStyle(document.querySelector('main')!);
		const value = (name: string) => parseFloat(style.getPropertyValue(name));
		const [share, pitchX, pitchY] = ['--meridian-share', '--pitch-x', '--pitch-y'].map(value);
		// Distance to the nearest line, whichever side.
		const apart = (a: number, b: number, pitch: number) => {
			const off = (((a - b) % pitch) + pitch) % pitch;
			return Math.min(off, pitch - off);
		};
		// The map's meridians stand on its marker's, its parallels on the one under the name: the phases cancel out.
		return {
			across: apart(south.left + share * south.width, grid.left, pitchX),
			down: apart(south.top, grid.top, pitchY),
		};
	});
}

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 2200, height: 1100 },
	{ width: 1024, height: 700 },
	{ width: 412, height: 915 },
	{ width: 320, height: 568 },
]) {
	test(`at ${viewport.width}px, the page’s graticule meets the map’s and widens nothing`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await page.goto('/');

		await expect(page.locator('.paper-grid')).toBeAttached();
		const { across, down } = await offsets(page);
		expect(across).toBeLessThan(0.5);
		expect(down).toBeLessThan(0.5);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
	});
}

test('the graticule is drawn in the paper’s own rule, on the Cyanotype too', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		document.documentElement.dataset.bg = 'cyan';
		document.documentElement.dataset.theme = 'cyan';
	});

	await expect(page.locator('.paper-grid')).toHaveCSS('background-image', /rgb\(36, 71, 122\)/);
});
