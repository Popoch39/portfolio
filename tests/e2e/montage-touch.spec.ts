import { devices, expect, test, type Page } from './fixtures';
import { expectNativeScrolling, swipeUp, topOnceStill } from './helpers';
import { cafeCounter as counter, PIN_HEIGHTS, sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

// Chromium project only: the name matches the Firefox `testIgnore` (playwright.config.ts), which
// does not emulate `isMobile`.
const { userAgent, deviceScaleFactor } = devices['iPhone SE'];
const finger = { userAgent, deviceScaleFactor, hasTouch: true, isMobile: true };

/**
 * Records, frame by frame, how far the page has scrolled and where the section stands, until read: a jump
 * shows up as a frame where the section is not where the scroll puts it.
 */
async function recordFrames(page: Page) {
	await section(page).evaluate((el) => {
		const frames: [number, number][] = [];
		window.testCafeFrames = frames;
		const record = () => {
			frames.push([scrollY, el.getBoundingClientRect().top]);
			if (frames.length < 10_000) requestAnimationFrame(record);
		};
		requestAnimationFrame(record);
	});
	return () => page.evaluate(() => window.testCafeFrames ?? []);
}

declare global {
	interface Window {
		testCafeFrames?: [number, number][];
	}
}

// Today's common phone, held upright and on its side.
const PHONES = [
	{ name: 'portrait', width: 390, height: 844 },
	{ name: 'landscape', width: 844, height: 390 },
];

for (const { name, width, height } of PHONES) {
	test.describe(`Montage under a finger, ${width}×${height} ${name}`, () => {
		test.use({ ...finger, viewport: { width, height }, reducedMotion: 'no-preference' });

		test('swiping plays the scene forward and back, the section pinned and the page scrolled natively', async ({
			page,
		}) => {
			await page.goto('/');
			await scrollToScene(page, await sceneStart(page), 0.2);
			await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');

			await swipeUp(page, height * 0.4);
			await expect(counter(page)).not.toHaveText('1/6 · l’entonnoir et le café');
			await expect(counter(page)).not.toHaveText(/^0\/6/);
			expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
			await expectNativeScrolling(page);

			await swipeUp(page, -height * 0.4);
			await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');
			expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		});

		test('no jump when the pinning starts nor when it ends', async ({ page }) => {
			await page.goto('/');
			const start = await sceneStart(page);
			const end = start + PIN_HEIGHTS * (await page.evaluate(() => innerHeight));
			// Where the scroll puts the section: following the page, held at the top, then following again.
			const expectedTop = (scrolled: number) =>
				scrolled < start ? start - scrolled : scrolled > end ? end - scrolled : 0;

			for (const edge of [start, end]) {
				await page.evaluate((y) => scrollTo(0, y), edge - height * 0.3);
				await topOnceStill(section(page));
				const frames = await recordFrames(page);

				await swipeUp(page, height * 0.6);
				await topOnceStill(section(page));

				const recorded = await frames();
				expect(recorded.some(([scrolled]) => scrolled > edge), 'the swipe crossed the edge').toBe(true);
				for (const [scrolled, top] of recorded) {
					expect(Math.abs(top - expectedTop(scrolled)), `at scrollY ${scrolled}`).toBeLessThanOrEqual(2);
				}
			}
		});
	});
}
