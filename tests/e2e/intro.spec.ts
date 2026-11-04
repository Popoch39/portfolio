// Not `./fixtures`: these visits are direct, without a referrer from the site.
import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { scrollPosition, scrollWithWheel, statusline, swipeUp } from './helpers';

// Decorative and hidden from assistive technologies: targeted by its id, like the statusline.
const veil = (page: Page) => page.locator('#veil');
// The globe, then the accent grid it becomes, drawn over the page.
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
	page.locator('.hero-actions'),
	// The Besançon marker and its label on the map, once the point has handed over to them.
	page.locator('[data-intro="late"]'),
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
		testGridDraws?: number;
	}
}

/**
 * First and last rows of the window where the globe has drawn something, in CSS px. Read from a
 * screenshot of the globe alone on white: drawn by a Worker, its canvas cannot be read from the page.
 */
async function drawnRows(page: Page) {
	// Through the elements' styles: the page's policy blocks the stylesheet `screenshot({ style })` adds.
	const alone = (on: boolean) =>
		page.evaluate((on) => {
			const set = (element: HTMLElement, property: string, value: string) => {
				if (on) element.style.setProperty(property, value, 'important');
				else element.style.removeProperty(property);
			};
			set(document.documentElement, 'background', '#fff');
			set(document.body, 'visibility', 'hidden');
			const canvas = document.getElementById('intro-grid');
			if (canvas) set(canvas, 'visibility', 'visible');
		}, on);
	await alone(true);
	const shot = await grid(page).screenshot({ scale: 'css' });
	await alone(false);
	const reader = await page.context().newPage();
	try {
		return await reader.evaluate(async (png) => {
			const image = new Image();
			image.src = `data:image/png;base64,${png}`;
			await image.decode();
			const { width, height } = image;
			const canvas = new OffscreenCanvas(width, height);
			const context = canvas.getContext('2d');
			if (!context) throw new Error('canvas without a 2D context');
			context.drawImage(image, 0, 0);
			const { data } = context.getImageData(0, 0, width, height);
			// Darker than the white page by more than a faint anti-aliased edge.
			const inked = (y: number) => {
				for (let x = 0; x < width; x++) {
					const i = (y * width + x) * 4;
					if (Math.min(data[i], data[i + 1], data[i + 2]) < 250) return true;
				}
				return false;
			};
			let top = 0;
			while (top < height && !inked(top)) top++;
			let bottom = height - 1;
			while (bottom > top && !inked(bottom)) bottom--;
			return { top, bottom: bottom + 1 };
		}, shot.toString('base64'));
	} finally {
		await reader.close();
	}
}

