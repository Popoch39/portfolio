import { expect, test, type Page } from './fixtures';
import { content, sceneOnceStill, topInPage, topOnceStill } from './helpers';

const atomeSection = (page: Page) => page.locator('section:has([data-atome])');
const tower = (page: Page) => page.locator('.atome-tower');

/**
 * Where the pinned scene runs in the page: from the top of its spacer, over the spacer's extra height.
 * Read from the spacer, which stays in the flow while the section is pinned.
 */
async function pinRange(page: Page) {
	const spacer = atomeSection(page).locator('xpath=..');
	// The scenes are built once the page has settled.
	await expect(spacer).toHaveClass(/pin-spacer/, { timeout: 15_000 });
	const top = await topInPage(spacer);
	const length = await spacer.evaluate((el: HTMLElement) => el.offsetHeight - (el.firstElementChild as HTMLElement).offsetHeight);
	return { top, length };
}

/** Scrolls to a share of the pinned scene (0 at its start, 1 at its end) and waits until it has caught up. */
async function scrollToShare(page: Page, share: number) {
	const { top, length } = await pinRange(page);
	await page.evaluate((y) => scrollTo(0, y), Math.round(top + share * length));
	await topOnceStill(content(page));
	await sceneOnceStill(atomeSection(page));
}

/**
 * What the Atome shows, in the section's frame: where each band, logo, label and the nucleus stand on
 * screen, 3D transforms included, and how opaque each one is.
 */
function atomeLayout(page: Page) {
	return atomeSection(page).evaluate((section) => {
		const origin = section.getBoundingClientRect();
		const opacity = (element: Element) => {
			let value = 1;
			for (let node: Element | null = element; node && node !== section; node = node.parentElement) {
				value *= Number(getComputedStyle(node).opacity);
			}
			return value;
		};
		const seen = (selector: string) =>
			[...section.querySelectorAll(selector)].map((element) => {
				const { left, top, width, height } = element.getBoundingClientRect();
				return [left - origin.left, top - origin.top, width, height, 100 * opacity(element)];
			});
		return {
			bands: seen('.bague-top'),
			accents: seen('.bague-top-accent'),
			logos: seen('.pastille-logo'),
			nucleus: seen('.atome-nucleus'),
			labels: seen('.atome-label'),
		};
	});
}

type Layout = Awaited<ReturnType<typeof atomeLayout>>;

/** The largest gap between two layouts, in pixels or in percents of opacity. */
function largestGap(a: Layout, b: Layout) {
	let gap = 0;
	for (const part of Object.keys(a) as (keyof Layout)[]) {
		if (a[part].length !== b[part].length) return Number.POSITIVE_INFINITY;
		a[part].forEach((values, index) =>
			values.forEach((value, at) => (gap = Math.max(gap, Math.abs(value - b[part][index][at])))),
		);
	}
	return gap;
}

/** The scene's poses, as shares of the pin: target, gyroscope, atom, tower, then a bague lit. */
const POSES = { target: 0.02, gyroscope: 0.17, atom: 0.31, tower: 0.62, lit: 0.75 };

const PORTRAIT = { width: 412, height: 915 };
const LANDSCAPE = { width: 915, height: 412 };

