import { expect, test } from './fixtures';
import { statusline, topOnceStill } from './helpers';
import {
	ADDRESS,
	SECOND_CLICK,
	YANKED,
	address,
	blink,
	branch,
	city,
	countFollowed,
	expectCopyCursor,
	pasted,
	shownMode,
	visitContact,
} from './statusline-helpers';

/**
 * The statusline answers the visitor (spec #93): the Contact's address is yanked on a click, and the
 * mode follows what is selected or focused. Its messages take the place of the branch and the file
 * name, then give the row back.
 */

test.describe('the address, yanked', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('a click copies it and the statusline counts its characters, then gives the row back', async ({ page }) => {
		await visitContact(page);
		const followed = await countFollowed(page);

		await address(page).click();

		await expect(statusline(page)).toContainText(YANKED + SECOND_CLICK);
		await expect(branch(page)).toBeHidden();
		expect(await followed()).toBe(0);
		expect(await pasted(page)).toBe(ADDRESS);

		await expect(statusline(page)).not.toContainText('copiés', { timeout: 8000 });
		await expect(branch(page)).toBeVisible();
		await expect(shownMode(page)).toHaveText(/NORMAL|INSERT/);
	});

	test('the address blinks once as it is copied', async ({ page }) => {
		await visitContact(page);

		await address(page).click();

		await expect.poll(() => blink(page)).toBe('ease-out');
		await expect.poll(() => blink(page)).toBeNull();
	});

	test('a second click while the statusline answers opens the mail, and the row is given back', async ({ page }) => {
		await visitContact(page);
		const followed = await countFollowed(page);
		await address(page).click();
		await expect(statusline(page)).toContainText(YANKED);

		await address(page).click();

		expect(await followed()).toBe(1);
		await expect(statusline(page)).not.toContainText('copiés');
		await expect(branch(page)).toBeVisible();
	});

	test('a modified click is left to the browser: nothing is copied', async ({ page }) => {
		await visitContact(page);
		const followed = await countFollowed(page);

		await address(page).click({ modifiers: ['Shift'] });

		expect(await followed()).toBe(1);
		await expect(branch(page)).toBeVisible();
		await expect(statusline(page)).not.toContainText('copiés');
	});

	test('Enter on the focused address yanks it too', async ({ page }) => {
		await visitContact(page);
		const followed = await countFollowed(page);
		// The keyboard takes over from the paragraph above the address.
		await page.locator('.contact-lede').click();
		await page.keyboard.press('Tab');
		await expect(address(page)).toBeFocused();

		await page.keyboard.press('Enter');

		await expect(statusline(page)).toContainText(YANKED + SECOND_CLICK);
		expect(await followed()).toBe(0);
		expect(await pasted(page)).toBe(ADDRESS);
	});

	test('a window too narrow for the hint keeps the count whole', async ({ page }) => {
		const message = statusline(page).locator('.message');
		await visitContact(page);
		await countFollowed(page);

		// Both sides of each step where the row's right side gives way, up to the last width without the hint.
		for (const width of [601, 700, 859, 861, 1039, 1041, 1179, 1181, 1319]) {
			await page.setViewportSize({ width, height: 800 });
			await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
			await expect(address(page)).toBeInViewport({ ratio: 1 });
			await topOnceStill(address(page));

			await address(page).click();

			await expect(message, `at ${width}px`).toHaveText(YANKED);
			expect(await message.evaluate((el) => el.scrollWidth <= el.clientWidth), `at ${width}px`).toBe(true);
			// The second click gives the row back for the next width.
			await address(page).click();
			await expect(message).toBeHidden();
		}
	});
});

