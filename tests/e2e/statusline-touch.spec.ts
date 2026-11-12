import { devices, expect, test, type Page } from './fixtures';
import { statusline } from './helpers';
import { ADDRESS, YANKED, address, branch, city, countFollowed, pasted, shownMode, visitContact } from './statusline-helpers';

// Chromium project only (see playwright.config.ts): Firefox does not emulate `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

const message = (page: Page) => statusline(page).locator('.message');

/**
 * Selects the city as a long press and its handles would. Set by script: the emulated phone answers a
 * long press with a context menu, never with a selection, so the gesture itself is left to a real phone.
 */
const selectCity = (page: Page) => city(page).evaluate((el) => getSelection()?.selectAllChildren(el));

/** What is wrong with the row while a message is on it: a segment out of the window, or over its neighbour. */
function rowFaults(page: Page) {
	return page.evaluate(() => {
		const segments = [...document.querySelectorAll<HTMLElement>('#statusline .side > *')]
			.map((el) => ({ name: el.classList[0], box: el.getBoundingClientRect() }))
			.filter(({ box }) => box.width > 0);
		const faults: string[] = [];
		for (const [index, a] of segments.entries()) {
			if (a.box.left < -0.5 || a.box.right > innerWidth + 0.5) faults.push(`${a.name} runs out of the window`);
			const next = segments[index + 1];
			if (next && next.box.left < a.box.right - 0.5) faults.push(`${a.name} overlaps ${next.name}`);
		}
		return faults;
	});
}

test.describe('the statusline answers a finger', () => {
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });

	test('a tap copies the address and the count fits the row whole; a second tap opens the mail', async ({ page }) => {
		await visitContact(page);
		const followed = await countFollowed(page);

		await address(page).tap();

		await expect(message(page)).toHaveText(YANKED);
		expect(await message(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
		expect(await rowFaults(page)).toEqual([]);
		await expect(page.getByRole('checkbox', { name: /^pause/ })).toBeVisible();
		expect(await followed()).toBe(0);

		await address(page).tap();

		expect(await followed()).toBe(1);
		await expect(message(page)).toBeHidden();
		await expect(statusline(page).locator('.paper')).toBeVisible();
	});

	test('the tapped address is on the clipboard', async ({ page }) => {
		await visitContact(page);

		await address(page).tap();
		await expect(message(page)).toHaveText(YANKED);

		expect(await pasted(page)).toBe(ADDRESS);
	});

	test('selected text puts the row in VISUAL with its count, until a tap elsewhere lifts it', async ({ page }) => {
		await visitContact(page);

		await selectCity(page);

		await expect(shownMode(page)).toHaveText('VISUAL');
		await expect(message(page)).toHaveText('16 caractères');
		expect(await rowFaults(page)).toEqual([]);

		await page.locator('.contact-lede').tap();

		await expect(shownMode(page)).toHaveText(/NORMAL|INSERT/);
		await expect(message(page)).toBeHidden();
	});
});

// Neither motion nor a fine pointer: the animation base's scenes are all off, the reactions are not.
for (const [width, answer] of [
	// The narrowest phone's row has no room for the verb.
	[320, '"+y · 24 caractères'],
	[360, YANKED],
] as const) {
	test.describe(`the statusline answers a finger on a ${width}px phone, motion reduced`, () => {
		test.use({ viewport: { width, height: 568 }, userAgent, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

		test('a tap copies the address, and the row holds the mode, the Pause and the count whole', async ({ page }) => {
			await visitContact(page);

			await address(page).tap();

			await expect(message(page)).toHaveText(answer);
			expect(await message(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
			expect(await rowFaults(page)).toEqual([]);
			await expect(shownMode(page)).toBeVisible();
			await expect(page.getByRole('checkbox', { name: /^pause/ })).toBeVisible();
			await expect(branch(page)).toBeHidden();
		});

		test('selected text puts the row in VISUAL without pushing a segment out', async ({ page }) => {
			await visitContact(page);

			await selectCity(page);

			await expect(shownMode(page)).toHaveText('VISUAL');
			await expect(message(page)).toHaveText('16 caractères');
			expect(await message(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
			expect(await rowFaults(page)).toEqual([]);
			await expect(page.getByRole('checkbox', { name: /^pause/ })).toBeVisible();
		});
	});
}