test.describe('Atome', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('its layers are promoted only while the scene is pinned', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		const promoted = async () => [
			await atomeSection(page).evaluate((el) => getComputedStyle(el).willChange),
			await tower(page).evaluate((el) => getComputedStyle(el).willChange),
		];

		await expect.poll(promoted, { message: 'before the scene' }).toEqual(['auto', 'auto']);

		await scrollToShare(page, POSES.atom);
		await expect.poll(promoted, { message: 'pinned' }).toEqual(['transform', 'transform']);

		await scrollToShare(page, 1.3);
		await expect.poll(promoted, { message: 'past the scene' }).toEqual(['auto', 'auto']);

		await scrollToShare(page, POSES.tower);
		await expect.poll(promoted, { message: 'back in the scene' }).toEqual(['transform', 'transform']);

		await scrollToShare(page, -0.5);
		await expect.poll(promoted, { message: 'back above the scene' }).toEqual(['auto', 'auto']);
	});

	// On the finished tower, the opening and the labels have played: going back, they show what they took.
	for (const [turn, from, to] of [
		['portrait to landscape', PORTRAIT, LANDSCAPE],
		['landscape to portrait', LANDSCAPE, PORTRAIT],
	] as const) {
		test(`turned from ${turn} on the finished tower, it shows each pose as a page opened that way`, async ({
			page,
		}) => {
			// Ten scrolls, each waiting for the smoothing and the scene's lag to settle.
			test.slow();
			await page.setViewportSize(to);
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const expected: Record<string, Layout> = {};
			for (const [pose, share] of Object.entries(POSES)) {
				await scrollToShare(page, share);
				expected[pose] = await atomeLayout(page);
			}

			await page.setViewportSize(from);
			await page.reload();
			await page.evaluate(() => document.fonts.ready);
			await scrollToShare(page, POSES.tower);
			await page.setViewportSize(to);

			for (const [pose, share] of Object.entries(POSES)) {
				await expect
					.poll(
						async () => {
							await scrollToShare(page, share);
							return largestGap(await atomeLayout(page), expected[pose]);
						},
						{ message: pose },
					)
					.toBeLessThanOrEqual(1);
			}
		});
	}

	// A phone on its side leaves the pinned frame some 360px: beside a tower fitted to it, the labels
	// would sit closer than their own height. They go under it, one at a time, and the title leaves the frame.
	for (const viewport of [
		{ width: 844, height: 390 },
		{ width: 667, height: 375 },
	]) {
		test(`${viewport.width} × ${viewport.height}: the tower keeps the frame and no label runs into another`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);

			for (const pose of ['tower', 'lit'] as const) {
				await scrollToShare(page, POSES[pose]);
				const frame = await page.evaluate(() => ({
					top: 0,
					bottom: document.querySelector('#statusline')?.getBoundingClientRect().top ?? innerHeight,
				}));
				const box = (locator: ReturnType<typeof tower>) =>
					locator.evaluateAll((elements) =>
						elements
							.filter((element) => Number(getComputedStyle(element).opacity) > 0.5)
							.map((element) => {
								const { top, bottom, left, right } = element.getBoundingClientRect();
								return { top, bottom, left, right };
							}),
					);
				const [towerBox] = await box(tower(page));
				const labels = await box(page.locator('.atome-label'));

				expect(towerBox.bottom - towerBox.top, `${pose}: the tower's height`).toBeGreaterThanOrEqual(0.4 * viewport.height);
				for (const [index, label] of [towerBox, ...labels].entries()) {
					expect(label.top, `${pose}: box ${index} above the frame`).toBeGreaterThanOrEqual(frame.top);
					expect(label.bottom, `${pose}: box ${index} under the statusline`).toBeLessThanOrEqual(frame.bottom);
				}
				for (const [index, label] of labels.entries()) {
					for (const other of labels.slice(index + 1)) {
						expect(label.bottom <= other.top || other.bottom <= label.top, `${pose}: two labels overlap`).toBe(true);
					}
				}
			}
		});
	}

	test('the preference turning to reduced motion mid-scene leaves the final state, nothing else', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		await atomeSection(page).scrollIntoViewIfNeeded();
		const finalState = await atomeLayout(page);

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.reload();
		await page.evaluate(() => document.fonts.ready);
		await scrollToShare(page, POSES.atom);
		await page.emulateMedia({ reducedMotion: 'reduce' });

		await expect.poll(() => tower(page).evaluate((el) => getComputedStyle(el).willChange)).toBe('auto');
		await expect(atomeSection(page)).toHaveCSS('will-change', 'auto');
		await atomeSection(page).scrollIntoViewIfNeeded();
		await expect.poll(async () => largestGap(await atomeLayout(page), finalState)).toBeLessThanOrEqual(1);
	});
});
