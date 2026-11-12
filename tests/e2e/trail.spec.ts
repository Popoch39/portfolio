// A direct visit plays the Intro: `./fixtures` arrives from another page of the site, which skips it.
import { test as direct } from '@playwright/test';
import { expect, test, type Locator, type Page } from './fixtures';
import type { Paper } from './nuancier-helpers';

/**
 * The Traîne: the site's cursor under a mouse. A point of ink, which is the cursor's own image, and
 * a thin ring that trails it and opens over what answers a click.
 */

const noon = new Date('2026-11-09T12:00:00+01:00');

/** The point's ink and its halo on each paper, from the charte (`global.css`). */
const day = { ink: '#141412', halo: '#efeee9' };
const night = { ink: '#efeee9', halo: '#141412' };
const blue = { ink: '#eef2f8', halo: '#12305a' };

async function visit(page: Page, path = '/', paper?: Exclude<Paper, 'auto'>) {
	await page.clock.setFixedTime(noon);
	if (paper) await page.addInitScript((bg) => localStorage.setItem('bg', bg), paper);
	await page.goto(path);
}

/** What the pointer looks like over the element: the colours of its image, and what stands in for it. */
async function cursorOver(element: Locator) {
	const cursor = await element.evaluate((el) => getComputedStyle(el).cursor);
	const image = decodeURIComponent(cursor.match(/^url\("(data:image\/svg\+xml,.*)"\) 7 7, \w+$/)?.[1] ?? '');
	return {
		ink: image.match(/fill='(#\w+)'/)?.[1],
		halo: image.match(/stroke='(#\w+)'/)?.[1],
		fallback: cursor.split(', ').at(-1),
	};
}

const paragraph = (page: Page) => page.locator('main p').first();
const link = (page: Page) => page.locator('main a[href]').first();
const pause = (page: Page) => page.locator('#statusline label:has(#pause)');
const strip = (page: Page) => page.locator('[data-nuancier] label').first();
const friseBand = (page: Page) => page.locator('#parcours');
const statusline = (page: Page) => page.locator('#statusline');

