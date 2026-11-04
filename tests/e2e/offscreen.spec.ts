// A direct visit plays the Intro: `./fixtures` arrives from another page of the site, which skips it.
import { test as directVisit } from '@playwright/test';
import { expect, test, type Locator, type Page } from './fixtures';
import { topInPage } from './helpers';

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
});

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
