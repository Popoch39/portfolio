import { devices, expect, test } from './fixtures';
import { atomeSection } from './atome-helpers';
import {
	LANGAGES,
	LANGAGES_ANSWER,
	OUTILS,
	bandPoint,
	expectAimed,
	expectAtRest,
	message,
	pastillePoint,
	shownLabels,
	tool,
	towerLook,
	visitStillTower,
	visitTower,
} from './stack-aim-helpers';

// Chromium project only (see playwright.config.ts): Firefox does not emulate `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

/** How far from the middle of a band the finger lands: a band is too thin on a phone to be hit dead on. */
const OFF_THE_BAND = 5;
/** How far from the middle of a pastille the finger lands: beside the logo, a few pixels wide on a phone. */
const OFF_THE_PASTILLE = 7;

test.describe('the tower under a finger', () => {
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });

	test('a tap near a band lights its bague, whose label takes the row; a tap elsewhere puts everything back', async ({
		page,
	}) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		// Under the tower, the scene leaves the labels one row, the last one showing.
		expect(await shownLabels(page)).toEqual([OUTILS]);
		const { x, y } = await bandPoint(page, LANGAGES);

		await page.touchscreen.tap(x, y + OFF_THE_BAND);

		await expectAimed(page, LANGAGES, atRest);
		expect(await shownLabels(page)).toEqual([LANGAGES]);
		await expect(message(page)).toHaveText(LANGAGES_ANSWER);

		// On the section's title, where it stands: a tap by its locator would scroll it into view first.
		const title = await atomeSection(page).getByRole('heading').first().boundingBox();
		if (!title) throw new Error('the Stack has no title');
		await page.touchscreen.tap(title.x + title.width / 2, Math.max(4, title.y + title.height - 4));

		await expectAtRest(page, atRest);
		await expect(message(page)).toBeHidden();
		expect(await shownLabels(page)).toEqual([OUTILS]);
	});

	test('a tapped bague answers for a moment, then rests on its own: nothing stays stuck', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		const { x, y } = await bandPoint(page, LANGAGES);

		await page.touchscreen.tap(x, y);
		await expectAimed(page, LANGAGES, atRest);

		await expect.poll(() => towerLook(page), { timeout: 8000 }).toEqual(atRest);
		await expect(message(page)).toBeHidden();
		expect(await shownLabels(page)).toEqual([OUTILS]);
	});

	test('a tool tapped in the row names itself in the statusline', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);

		await tool(page, 'Git').tap();

		await expectAimed(page, OUTILS, atRest);
		await expect(message(page)).toHaveText('stack=Git · Outils');
	});

	test('a tap near a pastille names its tool: a logo is too small for a finger to hit dead on', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		const { x, y } = await pastillePoint(page, OUTILS);

		await page.touchscreen.tap(x + OFF_THE_PASTILLE, y);

		await expectAimed(page, OUTILS, atRest);
		await expect(message(page)).toHaveText(/^stack=(Bun|Git|Neovim|tmux) · Outils$/);
	});

	test('a swipe over the tower scrolls the page and aims at nothing', async ({ page }) => {
		await visitTower(page);
		const { x, y } = await bandPoint(page, LANGAGES);
		const cdp = await page.context().newCDPSession(page);

		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
		for (let step = 1; step <= 10; step++) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + step * 12 }] });
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

		await expect(page.locator('[data-atome] [data-aimed]')).toHaveCount(0);
		await expect(message(page)).toBeHidden();
	});
});

// Neither motion nor a fine pointer: no scene plays, the tower stands in the flow with all its labels.
test.describe('the tower under a finger, motion reduced', () => {
	test.use({ viewport, userAgent, deviceScaleFactor, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

	test('a tap near a band lights its bague at once, and every label stays', async ({ page }) => {
		await visitStillTower(page);
		const atRest = await towerLook(page);
		const labels = await shownLabels(page);
		const { x, y } = await bandPoint(page, LANGAGES);

		await page.touchscreen.tap(x, y + OFF_THE_BAND);

		await expect(message(page)).toHaveText(LANGAGES_ANSWER);
		const look = await towerLook(page);
		expect(look[LANGAGES].accent).toBe(1);
		expect(atRest[LANGAGES].top - look[LANGAGES].top).toBeGreaterThanOrEqual(5);
		expect(await shownLabels(page)).toEqual(labels);
	});
});