test.describe('the Traîne', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	for (const [paper, point, onDark] of [
		['light', day, night],
		['dark', night, night],
		['cyan', blue, blue],
	] as const) {
		test(`${paper} paper: the pointer is a point of that paper’s ink, haloed, text and links included`, async ({ page }) => {
			await visit(page, '/', paper);

			expect(await cursorOver(page.locator('body'))).toEqual({ ...point, fallback: 'default' });
			// Text keeps the point: no I-beam breaks in over a paragraph or a title.
			expect(await cursorOver(paragraph(page))).toEqual({ ...point, fallback: 'default' });
			expect(await cursorOver(page.locator('h1'))).toEqual({ ...point, fallback: 'default' });
			// What answers a click keeps it too, the hand behind it for a browser that draws no image.
			expect(await cursorOver(link(page))).toEqual({ ...point, fallback: 'pointer' });
			// Printed dark on every paper: the Frise's band and the statusline take the night's point.
			expect(await cursorOver(friseBand(page))).toEqual({ ...onDark, fallback: 'default' });
			expect(await cursorOver(friseBand(page).locator('h2'))).toEqual({ ...onDark, fallback: 'default' });
			expect(await cursorOver(statusline(page))).toEqual({ ...onDark, fallback: 'default' });
			expect(await cursorOver(pause(page))).toEqual({ ...onDark, fallback: 'pointer' });
			expect(await cursorOver(strip(page))).toEqual({ ...point, fallback: 'pointer' });
		});
	}

	test('the 404 page has the point too', async ({ page }) => {
		await visit(page, '/this-page-does-not-exist/', 'light');

		expect(await cursorOver(page.locator('h1'))).toEqual({ ...day, fallback: 'default' });
		expect(await cursorOver(link(page))).toEqual({ ...day, fallback: 'pointer' });
	});

	test('the ring shows at the first move and lands on the point', async ({ page }) => {
		await visit(page);
		await expect(ring(page)).toBeHidden();

		await page.mouse.move(400, 300);

		await expect(ring(page)).toBeVisible();
		await expectRingAt(page, { x: 400, y: 300 });
	});

	test('the ring trails the point: it crosses the way to it, then lands', async ({ page }) => {
		await visit(page);
		await page.mouse.move(200, 300);
		await expectRingAt(page, { x: 200, y: 300 });

		const path = ringPath(page);
		await page.mouse.move(900, 300);
		const xs = await path;

		expect(xs.some((x) => x > 250 && x < 850)).toBe(true);
		// Never back, never past the point.
		expect(xs).toEqual([...xs].sort((a, b) => a - b));
		expect(Math.max(...xs)).toBeLessThanOrEqual(900);
		await expectRingAt(page, { x: 900, y: 300 });
	});

	test('the ring opens over a link and closes back on the page', async ({ page }) => {
		await visit(page);
		const text = await centre(paragraph(page));
		await page.mouse.move(text.x, text.y);
		await expect.poll(() => ringDiameter(page)).toBeCloseTo(26.4, 1);

		const target = await centre(link(page));
		await page.mouse.move(target.x, target.y);
		await expect.poll(() => ringDiameter(page)).toBeCloseTo(44, 1);
		await expectRingAt(page, target);

		await page.mouse.move(text.x, text.y);
		await expect.poll(() => ringDiameter(page)).toBeCloseTo(26.4, 1);
	});

	test('the ring opens over the Pause and over a paper of the Nuancier', async ({ page }) => {
		await visit(page);

		for (const control of [pause(page), strip(page)]) {
			const { x, y } = await centre(control);
			await page.mouse.move(x, y);
			await expect.poll(() => ringDiameter(page)).toBeCloseTo(44, 1);
		}
	});

	test('a still pointer costs nothing: once the ring has landed, it asks for no more frames', async ({ page }) => {
		await countPointerFrames(page);
		await page.goto('/');
		await page.mouse.move(200, 300);
		await page.mouse.move(600, 300);
		await expectRingAt(page, { x: 600, y: 300 });
		// It did ask for frames to cross the way: the count sees the ring.
		const trailing = await pointerFrames(page);
		expect(trailing).toBeGreaterThan(2);

		await framesPass(page, 30);

		expect(await pointerFrames(page)).toBe(trailing);
	});

	test('the pointer leaves the window: the ring goes, and asks for no more frames', async ({ page }) => {
		await countPointerFrames(page);
		await page.goto('/');
		await page.mouse.move(200, 300);
		await page.mouse.move(600, 300);
		await expect(ring(page)).toBeVisible();

		await page.mouse.move(-10, 300);

		await expect(ring(page)).toBeHidden();
		const leaving = await pointerFrames(page);
		await framesPass(page, 30);
		expect(await pointerFrames(page)).toBe(leaving);

		// Back in the window, it is on the point at once: it does not fly in from where it was left.
		const path = ringPath(page);
		await page.mouse.move(900, 500);
		expect(new Set(await path)).toEqual(new Set([900]));
	});

	test('the keyboard moves no ring: focus keeps its own outline', async ({ page }) => {
		await visit(page);

		await page.keyboard.press('Tab');

		await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid');
		await expect(ring(page)).toBeHidden();
	});
});

test.describe('the Traîne, reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('the ring sits on the point at once, and opens at once over a link', async ({ page }) => {
		await visit(page);
		await page.mouse.move(200, 300);
		await expectRingAt(page, { x: 200, y: 300 });

		const path = ringPath(page);
		await page.mouse.move(900, 300);
		const xs = await path;

		// Where it was, then where the point is: nothing in between.
		expect(xs.filter((x) => x !== 200 && x !== 900)).toEqual([]);
		await expectRingAt(page, { x: 900, y: 300 });

		const target = await centre(link(page));
		await page.mouse.move(target.x, target.y);
		await expect(ring(page).locator('span')).toHaveCSS('transition-duration', '0s');
		await expect.poll(() => ringDiameter(page)).toBeCloseTo(44, 1);
	});
});

test.describe('the Traîne, forced colours', () => {
	test.use({ forcedColors: 'active', viewport: { width: 1440, height: 900 } });

	test('the system’s cursor stays, and there is no ring', async ({ page }) => {
		await visit(page);

		await expect(page.locator('body')).toHaveCSS('cursor', 'auto');
		await expect(paragraph(page)).toHaveCSS('cursor', 'auto');
		await expect(link(page)).toHaveCSS('cursor', 'pointer');
		await expect(pause(page)).toHaveCSS('cursor', 'pointer');

		await page.mouse.move(400, 300);
		await page.mouse.move(420, 320);
		await expect(ring(page)).toBeHidden();
	});
});