/** The Worker that draws the globe does not load: the page has to draw it itself. */
const blockWorker = (page: Page) => page.route(/\.worker-[\w-]+\.js$/, (route) => route.abort());

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

		test('the wheel neither skips the Intro nor scrolls the page, which scrolls again once it has ended', async ({
			page,
		}) => {
			await visitHome(page);
			await page.clock.runFor(2_000);

			await scrollWithWheel(page, 600);
			await page.clock.runFor(400);
			await expect(veil(page)).toBeVisible();
			expect(await scrollPosition(page)).toBe(0);

			await page.clock.runFor(8_000);
			await expect(veil(page)).toBeHidden();
			await expectFinalState(page);
			await scrollWithWheel(page, 600);
			await page.clock.runFor(1_000);
			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		});

		test('the scrolling keys neither skip the Intro nor scroll the page under it', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(2_000);
			const farthest = await recordFarthestScroll(page);

			for (const key of ['PageDown', 'End', 'Space', 'ArrowDown']) await page.keyboard.press(key);
			await page.clock.runFor(400);

			await expect(veil(page)).toBeVisible();
			expect(await farthest()).toBe(0);
		});

		// The Intro has the main thread to itself: the other scenes would cost it frames while nobody can
		// scroll to them anyway.
		test('the scenes further down are only built once it has ended', async ({ page }) => {
			const pinned = page.locator('.pin-spacer');
			await visitHome(page);
			await page.clock.runFor(6_000);
			await expect(veil(page)).toBeVisible();
			expect(await pinned.count()).toBe(0);

			await page.clock.runFor(4_000);
			await expect(veil(page)).toBeHidden();
			await expect.poll(() => pinned.count()).toBeGreaterThan(0);
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
				Promise.all([page.locator('h1'), page.locator('.hero-map'), statusline(page)].map((l) => l.boundingBox()));
			await visitHome(page);
			await page.evaluate(() => document.fonts.ready);
			const underVeil = await boxes();

			await page.clock.runFor(10_000);

			await expect(veil(page)).toBeHidden();
			expect(await boxes()).toEqual(underVeil);
		});

		test('the label lands on the Besançon label of the map, then hands over to it', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(6_800);
			await expect(label(page)).toBeInViewport();

			// The point has run to the marker and its label has faded: it rests where it landed.
			await page.clock.runFor(1_500);
			await expect(label(page)).toHaveCSS('opacity', '0');
			const landed = await box(label(page));
			const place = await box(page.locator('.hero-place'));
			expect(landed.x).toBeCloseTo(place.x, 0);
			expect(landed.y).toBeCloseTo(place.y, 0);
			await expect(page.locator('.hero-place')).toHaveCSS('opacity', '1');
		});

		test('flipping to reduced motion during the Intro brings the page back to its final state', async ({ page }) => {
			await visitHome(page);
			await page.clock.runFor(7_000);

			await page.emulateMedia({ reducedMotion: 'reduce' });

			await expect(veil(page)).toBeHidden();
			await expectFinalState(page);
		});

		test('does not play with an anchor in the URL', async ({ page }) => {
			await visitHome(page, '/#parcours');

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

		// On the real clock, like the history test: a reload is read from the navigation entry.
		test('a reload replays it from the top of the page, not from where the visitor had scrolled', async ({
			page,
		}) => {
			await page.goto('/');
			await page.keyboard.press('a');
			await expect(veil(page)).toBeHidden();
			await scrollWithWheel(page, 1_500);
			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(500);

			await page.reload();

			await expect(veil(page)).toBeVisible();
			await page.waitForLoadState('load');
			// Restoring the scroll happens around `load`: the page must stay at the top past it.
			await page.waitForTimeout(500);
			expect(await scrollPosition(page)).toBe(0);
		});

		test('a reload after arriving from another page of the site also replays it from the top', async ({
			page,
		}) => {
			await page.goto('/this-page-does-not-exist/');
			await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
			await expect(page).toHaveURL('/');
			await expect(veil(page)).toBeHidden();
			await scrollWithWheel(page, 1_500);
			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(500);

			await page.reload();

			await expect(veil(page)).toBeVisible();
			await page.waitForLoadState('load');
			await page.waitForTimeout(500);
			expect(await scrollPosition(page)).toBe(0);
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
		// A paused clock: real time running during the load would push the last sample past 5.55 s.
		await page.clock.install({ time: 0 });
		await page.clock.pauseAt(1_000);
		await page.goto('/');
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

test.describe('Intro, on a 3× screen', () => {
	test.use({ reducedMotion: 'no-preference', viewport: PHONE, deviceScaleFactor: 3 });

	// Drawn at 3×, the full-window globe would cost more than twice the pixels for a sharpness nobody
	// tells apart at reading distance. Read where the page draws it: a Worker's bitmap is out of reach.
	test('the globe is drawn at 2× its size at most', async ({ page }) => {
		await blockWorker(page);
		await visitHome(page);
		await page.clock.runFor(1_000);

		const { bitmap, box } = await grid(page).evaluate((canvas: HTMLCanvasElement) => ({
			bitmap: { width: canvas.width, height: canvas.height },
			box: { width: canvas.clientWidth, height: canvas.clientHeight },
		}));
		expect(bitmap).toEqual({ width: 2 * box.width, height: 2 * box.height });
	});
});

test.describe('Intro, while the globe stands still', () => {
	test.use({ reducedMotion: 'no-preference', viewport: SCREENS[0][1] });

	test('the canvas is not drawn again until the globe moves', async ({ page }) => {
		// Counted where the page draws it: a Worker's drawing is out of reach. Every frame painted into
		// the globe's canvas starts by clearing it.
		await blockWorker(page);
		await page.addInitScript(() => {
			window.testGridDraws = 0;
			const clear = CanvasRenderingContext2D.prototype.clearRect;
			CanvasRenderingContext2D.prototype.clearRect = function (...args) {
				if (this.canvas.id === 'intro-grid') window.testGridDraws = (window.testGridDraws ?? 0) + 1;
				return clear.apply(this, args);
			};
		});
		const draws = () => page.evaluate(() => window.testGridDraws ?? 0);
		await page.clock.install({ time: 0 });
		await page.clock.pauseAt(1_000);
		await page.goto('/');

		// From the hand-over of the point (7.95 s) to the fade of the grid (8.64 s), nothing moves on the canvas.
		await page.clock.runFor(8_050);
		const still = await draws();
		await page.clock.runFor(500);
		expect(await draws()).toBe(still);

		// The grid fades: drawn again.
		await page.clock.runFor(300);
		expect(await draws()).toBeGreaterThan(still);
	});
});

test.describe('Intro, off the main thread', () => {
	test.use({ reducedMotion: 'no-preference', viewport: SCREENS[0][1] });

	test('the globe is drawn by a Worker, which does not outlive the Intro', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(1_000);
		await expect.poll(() => page.workers().length).toBe(1);

		await page.clock.runFor(9_000);
		await expect(veil(page)).toBeHidden();
		await expect.poll(() => page.workers().length).toBe(0);
	});

	test('skipped, the Intro leaves no Worker behind either', async ({ page }) => {
		await visitHome(page);
		await page.clock.runFor(1_000);
		await expect.poll(() => page.workers().length).toBe(1);

		await page.mouse.click(200, 300);
		await page.clock.runFor(400);

		await expect(veil(page)).toBeHidden();
		await expect.poll(() => page.workers().length).toBe(0);
	});

	const withoutWorker: [string, (page: Page) => Promise<unknown>][] = [
		['when its Worker does not load', blockWorker],
		[
			'in a browser that cannot draw off the main thread',
			(page) =>
				page.addInitScript(() => {
					Reflect.deleteProperty(window, 'OffscreenCanvas');
					Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
				}),
		],
	];
	for (const [name, setUp] of withoutWorker) {
		test(`${name}, the page draws the globe: the Intro plays to the end`, async ({ page }) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await setUp(page);
			await visitHome(page);

			await page.clock.runFor(2_000);
			const { top, bottom } = await drawnRows(page);
			expect(bottom).toBeGreaterThan(top);

			// A failing Worker is not a failing Intro: the veil's safety net (5 s) leaves it alone.
			await page.clock.runFor(4_000);
			await expect(veil(page)).toBeVisible();

			await page.clock.runFor(4_000);
			await expect(veil(page)).toBeHidden();
			await expect(grid(page)).toBeHidden();
			await expectFinalState(page);
			expect(errors).toEqual([]);
		});

		test(`${name}, a click still skips the Intro`, async ({ page }) => {
			await setUp(page);
			await visitHome(page);
			await page.clock.runFor(2_000);

			await page.mouse.click(200, 300);
			await page.clock.runFor(400);

			await expect(veil(page)).toBeHidden();
			await expect(grid(page)).toBeHidden();
			await expectFinalState(page);
		});
	}
});

/** The animation base's chunk: GSAP, and every module of the page through it, the Intro's included. */
const BASE_CHUNK = /\/_astro\/base\.[\w-]+\.js$/;

test.describe('Intro, when it cannot play', () => {
	test.use({ reducedMotion: 'no-preference', viewport: PHONE });

	test('the chunk of the animation base does not load: the veil lifts on the page at its final state', async ({
		page,
	}) => {
		await page.route(BASE_CHUNK, (route) => route.abort());
		await visitHome(page);

		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
	});

	test('the chunk of the animation base hangs: the veil lifts after 5 s, and the late chunk leaves the page alone', async ({
		page,
	}) => {
		let arrive = () => {};
		const arrived = new Promise<void>((resolve) => {
			arrive = resolve;
		});
		await page.route(BASE_CHUNK, async (route) => {
			await arrived;
			await route.continue();
		});
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.clock.install();
		// Not until `load`: the hanging module holds it back.
		await page.goto('/', { waitUntil: 'commit' });
		await expect(veil(page)).toBeVisible();

		await page.clock.runFor(4_500);
		await expect(veil(page)).toBeVisible();
		await page.clock.runFor(500);
		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);

		// The Intro does not start late over a page already shown: the scenes are built instead.
		arrive();
		await expect.poll(() => page.locator('.pin-spacer').count()).toBeGreaterThan(0);
		await page.clock.runFor(2_000);
		await expect(veil(page)).toBeHidden();
		await expect(grid(page)).toBeHidden();
		await expectFinalState(page);
		expect(errors).toEqual([]);
	});

	test('the scene throws as it starts: the veil lifts after 5 s, on a page that scrolls', async ({ page }) => {
		// The scene reads the page's palette through a canvas as it starts (`readPalette`).
		await page.addInitScript(() => {
			CanvasRenderingContext2D.prototype.getImageData = () => {
				throw new Error('simulated failure at the start of the Intro');
			};
		});
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await visitHome(page);
		await expect.poll(() => errors).toEqual(['simulated failure at the start of the Intro']);

		await page.clock.runFor(4_500);
		await expect(veil(page)).toBeVisible();
		await page.clock.runFor(500);
		await expect(veil(page)).toBeHidden();
		await expect(grid(page)).toBeHidden();
		await expectFinalState(page);

		await scrollWithWheel(page, 600);
		await page.clock.runFor(1_000);
		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
	});

	test('the Intro starts but never moves on: the veil lifts after 20 s whatever happens, on a page that scrolls', async ({
		page,
	}) => {
		await page.clock.install();
		// After the clock's: no frame ever comes, the timeline stays at its start.
		await page.addInitScript(() => {
			window.requestAnimationFrame = () => 0;
		});
		await page.goto('/');

		await page.clock.runFor(19_500);
		await expect(veil(page)).toBeVisible();
		await page.clock.runFor(500);
		await expect(veil(page)).toBeHidden();
		await expect(grid(page)).toBeHidden();
		await expectFinalState(page);

		await scrollWithWheel(page, 600);
		await page.clock.runFor(1_000);
		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
	});

	// A tab opened in the background gets no frames: its Intro waits to be seen, the belt with it.
	test('the time spent in a hidden tab does not count towards the 20 s', async ({ page }) => {
		await page.clock.install();
		await page.addInitScript(() => {
			window.requestAnimationFrame = () => 0;
			// Headless pages are never hidden: the page is told so.
			Object.defineProperty(Document.prototype, 'hidden', { get: () => window.testHidden ?? false });
		});
		const hide = (hidden: boolean) =>
			page.evaluate((hidden) => {
				window.testHidden = hidden;
				document.dispatchEvent(new Event('visibilitychange'));
			}, hidden);
		await page.goto('/');
		await page.clock.runFor(2_000);

		await hide(true);
		await page.clock.runFor(30_000);
		await expect(veil(page)).toBeVisible();

		await hide(false);
		await page.clock.runFor(17_500);
		await expect(veil(page)).toBeVisible();
		await page.clock.runFor(500);
		await expect(veil(page)).toBeHidden();
	});
});

declare global {
	interface Window {
		testIntroStarted?: number;
		testVeilLifted?: number;
		testHidden?: boolean;
	}
}

test.describe('Intro, on a slow phone and network', () => {
	const { userAgent, deviceScaleFactor } = devices['Pixel 7'];
	test.use({ reducedMotion: 'no-preference', viewport: PHONE, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true });

	// Lighthouse's mobile profile as DevTools applies it: 150 ms and 1.6 Mbit/s, scaled by its
	// latency and throughput factors (3.75 and 0.9), then CPU ×4. On the real clock: the safety net
	// races the network.
	test('the safety net never cuts the Intro short', async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium', 'throttled through the Chrome DevTools Protocol');
		test.setTimeout(60_000);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Network.enable');
		await cdp.send('Network.emulateNetworkConditions', {
			offline: false,
			latency: 562.5,
			downloadThroughput: (1_638.4 * 0.9 * 1024) / 8,
			uploadThroughput: (750 * 0.9 * 1024) / 8,
		});
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		// When the scene signals its start, and when the veil's class goes, from the navigation's start.
		// Watched from the document: the root element does not exist yet when this runs.
		await page.addInitScript(() => {
			new MutationObserver(() => {
				const root = document.documentElement;
				if (root.hasAttribute('data-intro-started')) window.testIntroStarted ??= performance.now();
				if (window.testIntroStarted !== undefined && !root.classList.contains('intro')) {
					window.testVeilLifted ??= performance.now();
				}
			}).observe(document, { attributes: true, subtree: true, attributeFilter: ['class', 'data-intro-started'] });
		});

		await page.goto('/', { waitUntil: 'commit' });
		await expect(veil(page)).toBeVisible();
		await expect(veil(page)).toBeHidden({ timeout: 40_000 });
		await expect(grid(page)).toBeHidden();

		const { started, lifted } = await page.evaluate(() => ({
			started: window.testIntroStarted,
			lifted: window.testVeilLifted,
		}));
		// Started before the net's 5 s, then played for its whole 9.84 s.
		expect(started).toBeLessThan(5_000);
		expect((lifted ?? 0) - (started ?? 0)).toBeGreaterThan(9_800);
		await expectFinalState(page);
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

	test('a swipe neither skips it nor scrolls the page under it', async ({ page, browserName }) => {
		test.skip(browserName === 'firefox', 'Playwright does not emulate touch under Firefox');
		// A paused clock: the Intro must not end on its own halfway through the swipe.
		await page.clock.install({ time: 0 });
		await page.clock.pauseAt(1_000);
		await page.goto('/');
		await page.clock.runFor(2_000);
		const farthest = await recordFarthestScroll(page);

		await swipeUp(page, 400);
		await page.clock.runFor(400);

		await expect(veil(page)).toBeVisible();
		expect(await farthest()).toBe(0);
		expect(await scrollPosition(page)).toBe(0);
	});

	test('a tap skips it', async ({ page, browserName }) => {
		test.skip(browserName === 'firefox', 'Playwright does not emulate touch under Firefox');
		await page.clock.install({ time: 0 });
		await page.clock.pauseAt(1_000);
		await page.goto('/');
		await page.clock.runFor(2_000);

		await page.touchscreen.tap(195, 400);
		await page.clock.runFor(400);

		await expect(veil(page)).toBeHidden();
		await expectFinalState(page);
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
