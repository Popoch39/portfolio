// Not `./fixtures`: these visits are direct, without a referrer from the site.
import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { scrollPosition, scrollWithWheel, statusline, swipeUp } from './helpers';

// Decorative and hidden from assistive technologies: targeted by its id, like the statusline.
const veil = (page: Page) => page.locator('#veil');
// The globe, then the blue grid it becomes, drawn over the page.
const grid = (page: Page) => page.locator('#intro-grid');
// The Besançon label that rides with the point.
const label = (page: Page) => page.locator('#intro-over p', { hasText: 'Besançon' });
// The lines of the HUD printed on the paper.
const hudLines = (page: Page) => page.locator('#intro-over [data-hud="hud"] > p');

// A desktop window, and a phone held upright then turned on its side.
const PHONE = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const SCREENS = [
	['desktop', { width: 1280, height: 720 }],
	['phone', PHONE],
] as const;

// The elements the Intro reveals, as a visitor sees them on the page.
const revealed = (page: Page) => [
	page.getByRole('banner').getByRole('link').first(),
	page.locator('h1'),
	page.locator('h1 > *'),
	page.locator('h1 > * > *'),
	page.locator('.hero-lede'),
	page.locator('.hero-facts'),
	page.locator('.hero-actions'),
	statusline(page),
];

/** Every revealed element at rest: fully opaque, without a transform. */
async function expectFinalState(page: Page) {
	for (const group of revealed(page)) {
		for (const element of await group.all()) {
			await expect(element).toHaveCSS('opacity', '1');
			await expect(element).toHaveCSS('transform', 'none');
		}
	}
}

/** Loads the home page as a direct visit (no referrer, no anchor), on a clock the test drives. */
async function visitHome(page: Page, path = '/') {
	await page.clock.install();
	await page.goto(path);
}

/** From now on, how far down the page has ever been scrolled, even for a single frame. */
async function recordFarthestScroll(page: Page) {
	await page.evaluate(() => {
		window.testFarthestScroll = scrollY;
		addEventListener('scroll', () => {
			window.testFarthestScroll = Math.max(window.testFarthestScroll ?? 0, scrollY);
		});
	});
	return () => page.evaluate(() => window.testFarthestScroll);
}

declare global {
	interface Window {
		testFarthestScroll?: number;
	}
}

/** First and last rows of the window where the globe's canvas has drawn something, in CSS px. */
function drawnRows(page: Page) {
	return grid(page).evaluate((canvas: HTMLCanvasElement) => {
		const context = canvas.getContext('2d');
		if (!context) throw new Error('canvas without a 2D context');
		const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
		const inked = (y: number) => {
			for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) return true;
			return false;
		};
		let top = 0;
		while (top < height && !inked(top)) top++;
		let bottom = height - 1;
		while (bottom > top && !inked(bottom)) bottom--;
		const ratio = canvas.width / canvas.clientWidth;
		return { top: top / ratio, bottom: (bottom + 1) / ratio };
	});
}

async function box(element: Locator) {
	const found = await element.boundingBox();
	if (!found) throw new Error('element without a box');
	return found;
}

