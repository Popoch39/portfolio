import { devices, expect, test, type Page } from './fixtures';
import { paper, pickPaper, visiblePoint, type Paper } from './nuancier-helpers';

/**
 * The Nuancier (03 · Nuancier, ADR 0009): a swatch book riveted in the bottom corner of the window,
 * four papers (Jour, Nuit, Cyanotype, Auto). A pick spreads the new paper from its strip in a circle,
 * and the book shuts and fans out again with that strip at the front.
 */

const noon = new Date('2026-11-09T12:00:00+01:00');
const root = (page: Page) => page.locator('html');
const fan = (page: Page) => page.getByRole('group', { name: 'Papier du site' });
const slotOf = (page: Page, name: Paper) =>
	page.locator(`[data-nuancier] input[value="${name}"]`).evaluate((input) => input.closest<HTMLElement>('[data-slot]')!.dataset.slot);

async function visit(page: Page, path = '/') {
	await page.clock.setFixedTime(noon);
	await page.goto(path);
}

test.describe('the Nuancier', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('offers four papers in one named group, auto at the front by default', async ({ page }) => {
		await visit(page);

		await expect(fan(page).getByRole('radio')).toHaveCount(4);
		await expect(paper(page, 'auto')).toBeChecked();
		expect(await slotOf(page, 'auto')).toBe('3');
		await expect(page.locator('#statusline .paper')).toBeVisible();
	});

	test('the Cyanotype turns the whole site blue, the hero’s map included, without a night', async ({ page }) => {
		await visit(page);

		await pickPaper(page, 'cyan');

		await expect(root(page)).toHaveAttribute('data-theme', 'cyan');
		await expect(root(page)).toHaveAttribute('data-sky', 'day');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 48, 90)');
		await expect(page.locator('.hero-map')).toHaveCSS('color', 'rgb(238, 242, 248)');
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#12305a');
		await expect
			.poll(() => page.locator('#statusline .paper').evaluate((el) => getComputedStyle(el, '::after').content))
			.toBe('"cyanotype"');
	});

	test('the new paper spreads in a circle from the strip, and the strip ends at the front', async ({ page }) => {
		await visit(page);
		const transitions = page.evaluate(
			() =>
				new Promise<string[]>((resolve) => {
					const seen: string[] = [];
					const look = () => {
						for (const animation of document.getAnimations()) {
							const effect = animation.effect as KeyframeEffect | null;
							if (effect?.pseudoElement === '::view-transition-new(root)') {
								seen.push(String(effect.getKeyframes()[0].clipPath));
							}
						}
						if (seen.length) resolve(seen);
						else requestAnimationFrame(look);
					};
					look();
				}),
		);

		await pickPaper(page, 'dark');

		const [start] = await transitions;
		expect(start).toMatch(/^circle\(0px at [\d.]+px [\d.]+px\)$/);
		// The circle starts within the fan, in the bottom-right corner.
		const [, x, y] = start.match(/at ([\d.]+)px ([\d.]+)px/)!.map(Number);
		expect(x).toBeGreaterThan(1440 - 300);
		expect(y).toBeGreaterThan(900 - 300);
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect.poll(() => slotOf(page, 'dark')).toBe('3');
		await expect(root(page)).not.toHaveClass(/paper-turning/);
	});

	test('the strips move on transforms alone', async ({ page }) => {
		await visit(page);

		const properties = await page
			.locator('[data-nuancier] :is(.slot, .lam)')
			.evaluateAll((elements) => [...new Set(elements.map((el) => getComputedStyle(el).transitionProperty))]);
		expect(properties.sort()).toEqual(['rotate', 'transform']);
	});

	test('a pick during a reveal wins: the page ends on the last paper', async ({ page }) => {
		await visit(page);

		await pickPaper(page, 'dark');
		await page.keyboard.press('ArrowRight');

		await expect(paper(page, 'cyan')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'cyan');
		await expect.poll(() => slotOf(page, 'cyan')).toBe('3');
		await expect(root(page)).not.toHaveClass(/paper-turning/);
	});

	test('the remembered paper is back from the first paint, its strip at the front', async ({ page }) => {
		await visit(page);
		await pickPaper(page, 'cyan');
		await expect(root(page)).not.toHaveClass(/paper-turning/);

		await page.goto('/nowhere');

		await expect(paper(page, 'cyan')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'cyan');
		expect(await slotOf(page, 'cyan')).toBe('3');
	});

	test('takes the pointer on its strips only: the page around them stays clickable', async ({ page }) => {
		await visit(page);

		const box = (await fan(page).boundingBox())!;
		const hit = await page.evaluate(
			({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-nuancier]') !== null,
			{ x: box.x + 4, y: box.y + 4 },
		);
		expect(hit).toBe(false);
	});

	test('opens to the keyboard', async ({ page }) => {
		await visit(page);
		const backAngle = () => page.locator('[data-nuancier] [data-slot="0"]').evaluate((el) => getComputedStyle(el).rotate);
		const resting = await backAngle();

		await paper(page, 'auto').focus();
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');

		await expect.poll(backAngle).not.toBe(resting);
	});
});

test.describe('the Nuancier, motion reduced', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('changes the paper at once, with no reveal, the strip straight to the front', async ({ page }) => {
		await visit(page);

		await pickPaper(page, 'light');

		await expect(root(page)).toHaveAttribute('data-theme', 'light');
		await expect(root(page)).not.toHaveClass(/paper-turning/);
		expect(await slotOf(page, 'light')).toBe('3');
		expect(await page.locator('[data-nuancier] .slot').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
	});
});

test.describe('the Nuancier under a finger', () => {
	const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
	// Playwright does not emulate `isMobile` under Firefox.
	test.skip(({ browserName }) => browserName === 'firefox');

	test('rests half open over the statusline, and each strip takes a tap', async ({ page }) => {
		await visit(page);

		const fanBox = (await fan(page).boundingBox())!;
		const statusline = (await page.locator('#statusline').boundingBox())!;
		expect(fanBox.y + fanBox.height).toBeLessThanOrEqual(statusline.y);
		expect(fanBox.x + fanBox.width).toBeLessThanOrEqual(viewport.width);

		for (const name of ['light', 'dark', 'cyan', 'auto'] as const) {
			const { x, y } = await visiblePoint(page, name);
			await page.touchscreen.tap(x, y);
			await expect(paper(page, name)).toBeChecked();
			await expect(root(page)).not.toHaveClass(/paper-turning/);
		}
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
	});
});
