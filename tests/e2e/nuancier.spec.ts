import { devices, expect, test, type Page } from './fixtures';
import { FRONT, openByTap, paper, papers, pickPaper, visiblePoint, type Paper } from './nuancier-helpers';

/**
 * The Nuancier (03 · Nuancier, ADR 0009): a swatch book riveted in the bottom corner of the window,
 * eight papers, shut on the paper in force until a hover, a tap or the keyboard opens it. A pick spreads
 * the new paper from its strip in a circle, and the book shuts with that strip at the front.
 */
const shown = (page: Page) =>
	page.locator('[data-nuancier] .slot').evaluateAll((slots) => slots.filter((slot) => getComputedStyle(slot).opacity === '1').length);

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

	test('offers eight papers in one named group, auto at the front by default', async ({ page }) => {
		await visit(page);

		await expect(fan(page).getByRole('radio')).toHaveCount(8);
		await expect(paper(page, 'auto')).toBeChecked();
		expect(await slotOf(page, 'auto')).toBe(FRONT);
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

	const coloured = [
		{ name: 'kraft', background: 'rgb(212, 185, 143)', ink: 'rgb(34, 23, 13)', surface: '#d4b98f', label: '"kraft"' },
		{ name: 'tracing', background: 'rgb(227, 232, 234)', ink: 'rgb(30, 36, 39)', surface: '#e3e8ea', label: '"calque"' },
		{ name: 'sanguine', background: 'rgb(241, 226, 214)', ink: 'rgb(61, 20, 11)', surface: '#f1e2d6', label: '"sanguine"' },
		{ name: 'phosphor', background: 'rgb(11, 19, 13)', ink: 'rgb(142, 240, 160)', surface: '#0b130d', label: '"phosphore"' },
	] as const;
	for (const { name, background, ink, surface, label } of coloured) {
		test(`the ${name} paper turns the whole site, the hero’s map included, without a night`, async ({ page }) => {
			await visit(page);

			await pickPaper(page, name);

			await expect(root(page)).toHaveAttribute('data-theme', name);
			await expect(root(page)).toHaveAttribute('data-sky', 'day');
			await expect(page.locator('body')).toHaveCSS('background-color', background);
			await expect(page.locator('.hero-map')).toHaveCSS('color', ink);
			await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', surface);
			await expect
				.poll(() => page.locator('#statusline .paper').evaluate((el) => getComputedStyle(el, '::after').content))
				.toBe(label);
		});
	}

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
		await expect.poll(() => slotOf(page, 'dark')).toBe(FRONT);
		await expect(root(page)).not.toHaveClass(/paper-turning/);
	});

	test('the strips move on transforms alone, and fade only once folded', async ({ page }) => {
		await visit(page);

		const properties = await page
			.locator('[data-nuancier] :is(.slot, .lam)')
			.evaluateAll((elements) => [...new Set(elements.map((el) => getComputedStyle(el).transitionProperty))]);
		expect(properties.sort()).toEqual(['rotate, scale, opacity', 'transform']);
	});

	test('rests shut on the paper in force, and opens as the pointer comes over it', async ({ page }) => {
		await visit(page);

		expect(await shown(page)).toBe(1);
		const { x, y } = await visiblePoint(page, 'auto');
		await page.mouse.move(x, y);
		await expect.poll(() => shown(page)).toBe(8);
	});

	test('a pick during a reveal wins: the page ends on the last paper', async ({ page }) => {
		await visit(page);

		await pickPaper(page, 'dark');
		await page.keyboard.press('ArrowRight');

		await expect(paper(page, 'kraft')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'kraft');
		await expect.poll(() => slotOf(page, 'kraft')).toBe(FRONT);
		await expect(root(page)).not.toHaveClass(/paper-turning/);
	});

	test('the remembered paper is back from the first paint, its strip at the front', async ({ page }) => {
		await visit(page);
		await pickPaper(page, 'cyan');
		await expect(root(page)).not.toHaveClass(/paper-turning/);

		await page.goto('/nowhere');

		await expect(paper(page, 'cyan')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'cyan');
		expect(await slotOf(page, 'cyan')).toBe(FRONT);
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
		expect(await slotOf(page, 'light')).toBe(FRONT);
		expect(await page.locator('[data-nuancier] .slot').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
	});
});

test.describe('the Nuancier under a finger', () => {
	const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
	// Playwright does not emulate `isMobile` under Firefox.
	test.skip(({ browserName }) => browserName === 'firefox');

	test('rests shut over the statusline; a tap opens it, and each strip takes a tap', async ({ page }) => {
		// Sixteen gestures, each waiting for the book to open or shut.
		test.slow();
		await visit(page);

		const fanBox = (await fan(page).boundingBox())!;
		const statusline = (await page.locator('#statusline').boundingBox())!;
		expect(fanBox.y + fanBox.height).toBeLessThanOrEqual(statusline.y);
		expect(fanBox.x + fanBox.width).toBeLessThanOrEqual(viewport.width);

		for (const name of papers) {
			expect(await shown(page)).toBe(1);
			await openByTap(page);
			await expect.poll(() => shown(page)).toBe(8);
			const { x, y } = await visiblePoint(page, name);
			await page.touchscreen.tap(x, y);
			await expect(paper(page, name)).toBeChecked();
			await expect(root(page)).not.toHaveClass(/paper-turning/);
			await expect.poll(() => shown(page)).toBe(1);
		}
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
	});

	test('a tap on the paper in force, or beside the book, shuts it again', async ({ page }) => {
		// The 404's empty middle: nothing there to follow.
		await visit(page, '/nowhere');

		await openByTap(page);
		await expect.poll(() => shown(page)).toBe(8);
		await page.touchscreen.tap(200, 520);
		await expect.poll(() => shown(page)).toBe(1);

		await openByTap(page);
		await expect.poll(() => shown(page)).toBe(8);
		await openByTap(page);
		await expect.poll(() => shown(page)).toBe(1);
		await expect(paper(page, 'auto')).toBeChecked();
	});
});