test.describe('the modes follow the visitor', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('a selection puts the statusline in VISUAL with its count; lifted, the mode in force is back', async ({ page }) => {
		await visitContact(page);

		// A double click selects the word under the pointer.
		await city(page).dblclick({ position: { x: 12, y: 8 } });

		await expect(shownMode(page)).toHaveText('VISUAL');
		await expect(statusline(page)).toContainText('8 caractères');
		await expect(branch(page)).toBeHidden();

		await page.locator('.contact-lede').click();

		await expect(shownMode(page)).toHaveText(/NORMAL|INSERT/);
		await expect(statusline(page)).not.toContainText('caractère');
		await expect(branch(page)).toBeVisible();
	});

	test('the count follows a selection grown from the keyboard', async ({ page }) => {
		await visitContact(page);
		await city(page).dblclick({ position: { x: 12, y: 8 } });
		await expect(statusline(page).locator('.message')).toHaveText('8 caractères');

		await page.keyboard.press('Shift+ArrowRight');
		await expect(statusline(page).locator('.message')).toHaveText('9 caractères');
		await expect(shownMode(page)).toHaveText('VISUAL');

		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+ArrowLeft');
		await expect(statusline(page).locator('.message')).toHaveText('7 caractères');
	});

	test('a link focused from the keyboard shows its target, and the row is given back when focus leaves', async ({ page }) => {
		await visitContact(page);
		await page.locator('.contact-lede').click();

		await page.keyboard.press('Tab');
		await expect(statusline(page).locator('.message')).toHaveText(`mailto:${ADDRESS}`);
		await expect(shownMode(page)).toHaveText(/NORMAL|INSERT/);

		await page.keyboard.press('Tab');
		await expect(statusline(page).locator('.message')).toHaveText('github.com/Popoch39');

		await page.locator('.contact-lede').click();
		await expect(branch(page)).toBeVisible();
	});

	test('a link clicked with the pointer does not repeat its target', async ({ page }) => {
		await visitContact(page);
		await countFollowed(page);

		await address(page).click({ modifiers: ['Shift'] });

		await expect(address(page)).toBeFocused();
		await expect(branch(page)).toBeVisible();
	});

	test('VISUAL stays under the messages that pass over it, and gets the row back', async ({ page }) => {
		await visitContact(page);
		await countFollowed(page);
		await city(page).dblclick({ position: { x: 12, y: 8 } });
		await expect(statusline(page).locator('.message')).toHaveText('8 caractères');

		// Back from the selection, link by link: the keyboard leaves the selection alone.
		await page.keyboard.press('Shift+Tab');
		await expect(statusline(page).locator('.message')).toHaveText('github.com/Popoch39/nvim');
		await expect(shownMode(page)).toHaveText('VISUAL');

		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Shift+Tab');
		await expect(address(page)).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(statusline(page).locator('.message')).toHaveText(YANKED + SECOND_CLICK);
		await expect(shownMode(page)).toHaveText('VISUAL');

		await expect(statusline(page).locator('.message')).toHaveText('8 caractères', { timeout: 8000 });
		await expect(shownMode(page)).toHaveText('VISUAL');
	});
});

test.describe('the statusline answers under reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('the address is yanked, and its highlight goes at once rather than fade', async ({ page }) => {
		await visitContact(page);

		await address(page).click();

		await expect.poll(() => blink(page)).toMatch(/^step/);
		await expect(statusline(page)).toContainText(YANKED + SECOND_CLICK);
		expect(await pasted(page)).toBe(ADDRESS);
	});

	test('the preference lifted mid-visit, the address is still yanked once per click', async ({ page }) => {
		await visitContact(page);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		// The smoother has taken the page over: the Contact is brought back under the pointer. Until it
		// shows: the scenes are built once the preference has flipped, and their pins make the page taller.
		await expect(async () => {
			await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
			await expect(address(page)).toBeInViewport({ ratio: 1, timeout: 1000 });
		}).toPass();
		await topOnceStill(address(page));
		await expectCopyCursor(page);
		const followed = await countFollowed(page);

		await address(page).click();

		await expect(statusline(page)).toContainText(YANKED + SECOND_CLICK);
		expect(await followed()).toBe(0);
	});

	test('a selection puts the statusline in VISUAL', async ({ page }) => {
		await visitContact(page);

		await city(page).dblclick({ position: { x: 12, y: 8 } });

		await expect(shownMode(page)).toHaveText('VISUAL');
		await expect(statusline(page).locator('.message')).toHaveText('8 caractères');
	});
});

test.describe('the statusline, not announced', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('a message reaches no assistive technology: the Pause stays the only part exposed', async ({ page }) => {
		await visitContact(page);
		const exposed = () => statusline(page).ariaSnapshot();
		const atRest = await exposed();

		await address(page).click();
		await expect(statusline(page)).toContainText(YANKED);

		expect(await exposed()).toBe(atRest);
		expect(atRest).not.toContain('copiés');
		await expect(page.locator('[aria-live], [role="status"], [role="alert"]')).toHaveCount(0);
	});
});
