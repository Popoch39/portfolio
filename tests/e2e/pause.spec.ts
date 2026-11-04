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

test.describe('the Pause', () => {
	// Tall enough for the lede to be on screen: off screen, the typist waits anyway.
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } });

	test('stops then restarts the marquee', async ({ page }) => {
		await page.goto('/');
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);

		await pause(page).click();
		await expect(pause(page)).toBeChecked();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['paused']);

		await pause(page).click();
		await expect.poll(() => playStates(marqueeTrack(page))).toEqual(['running']);
	});

	test('freezes the lede at rest on its current version, mid-word or not, then lets it type on', async ({ page }) => {
		await page.goto('/');
		// Halfway from the first version to the second.
		await expect(mode(page)).toHaveText('INSERT', { timeout: 10_000 });

		await pause(page).click();

		await expect(buffer(page)).toHaveText('Je construis les cartes de votre réseau électrique.');
		await expect(buffer(page).locator('[data-kind="block"]')).toHaveText('e');
		await expect(buffer(page).locator('[data-kind="bar"]')).toHaveCount(0);
		await expect(mode(page)).toHaveText('NORMAL');
		await expect(version(page)).toHaveText(/version\s*1\/8/);
		await expect(keys(page)).toHaveCount(0);
		expect(await ledeChangesOver(page, 3000)).toBe(0);

		await pause(page).click();

		await expect(buffer(page)).toHaveText('Je construis le site de votre gîte.', { timeout: 20_000 });
		await expect(version(page)).toHaveText(/version\s*2\/8/);
	});
});

const buffer = (page: Page) => page.locator('.hero-lede [data-buffer]');
const version = (page: Page) => page.locator('.hero-lede [data-version]');
const keys = (page: Page) => page.locator('.hero-lede [data-keys] > *');
const mode = (page: Page) => page.locator('#statusline [data-vim-mode]');

/** How many times, over the next `ms`, the lede or its mode in the statusline changed in the DOM. */
const ledeChangesOver = (page: Page, ms: number) =>
	page.evaluate(
		(duration) =>
			new Promise<number>((resolve) => {
				let changes = 0;
				const observer = new MutationObserver((records) => {
					changes += records.length;
				});
				for (const watched of document.querySelectorAll('[data-lede], #statusline [data-vim-mode]')) {
					observer.observe(watched, { subtree: true, childList: true, characterData: true, attributes: true });
				}
				setTimeout(() => {
					observer.disconnect();
					resolve(changes);
				}, duration);
			}),
		ms,
	);

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