for (const [screen, viewport] of SCREENS) {
	test.describe(`Intro, motion allowed, on a ${screen}`, () => {
		test.use({ reducedMotion: 'no-preference', viewport });

		test('plays on loading the home page, then the veil gives way to the final state', async ({ page }) => {
			await visitHome(page);
			await expect(veil(page)).toBeVisible();

			await page.clock.runFor(6_000);
			await expect(veil(page)).toBeVisible();

			await page.clock.runFor(4_000);
			await expect(veil(page)).toBeHidden();
			await expectFinalState(page);
		});

		test('the grid stays over the page once the veil has lifted, then goes with the Intro', async ({ page }) => {
			await visitHome(page);
			await expect(grid(page)).toBeVisible();

			await page.clock.runFor(7_500);
			await expect(veil(page)).toBeHidden();
			await expect(grid(page)).toBeVisible();

			await page.clock.runFor(2_500);
			await expect(grid(page)).toBeHidden();
		});

		const gestures: [string, (page: Page) => Promise<void>][] = [
			['a key', (page) => page.keyboard.press('a')],
			['a click', (page) => page.mouse.click(200, 300)],
			['the wheel', (page) => scrollWithWheel(page, 300)],
		];
		for (const [name, gesture] of gestures) {
			test(`${name} skips it to the final state in a short fade`, async ({ page }) => {
				await visitHome(page);
				await page.clock.runFor(2_000);

				await gesture(page);
				await page.clock.runFor(400);

				await expect(veil(page)).toBeHidden();
				await expect(grid(page)).toBeHidden();
				await expectFinalState(page);
			});
		}

		test('Tab skips it and puts the focus on the first link', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(2_000);

			await page.keyboard.press('Tab');
			await page.clock.runFor(400);

			await expect(veil(page)).toBeHidden();
			await expect(page.getByRole('link').first()).toBeFocused();
		});

		test('scrolling is blocked during the Intro, then given back', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(2_000);

			// The gesture that skips the Intro does not scroll the page.
			await scrollWithWheel(page, 600);
			await page.clock.runFor(400);
			expect(await scrollPosition(page)).toBe(0);

			await scrollWithWheel(page, 600);
			await page.clock.runFor(1_000);
			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		});

		test('the keyboard does not scroll the page under the Intro either', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(2_000);
			const farthest = await recordFarthestScroll(page);

			await page.keyboard.press('PageDown');
			await page.keyboard.press('End');
			await page.clock.runFor(400);

			await expect(veil(page)).toBeHidden();
			expect(await farthest()).toBe(0);
		});

		test('the title is painted at its final state from the first paint, under the veil', async ({ page }) => {
			await visitHome(page);
			await expect(veil(page)).toBeVisible();

			await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
			for (const line of await page.locator('h1 > * > *').all()) {
				await expect(line).toHaveCSS('opacity', '1');
				await expect(line).toHaveCSS('transform', 'none');
			}
		});

		test('nothing moves in the layout when the veil gives way', async ({ page }) => {
			const boxes = () =>
				Promise.all([page.locator('h1'), page.locator('.hero-grid'), statusline(page)].map((l) => l.boundingBox()));
			await visitHome(page);
			await page.evaluate(() => document.fonts.ready);
			const underVeil = await boxes();

			await page.clock.runFor(10_000);

			await expect(veil(page)).toBeHidden();
			expect(await boxes()).toEqual(underVeil);
		});

		test('flipping to reduced motion during the Intro brings the page back to its final state', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(7_000);

			await page.emulateMedia({ reducedMotion: 'reduce' });

			await expect(veil(page)).toBeHidden();
			await expectFinalState(page);
		});

		test('does not play with an anchor in the URL', async ({ page }) => {
			await visitHome(page, '/#projets');

			await expect(veil(page)).toBeHidden();
		});

		test('does not play when arriving from another page of the site', async ({ page }) => {
			await page.clock.install();
			await page.goto('/this-page-does-not-exist/');

			await page.getByRole('link', { name: 'Retour à l’accueil' }).click();

			await expect(page).toHaveURL('/');
			await expect(veil(page)).toBeHidden();
		});

		// On the real clock: Playwright's fake one empties `performance.getEntriesByType('navigation')`,
		// where a history navigation shows.
		test('does not play again when coming back through history', async ({ page }) => {
			await page.goto('/');
			await expect(veil(page)).toBeVisible();
			await page.keyboard.press('a');
			await expect(veil(page)).toBeHidden();
			await page.goto('about:blank');

			await page.goBack();

			await expect(page).toHaveURL('/');
			await expect(veil(page)).toBeHidden();
		});
	});
}

