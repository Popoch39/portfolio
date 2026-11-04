import { expect, test, type Locator, type Page } from './fixtures';

/**
 * The Pause (WCAG 2.2.2): a checkbox in the statusline stops what moves on its own, the marquee and the
 * lede, and sets it going again.
 */

const pause = (page: Page) => page.getByRole('checkbox', { name: /^pause/ });
const marqueeTrack = (page: Page) => page.locator('.marquee-track');

/** Play states of the CSS animations running on the element or inside it. */
const playStates = (element: Locator) =>
	element.evaluate((el) => el.getAnimations({ subtree: true }).map((animation) => animation.playState));

test.describe('the Pause, without JavaScript', () => {
	test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });

	test('is reached with the keyboard, named, and stops then restarts the marquee', async ({ page }) => {
		await page.goto('/');
		await expect(pause(page)).not.toBeChecked();
		expect(await playStates(marqueeTrack(page))).toEqual(['running']);

		// The statusline closes the page: one step back from its start.
		await page.keyboard.press('Shift+Tab');
		await expect(pause(page)).toBeFocused();
		await page.keyboard.press('Space');

		await expect(pause(page)).toBeChecked();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['paused']);

		await page.keyboard.press('Space');
		await expect(pause(page)).not.toBeChecked();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);
	});
});