test.describe('the Traîne, without JavaScript', () => {
	test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

	test('the point alone: it is the cursor’s image, and no ring follows it', async ({ page }) => {
		await page.goto('/');

		expect(await cursorOver(paragraph(page))).toEqual({ ...day, fallback: 'default' });
		expect(await cursorOver(link(page))).toEqual({ ...day, fallback: 'pointer' });

		await page.mouse.move(400, 300);
		await page.mouse.move(420, 320);
		await expect(ring(page)).toBeHidden();
	});
});

direct.describe('the Traîne, under the Voile', () => {
	direct.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	direct('the point alone while the Intro plays, the ring once it has ended', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#veil')).toBeVisible();

		await page.mouse.move(400, 300);
		await page.mouse.move(420, 320);
		await expect(ring(page)).toBeHidden();

		// A click skips the Intro.
		await page.mouse.click(420, 320);
		await expect(page.locator('#veil')).toBeHidden();
		await page.mouse.move(500, 300);
		await expect(ring(page)).toBeVisible();
		await expectRingAt(page, { x: 500, y: 300 });
	});
});

// Hidden from assistive technologies, like every drawing of the page: targeted by its attribute.
const ring = (page: Page) => page.locator('[data-trail]');

async function centre(element: Locator) {
	await element.scrollIntoViewIfNeeded();
	const box = await element.boundingBox();
	if (!box) throw new Error('element without a box');
	return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** Where the ring's circle is drawn in the window, and how wide. */
const ringBox = (page: Page) =>
	ring(page)
		.locator('span')
		.evaluate((circle) => {
			const { left, top, width } = circle.getBoundingClientRect();
			return { x: left + width / 2, y: top + width / 2, diameter: width };
		});

const ringDiameter = async (page: Page) => (await ringBox(page)).diameter;

async function expectRingAt(page: Page, point: { x: number; y: number }) {
	await expect.poll(async () => (await ringBox(page)).x).toBeCloseTo(point.x, 1);
	await expect.poll(async () => (await ringBox(page)).y).toBeCloseTo(point.y, 1);
}

/** Where the ring stands across the window, frame after frame, over the next 45 frames. */
const ringPath = (page: Page) =>
	ring(page).evaluate(
		(el) =>
			new Promise<number[]>((resolve) => {
				const xs: number[] = [];
				const sample = () => {
					const transform = getComputedStyle(el).transform;
					if (transform !== 'none') xs.push(new DOMMatrixReadOnly(transform).m41);
					if (xs.length < 45) requestAnimationFrame(sample);
					else resolve(xs);
				};
				requestAnimationFrame(sample);
			}),
	);

declare global {
	interface Window {
		testPointerFrames?: number;
		testNextFrame?: typeof requestAnimationFrame;
	}
}

/**
 * Counts the animation frames asked for in answer to the pointer: by a callback first handed over
 * while a pointer event was being handled, then each time that callback asks for the next one.
 * The smoother's ticker, which asks for a frame whatever happens, is left out.
 * Not with a fixed clock (`visit`): it takes `requestAnimationFrame` over.
 */
const countPointerFrames = (page: Page) =>
	page.addInitScript(() => {
		window.testPointerFrames = 0;
		const answers = new WeakSet<FrameRequestCallback>();
		const request = window.requestAnimationFrame.bind(window);
		window.testNextFrame = request;
		window.requestAnimationFrame = (callback) => {
			if (window.event instanceof PointerEvent) answers.add(callback);
			if (answers.has(callback)) window.testPointerFrames = (window.testPointerFrames ?? 0) + 1;
			return request(callback);
		};
	});

const pointerFrames = (page: Page) => page.evaluate(() => window.testPointerFrames ?? 0);

/** Lets the page draw that many frames, without asking for one through the counted way. */
const framesPass = (page: Page, frames: number) =>
	page.evaluate(
		(count) =>
			new Promise<void>((resolve) => {
				let drawn = 0;
				const next = () => {
					drawn += 1;
					if (drawn < count) window.testNextFrame?.(next);
					else resolve();
				};
				window.testNextFrame?.(next);
			}),
		frames,
	);
