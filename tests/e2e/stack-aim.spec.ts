import { expect, test, type Page } from './fixtures';
import { atomeSection, pinRange, scrollToShare } from './atome-helpers';
import { content, sceneOnceStill, topOnceStill } from './helpers';
import {
	BACK_END,
	BACK_END_ANSWER,
	LANGAGES,
	LANGAGES_ANSWER,
	OUTILS,
	SIG,
	bandPoint,
	category,
	expectAimed,
	expectAtRest,
	expectRowGivenBack,
	inkOf,
	label,
	message,
	pastillePoint,
	shownLabels,
	tool,
	towerLook,
	visitStillTower,
	visitTower,
} from './stack-aim-helpers';
import { branch } from './statusline-helpers';

/**
 * The Atome's finished tower answers whoever aims at a bague (spec #93, details 07 and 08): the bague
 * takes the accent and lifts a notch, and the statusline answers `stack=` with the tool and its
 * category, then gives the row back.
 */

/** The computed transform of everything the pinned scene moves. */
function sceneTransforms(page: Page) {
	return page
		.locator('[data-atome]')
		.evaluate((atome) =>
			[
				...atome.querySelectorAll(
					'.atome-tower, .bague, .bague-plane, .bague-layer, .bague-track, .pastille-slot, .atome-label',
				),
			].map((element) => getComputedStyle(element).transform),
		);
}

test.describe('the tower under a pointer', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('a tool pointed at in its label lights and lifts its bague, and the statusline names it', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		expect(await inkOf(page, LANGAGES)).not.toBe(await inkOf(page, SIG));

		await tool(page, 'Rust').hover();

		await expectAimed(page, LANGAGES, atRest);
		await expect(message(page)).toHaveText('stack=Rust · Langages');
		await expect(branch(page)).toBeHidden();
		// The accent never carries text (ADR 0006): the label answers in the full ink the specialty wears.
		expect(await inkOf(page, LANGAGES)).toBe(await inkOf(page, SIG));

		await page.mouse.move(5, 5);

		await expectAtRest(page, atRest);
		await expectRowGivenBack(page);
		expect(await inkOf(page, LANGAGES)).not.toBe(await inkOf(page, SIG));
	});

	test('a category pointed at lists the tools of its bague', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);

		await category(page, LANGAGES).hover();

		await expectAimed(page, LANGAGES, atRest);
		await expect(message(page)).toHaveText(LANGAGES_ANSWER);
	});

	test('a band pointed at lights its bague and lists its tools; the pointer gone, the tower rests', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		const { x, y } = await bandPoint(page, LANGAGES);

		await page.mouse.move(x, y);

		await expectAimed(page, LANGAGES, atRest);
		await expect(message(page)).toHaveText(LANGAGES_ANSWER);

		await page.mouse.move(5, 5);

		await expectAtRest(page, atRest);
		await expectRowGivenBack(page);
	});

	test('a pastille pointed at names its tool, and keeps naming it once the bague has lifted', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		const { x, y } = await pastillePoint(page, OUTILS);

		await page.mouse.move(x, y);

		await expectAimed(page, OUTILS, atRest);
		await expect(message(page)).toHaveText(/^stack=(Bun|Git|Neovim|tmux) · Outils$/);
	});

	test('going from a bague to another, only the last one aimed at answers', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);

		await tool(page, 'Rust').hover();
		await expectAimed(page, LANGAGES, atRest);
		await tool(page, 'PostGIS').hover();

		await expectAimed(page, SIG, atRest);
		await expect(message(page)).toHaveText('stack=PostGIS · SIG · CAD · 3D');
	});

	test('an aimed bague moves nothing of what the pinned scene moves', async ({ page }) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		const transforms = await sceneTransforms(page);

		await tool(page, 'Rust').hover();
		await expectAimed(page, LANGAGES, atRest);

		expect(await sceneTransforms(page)).toEqual(transforms);
	});

	test('nothing answers while the scene plays; its end come under a resting pointer, the bague answers', async ({
		page,
	}) => {
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		// The lit bagues, towards the end of the scene: the tower is built, its labels are there.
		await scrollToShare(page, 0.9);
		// The pin holds the section's top this far above the window's: the scene ends that much later.
		const pinOffset = await atomeSection(page).evaluate((section) => -section.getBoundingClientRect().top);
		const { top, length } = await pinRange(page);
		const toSceneEnd = async () => {
			await page.evaluate((y) => scrollTo(0, y), Math.ceil(top + pinOffset + length));
			await topOnceStill(content(page));
			await sceneOnceStill(atomeSection(page));
		};
		await toSceneEnd();
		const atRest = await towerLook(page);
		await scrollToShare(page, 0.9);
		const playing = await towerLook(page);

		await tool(page, 'Rust').hover();
		await sceneOnceStill(atomeSection(page));

		expect(await towerLook(page)).toEqual(playing);
		await expectRowGivenBack(page);

		await toSceneEnd();

		await expectAimed(page, LANGAGES, atRest);
		await expect(message(page)).toHaveText('stack=Rust · Langages');

		await scrollToShare(page, 0.9);

		await expect.poll(() => towerLook(page)).toEqual(playing);
		await expectRowGivenBack(page);
	});
});