test.describe('Intro, motion allowed, on a phone only', () => {
	test.use({ reducedMotion: 'no-preference', viewport: PHONE });

	for (const [orientation, viewport] of [
		['upright', PHONE],
		['on its side', PHONE_LANDSCAPE],
	] as const) {
		test(`held ${orientation}, the HUD fits in the window without its lines running into each other`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await visitHome(page);
			await page.clock.runFor(1_000);

			const boxes = await Promise.all((await hudLines(page).all()).map(box));
			expect(boxes.length).toBeGreaterThan(0);
			for (const [i, line] of boxes.entries()) {
				expect(line.x).toBeGreaterThanOrEqual(0);
				expect(line.y).toBeGreaterThanOrEqual(0);
				expect(line.x + line.width).toBeLessThanOrEqual(viewport.width);
				expect(line.y + line.height).toBeLessThanOrEqual(viewport.height);
				for (const other of boxes.slice(i + 1)) {
					const apart =
						line.x + line.width <= other.x ||
						other.x + other.width <= line.x ||
						line.y + line.height <= other.y ||
						other.y + other.height <= line.y;
					expect(apart).toBe(true);
				}
			}
		});
	}

	test('held on its side, the unrolling gores are never cut by the window', async ({ page }) => {
		await page.setViewportSize(PHONE_LANDSCAPE);
		await visitHome(page);
		await page.clock.runFor(3_900);

		// From the cut (4.1 s) to just before the lenses straighten (5.55 s): from then on, the strips
		// are meant to run off the window.
		for (let i = 0; i < 7; i++) {
			await page.clock.runFor(200);
			const { top, bottom } = await drawnRows(page);
			expect(top).toBeGreaterThan(0);
			expect(bottom).toBeLessThan(PHONE_LANDSCAPE.height);
		}
	});

	// The header coordinates are hidden on a phone: the label has nowhere to land.
	test('the label fades where it stands instead of flying to the header', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(6_800);
		await expect(label(page)).toBeInViewport();
		const standing = await box(label(page));

		await page.clock.runFor(400);
		const later = await box(label(page));
		expect(later.x).toBeCloseTo(standing.x, 0);
		expect(later.y).toBeCloseTo(standing.y, 0);

		await page.clock.runFor(500);
		await expect(label(page)).toHaveCSS('opacity', '0');
	});

	test('turning the phone during the Intro breaks nothing', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await visitHome(page);
		await page.clock.runFor(3_500);

		await page.setViewportSize(PHONE_LANDSCAPE);
		await page.clock.runFor(1_500);
		await expect(veil(page)).toBeVisible();
		expect(await box(grid(page))).toEqual({ x: 0, y: 0, ...PHONE_LANDSCAPE });

		await page.setViewportSize(PHONE);
		await page.clock.runFor(5_000);
		await expect(veil(page)).toBeHidden();
		await expect(grid(page)).toBeHidden();
		await expectFinalState(page);
		expect(errors).toEqual([]);
	});
});

test.describe('Intro, under a finger', () => {
	const { userAgent, deviceScaleFactor } = devices['iPhone SE'];
	test.use({
		reducedMotion: 'no-preference',
		viewport: PHONE,
		userAgent,
		deviceScaleFactor,
		hasTouch: true,
		isMobile: true,
	});

	test('a swipe skips it without scrolling the page under it', async ({ page, browserName }) => {
		test.skip(browserName === 'firefox', 'Playwright does not emulate touch under Firefox');
		// A paused clock: the skip's fade must not end on its own halfway through the swipe.
		await page.clock.install({ time: 0 });
		await page.clock.pauseAt(1_000);
		await page.goto('/');
		await page.clock.runFor(2_000);
		const farthest = await recordFarthestScroll(page);

		await swipeUp(page, 400);
		await page.clock.runFor(400);

		await expect(veil(page)).toBeHidden();
		expect(await farthest()).toBe(0);
		expect(await scrollPosition(page)).toBe(0);
	});
});

test.describe('Intro, reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('does not play: the page is at its final state', async ({ page }) => {
		await visitHome(page);

		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
	});
});

test.describe('Intro, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('no veil: the page is at its final state', async ({ page }) => {
		// `page.clock` and `page.evaluate` need JavaScript: a plain visit.
		await page.goto('/');

		await expect(veil(page)).toBeHidden();
		await expect(page.locator('h1')).toBeVisible();
	});
});
