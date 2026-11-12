// A direct visit plays the Intro: `./fixtures` arrives from another page of the site, which skips it.
import { test as directVisit } from '@playwright/test';
import { expect, test, type Locator, type Page } from './fixtures';
import { lengthenPage, topInPage } from './helpers';
import { montageFigure, sceneStart, scrollToScene } from './montage-helpers';

/**
 * Nothing loops out of sight: what moves on its own stops once it has left the window and takes up
 * again where it was when it comes back.
 */

const marqueeTrack = (page: Page) => page.locator('.marquee-track');

/** Play states of the CSS animations running on the element or inside it. */
const playStates = (element: Locator) =>
	element.evaluate((el) =>
		el.getAnimations({ subtree: true }).map((animation) => animation.playState),
	);

/** Brings a point of the page to the top of the window. */
const scrollToY = (page: Page, y: number) => page.evaluate((top) => scrollTo(0, top), y);

const scrollToBottom = (page: Page) =>
	page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));

test.describe('off screen', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } });

	test('the marquee stops once out of view, and slides on when it comes back', async ({ page }) => {
		await page.goto('/');
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);

		await scrollToBottom(page);
		await expect(marqueeTrack(page)).not.toBeInViewport();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['paused']);

		await scrollToY(page, (await topInPage(marqueeTrack(page))) - 300);
		await expect(marqueeTrack(page)).toBeInViewport();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);
	});

	test('the steam stops once the Café is out of view, fire lit, and drifts again when it comes back', async ({
		page,
	}) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 1);
		const wisps = ['running', 'running', 'running'];
		await expect.poll(() => playStates(montageFigure(page))).toEqual(wisps);

		// Past the Café, fire lit: the Contact alone is too short to scroll the moka out of a desktop window.
		const height = () => page.evaluate(() => document.documentElement.scrollHeight);
		const before = await height();
		await lengthenPage(page);
		// The home page was already long enough for `lengthenPage`: wait for the smoother to take in the extra room.
		await expect.poll(height).toBeGreaterThan(before + 1000);
		await scrollToBottom(page);
		await expect(montageFigure(page)).not.toBeInViewport();
		await expect.poll(() => playStates(montageFigure(page))).toEqual(['paused', 'paused', 'paused']);

		await scrollToScene(page, await sceneStart(page), 1);
		await expect.poll(() => playStates(montageFigure(page))).toEqual(wisps);
	});

	test('the lede stops typing once out of view, even mid-word, and types on when it comes back', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#statusline [data-vim-mode]')).toHaveText('INSERT', { timeout: 10_000 });

		await scrollToBottom(page);
		await expect(lede(page)).not.toBeInViewport();
		expect(await ledeChangesOver(page, 3000)).toBe(0);

		await scrollToY(page, 0);
		await expect(lede(page)).toBeInViewport();
		expect(await ledeChangesOver(page, 3000)).toBeGreaterThan(0);
	});
});

const lede = (page: Page) => page.locator('[data-lede]');

/** How many times, over the next `ms`, the lede or its mode in the statusline changed in the DOM. */
const ledeChangesOver = (page: Page, ms: number) =>
	page.evaluate(
		(duration) =>
			new Promise<number>((resolve) => {
				let changes = 0;
				const observer = new MutationObserver((records) => {
					changes += records.length;
				});
				for (const watched of document.querySelectorAll('[data-lede], #statusline')) {
					observer.observe(watched, { subtree: true, childList: true, characterData: true, attributes: true });
				}
				setTimeout(() => {
					observer.disconnect();
					resolve(changes);
				}, duration);
			}),
		ms,
	);

directVisit.describe('under the Voile', () => {
	directVisit.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } });

	directVisit('the marquee waits for the Intro to end, then slides', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#veil')).toBeVisible();
		expect(await playStates(marqueeTrack(page))).toEqual(['paused']);

		// A click skips the Intro.
		await page.mouse.click(640, 450);
		await expect(page.locator('#veil')).toBeHidden();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);
	});
});
