import { devices, expect, test, type Page } from './fixtures';
import {
	expectCardsOnPoles,
	expectFramed,
	expectReadable,
	friseBand,
	friseFraming,
	friseLegend,
	friseSection,
	headOnScreen,
	PIN_HEIGHTS,
	recordLayoutShifts,
	sceneStart,
	scrollToScene,
} from './frise-helpers';
import { expectNativeScrolling, swipe, swipeUp, topOnceStill } from './helpers';

// Chromium project only: the name matches the Firefox `testIgnore` (playwright.config.ts), which
// does not emulate `isMobile`.
const { userAgent, deviceScaleFactor } = devices['iPhone SE'];
const finger = { userAgent, deviceScaleFactor, hasTouch: true, isMobile: true };

// The smallest phone still sold, and today's common one.
const PHONES = [
	{ width: 320, height: 568 },
	{ width: 390, height: 844 },
];

/**
 * Records, frame by frame, how far the page has scrolled and where the section stands, until `stop`
 * is called: a jump shows up as a frame where the section is not where the scroll puts it.
 */
async function recordFrames(page: Page) {
	await friseSection(page).evaluate((section) => {
		const frames: [number, number][] = [];
		window.testFrames = frames;
		const record = () => {
			frames.push([scrollY, section.getBoundingClientRect().top]);
			if (frames.length < 10_000) requestAnimationFrame(record);
		};
		requestAnimationFrame(record);
	});
	return () => page.evaluate(() => window.testFrames ?? []);
}

declare global {
	interface Window {
		testFrames?: [number, number][];
	}
}

for (const { width, height } of PHONES) {
	test.describe(`Frise under a finger, ${width}×${height} portrait`, () => {
		test.use({ ...finger, viewport: { width, height } });

		test('scene: the active commit stands readable in the frame, clear of the heading', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);

			await scrollToScene(page, start, 0);
			await expect(friseLegend(page)).toContainText('Baccalauréat');
			expectFramed(await friseFraming(page));
			expectReadable(await friseFraming(page), /Baccalauréat/);

			await scrollToScene(page, start, 1);
			await expect(friseLegend(page)).toContainText('HEAD');
			expectFramed(await friseFraming(page));
			expectReadable(await friseFraming(page), /HEAD/);
		});

		test('final state: framed, the strip scrolls sideways under the finger, not the page', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			await page.evaluate(() => document.querySelector('#parcours')?.scrollIntoView());
			expectFramed(await friseFraming(page));
			expectReadable(await friseFraming(page), /Baccalauréat/);

			const box = await friseBand(page).boundingBox();
			if (!box) throw new Error('strip missing');
			await swipe(page, { x: width * 0.8, y: box.y + box.height / 2 }, { x: -width * 0.5, y: 0 });

			await expect.poll(() => friseBand(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
			expect(await page.evaluate(() => scrollX)).toBe(0);
		});

		test('crossing the scene shifts no layout, neither at the pinning edges nor when the legend changes', async ({
			page,
		}) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);
			const end = start + PIN_HEIGHTS * height;
			await page.evaluate((y) => scrollTo(0, y), start - 300);
			await topOnceStill(friseSection(page));
			const shifts = await recordLayoutShifts(page);

			while ((await page.evaluate(() => scrollY)) < end + 300) {
				await swipeUp(page, height * 0.6);
				await topOnceStill(friseSection(page));
			}

			const recorded = await shifts();
			// What CLS counts, page-wide; any shift of the Frise is checked, excused or not.
			const counted = recorded.filter(({ hadRecentInput }) => !hadRecentInput);
			const total = counted.reduce((sum, shift) => sum + shift.value, 0);
			expect(total, JSON.stringify(counted)).toBeLessThan(0.1);
			for (const shift of recorded.filter(({ sources }) => sources.some(({ inFrise }) => inFrise))) {
				expect(shift.value, JSON.stringify(shift)).toBeLessThanOrEqual(0.01);
			}
			expect(recorded.filter(({ sources }) => sources.some(({ inLegend }) => inLegend))).toEqual([]);
		});
	});
}

test.describe('Frise under a finger, scrolling', () => {
	test.use({ ...finger, viewport: PHONES[1], reducedMotion: 'no-preference' });

	test('swiping moves HEAD forward and back, the section pinned and the page scrolled natively', async ({
		page,
	}) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0.2);
		const before = await headOnScreen(page);

		await swipeUp(page, 400);
		await expect.poll(() => headOnScreen(page)).toBeLessThan(before - 30);
		expect(Math.abs(await topOnceStill(friseSection(page)))).toBeLessThanOrEqual(1);
		await expectNativeScrolling(page);
		const forward = await headOnScreen(page);

		await swipeUp(page, -300);
		await expect.poll(() => headOnScreen(page)).toBeGreaterThan(forward + 20);
		expect(Math.abs(await topOnceStill(friseSection(page)))).toBeLessThanOrEqual(1);
	});

	// A phone scrolls under the finger off the main thread: a pin rewritten by script each frame
	// trails behind (the section scrolls past its place, then jumps back), a sticky one does not.
	// Headless Chromium scrolls in step with the script, so only the means of pinning can be checked.
	test('the pinned section is held by the browser, not by a transform written each frame', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0.5);

		await expect(friseSection(page)).toHaveCSS('position', 'sticky');
		await expect(friseSection(page)).toHaveCSS('transform', 'none');
	});

	// Without a `pin`, nothing plays the timeline through at a refresh: the cues ahead must still start low.
	test('at the start of the scene, the commits ahead stand discreet, not at their final state', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0);

		// The next commit, whose cues begin before the start and are clipped to it.
		const next = friseBand(page).getByRole('listitem').nth(1);
		await expect.poll(() => next.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.5);
	});

	// Turning the phone changes the poles' height (media queries): a refresh must lay the cards on the new ones.
	test('after the phone turns, each card still rides on top of its pole, raised or lowered', async ({ page }) => {
		const { width, height } = PHONES[1];
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0.5);

		for (const viewport of [
			{ width: height, height: width },
			{ width, height },
		]) {
			await page.setViewportSize(viewport);
			// The section held at the top shifts its own offset: the start is read above the scene.
			await page.evaluate(() => scrollTo(0, 0));
			await scrollToScene(page, await sceneStart(page), 0.5);
			await expectCardsOnPoles(page);
		}
	});

	test('no jump when the pinning starts nor when it ends', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const end = start + PIN_HEIGHTS * (await page.evaluate(() => innerHeight));
		// Where the scroll puts the section: following the page, held at the top, then following again.
		const expectedTop = (scrolled: number) =>
			scrolled < start ? start - scrolled : scrolled > end ? end - scrolled : 0;

		for (const edge of [start, end]) {
			await page.evaluate((y) => scrollTo(0, y), edge - 250);
			await topOnceStill(friseSection(page));
			const frames = await recordFrames(page);

			await swipeUp(page, 500);
			await topOnceStill(friseSection(page));

			const recorded = await frames();
			expect(recorded.some(([scrolled]) => scrolled > edge), 'the swipe crossed the edge').toBe(true);
			for (const [scrolled, top] of recorded) {
				expect(Math.abs(top - expectedTop(scrolled)), `at scrollY ${scrolled}`).toBeLessThanOrEqual(2);
			}
		}
	});
});