test.describe('the tower from the keyboard', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('each label is a stop: focused, it shows a ring, its bague answers and the statusline lists its tools', async ({
		page,
	}) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		// Set by script, the focus shows no ring: the keyboard takes over from the first label.
		await label(page, LANGAGES).focus();

		await page.keyboard.press('Tab');

		await expect(label(page, BACK_END)).toBeFocused();
		await expect(category(page, BACK_END)).toHaveCSS('outline-style', 'solid');
		await expect(category(page, BACK_END)).toHaveCSS('outline-width', '2px');
		await expectAimed(page, BACK_END, atRest);
		await expect(message(page)).toHaveText(BACK_END_ANSWER);

		await page.keyboard.press('Shift+Tab');

		await expect(label(page, LANGAGES)).toBeFocused();
		await expectAimed(page, LANGAGES, atRest);
		await expect(message(page)).toHaveText(LANGAGES_ANSWER);
	});

	test('the seven labels are walked in the order of the tower, and the tower rests once the focus has left', async ({
		page,
	}) => {
		await visitTower(page);
		const atRest = await towerLook(page);
		await label(page, LANGAGES).focus();

		for (let rank = BACK_END; rank <= OUTILS; rank++) {
			await page.keyboard.press('Tab');
			await expect(label(page, rank)).toBeFocused();
		}
		await expectAimed(page, OUTILS, atRest);

		await page.keyboard.press('Tab');

		await expect(page.locator('.atome-label:focus')).toHaveCount(0);
		await expectAtRest(page, atRest);
	});

	test('a label reached before the scene has played brings the page to the finished tower, which answers', async ({
		page,
	}) => {
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		await pinRange(page);
		await label(page, LANGAGES).focus();

		await page.keyboard.press('Tab');

		await expect(label(page, BACK_END)).toBeFocused();
		await expect(message(page)).toHaveText(BACK_END_ANSWER, { timeout: 10_000 });
		await expect(label(page, BACK_END)).toBeInViewport();
		await expect(label(page, BACK_END)).toHaveCSS('opacity', '1');
		await expect.poll(async () => (await towerLook(page))[BACK_END].accent).toBe(1);
	});
});

test.describe('the tower under a pointer, motion reduced', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('the bague answers in one step: nothing eases, and every label stays', async ({ page }) => {
		await visitStillTower(page);
		const atRest = await towerLook(page);
		const labels = await shownLabels(page);

		await tool(page, 'Rust').hover();

		await expect(message(page)).toHaveText('stack=Rust · Langages');
		// No polling: the answer is whole as soon as it is given.
		const look = await towerLook(page);
		expect(look[LANGAGES].accent).toBe(1);
		expect(atRest[LANGAGES].top - look[LANGAGES].top).toBeGreaterThanOrEqual(5);
		const eased = await page
			.locator('.bague')
			.first()
			.evaluate((bague) =>
				[bague.parentElement, ...bague.querySelectorAll('.bague-aim')].flatMap(
					(element) => (element ? getComputedStyle(element).transitionDuration.split(', ') : []),
				),
			);
		expect(new Set(eased)).toEqual(new Set(['0s']));
		expect(await shownLabels(page)).toEqual(labels);

		await page.mouse.move(5, 5);

		expect(await towerLook(page)).toEqual(atRest);
		await expectRowGivenBack(page);
	});

	test('a label focused from the keyboard answers too', async ({ page }) => {
		await visitStillTower(page);
		const atRest = await towerLook(page);
		await label(page, LANGAGES).focus();

		await page.keyboard.press('Tab');

		await expect(label(page, BACK_END)).toBeFocused();
		await expectAimed(page, BACK_END, atRest);
		await expect(message(page)).toHaveText(BACK_END_ANSWER);
	});
});
