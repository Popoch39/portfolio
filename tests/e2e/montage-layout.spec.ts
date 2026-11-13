import { expect, test, type Locator, type Page } from './fixtures';
import { topInPage, topOnceStill, verticalTranslation } from './helpers';
import { sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

/** How opaque an element shows: its own opacity times that of every box around it. */
const opacityOnScreen = (element: Locator) =>
	element.evaluate((el) => {
		let value = 1;
		for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
		return value;
	});

const paragraph = (page: Page) => section(page).getByText(/^À Besançon/);
// With JavaScript, the action that opens the Formulaire du Café.
const coffee = (page: Page) => section(page).getByRole('button', { name: 'Proposer un café', exact: true });

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

/**
 * Where the Café's parts stand, vertically from the section's top, which the pinning holds at the top of the
 * window; `frame` is the window above the statusline, `width` the window without its scrollbar.
 */
const cafeLayout = (page: Page) =>
	section(page).evaluate((el) => {
		const origin = el.getBoundingClientRect().top;
		const rect = (selector: string) => {
			const target = el.querySelector(selector);
			if (!target) throw new Error(`no ${selector} in the Café`);
			const { left, right, top, bottom, width, height } = target.getBoundingClientRect();
			return { left, right, top: top - origin, bottom: bottom - origin, width, height };
		};
		const box = el.getBoundingClientRect();
		const style = getComputedStyle(el);
		const title = el.querySelector('h2');
		return {
			frame: innerHeight - (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0),
			width: document.documentElement.clientWidth,
			// The page column the section's content stands in, between its gutters.
			column: {
				left: box.left + Number.parseFloat(style.paddingLeft),
				right: box.right - Number.parseFloat(style.paddingRight),
			},
			titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
			title: rect('h2'),
			counter: rect('[data-cafe-counter]'),
			progress: rect('.cafe-progress'),
			moka: rect('[data-montage]'),
			text: rect('[data-cafe-text]'),
			actions: rect('[data-cafe-actions]'),
		};
	});

type CafeLayout = Awaited<ReturnType<typeof cafeLayout>>;

/** The section's top at the top of the window, as the pinning holds it (final state: no pinning, no smoothing). */
async function sectionAtTop(page: Page) {
	// Polled rather than awaited: without JavaScript, Firefox never settles a promise in the page.
	await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
	const top = await topInPage(section(page));
	await page.evaluate((y) => scrollTo(0, y), top);
}

/** Whole in the window, beside or under the rest. */
function expectWholeMoka({ moka, frame, width }: CafeLayout) {
	expect(moka.left, 'moka left').toBeGreaterThanOrEqual(-1);
	expect(moka.right, 'moka right').toBeLessThanOrEqual(width + 1);
	expect(moka.top, 'moka top').toBeGreaterThanOrEqual(-1);
	expect(moka.bottom, 'moka bottom').toBeLessThanOrEqual(frame + 1);
	expect(moka.height, 'moka drawn').toBeGreaterThan(0);
}

/** Title, counter and rule at the top, then the moka, as tall as the room left; the text after the screen. */
function expectStacked(layout: CafeLayout) {
	const { title, counter, progress, moka, text, actions, frame } = layout;
	expect(title.bottom, 'counter under the title').toBeLessThanOrEqual(counter.top + 1);
	expect(counter.bottom, 'rule under the counter').toBeLessThanOrEqual(progress.top + 1);
	expect(moka.top, 'moka under the rule').toBeGreaterThanOrEqual(progress.bottom);
	expectWholeMoka(layout);
	expect(moka.bottom, 'moka takes the room left').toBeGreaterThan(frame - 48);
	expect(text.top, 'paragraph after the pinned screen').toBeGreaterThanOrEqual(frame);
	expect(actions.top, 'actions after the paragraph').toBeGreaterThanOrEqual(text.bottom);
}

/**
 * The board (1280×770 above the statusline, 52px margins: 1176 wide) at the scale that fits it in the frame and
 * the column: the text on the left, the moka beside it, 444×740 board pixels, everything inside the frame.
 */
function expectTwoColumns(layout: CafeLayout) {
	const { title, text, actions, moka, frame, column, titleSize } = layout;
	const scale = Math.min(frame / 770, (column.right - column.left) / 1176);
	expect(moka.left, 'moka beside the title').toBeGreaterThanOrEqual(title.right);
	expect(moka.left, 'moka beside the paragraph').toBeGreaterThanOrEqual(text.right);
	expect(moka.left, 'moka beside the actions').toBeGreaterThanOrEqual(actions.right);
	expect(moka.top, 'moka up beside the title').toBeLessThan(title.top);
	expectWholeMoka(layout);
	expect(text.bottom, 'paragraph on the screen').toBeLessThanOrEqual(frame);
	expect(actions.bottom, 'actions on the screen').toBeLessThanOrEqual(frame);
	expect(moka.height, 'moka at the board’s scale').toBeCloseTo(740 * scale, 0);
	expect(titleSize, 'title at the board’s scale').toBeCloseTo(80 * scale, 0);
	for (const [name, part] of Object.entries({ title, text, actions, moka })) {
		expect(part.left, `${name} in the column`).toBeGreaterThanOrEqual(column.left - 1);
		expect(part.right, `${name} in the column`).toBeLessThanOrEqual(column.right + 1);
	}
}

const TWO_COLUMNS = [
	{ name: 'just over the breakpoint', width: 861, height: 800 },
	{ name: 'narrowest and lowest', width: 861, height: 520 },
	{ name: 'at the height threshold', width: 1280, height: 520 },
	{ name: 'tablet, landscape', width: 1024, height: 768 },
	{ name: 'laptop', width: 1280, height: 720 },
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'full HD', width: 1920, height: 1080 },
	{ name: '1440p', width: 2560, height: 1440 },
];

for (const { name, width, height } of TWO_COLUMNS) {
	test.describe(`Café in two columns, ${name} (${width}×${height})`, () => {
		test.use({ viewport: { width, height } });

		test('final state: the board’s layout at scale, within the page column', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await sectionAtTop(page);

			const layout = await cafeLayout(page);
			expectTwoColumns(layout);
			// Bounded by the page's maximum width, gutters included.
			expect(layout.column.right - layout.column.left).toBeLessThanOrEqual(1440);
		});

		test('scene: pinned, the layout holds; the paragraph and actions rise in beside the moka', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);

			await scrollToScene(page, start, 0.5);
			expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
			expectTwoColumns(await cafeLayout(page));
			expect(await opacityOnScreen(paragraph(page))).toBe(0);

			await scrollToScene(page, start, 0.95);
			expectTwoColumns(await cafeLayout(page));
			expect(await opacityOnScreen(paragraph(page))).toBe(1);
			expect(await opacityOnScreen(coffee(page))).toBe(1);
		});

		// The figure runs up beside the section's head: in a narrow column, the lifted lid reaches the aside's row.
		test('scene: the lifted lid never covers the aside', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);
			const boxOf = (selector: string) =>
				section(page)
					.locator(selector)
					.evaluate((element) => {
						const { left, right, top, bottom } = element.getBoundingClientRect();
						return { left, right, top, bottom };
					});

			// The lid hangs lifted until it comes down, from 0.6 of the pinning, while the camera moves under it.
			for (const progress of [0.05, 0.2, 0.4, 0.58]) {
				await scrollToScene(page, start, progress);
				const [lid, aside] = [await boxOf('[data-layer="lid"]'), await boxOf('.cafe-aside')];
				const apart = lid.right <= aside.left || aside.right <= lid.left || lid.bottom <= aside.top || aside.bottom <= lid.top;
				expect(apart, `at ${progress}: ${JSON.stringify({ lid, aside })}`).toBe(true);
			}
		});
	});
}

test.describe('Café without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('stacked on a phone, at the final state', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/');
		await sectionAtTop(page);
		expectStacked(await cafeLayout(page));
	});

	test('in two columns on a laptop, at the final state', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/');
		await sectionAtTop(page);
		expectTwoColumns(await cafeLayout(page));
	});
});

// From the small phone to the 1440p screen, through the breakpoint.
const WIDTHS = [320, 375, 414, 600, 768, 860, 861, 1024, 1100, 1280, 1440, 1920, 2560];

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const width of WIDTHS) {
	test.describe(`Café, ${width} px wide window`, () => {
		test.use({ viewport: { width, height: 800 } });

		test('final state: the moka whole, nothing overflows sideways', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await sectionAtTop(page);

			expectWholeMoka(await cafeLayout(page));
			expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
		});

		test('scene: nothing overflows sideways from start to end, close-up included', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			const start = await sceneStart(page);

			for (const progress of [0, 0.5, 0.7, 1]) {
				await scrollToScene(page, start, progress);
				expectWholeMoka(await cafeLayout(page));
				expect(await horizontalOverflow(page), `at ${progress}`).toBeLessThanOrEqual(0);
			}
		});
	});
}

test.describe('Café, the window changes without a reload', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	const PHONE = { width: 390, height: 844 };
	const PHONE_ON_ITS_SIDE = { width: 844, height: 390 };
	const LAPTOP = { width: 1280, height: 800 };

	/** From the top of the page, where the section has not been pinned yet, to a point of the scene. */
	async function toScene(page: Page, progress: number) {
		await page.evaluate(() => scrollTo(0, 0));
		await topOnceStill(section(page));
		await scrollToScene(page, await sceneStart(page), progress);
	}

	test('final state: the layout follows the window, turned and resized', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await sectionAtTop(page);
		expectTwoColumns(await cafeLayout(page));

		for (const size of [PHONE, PHONE_ON_ITS_SIDE]) {
			await page.setViewportSize(size);
			await sectionAtTop(page);
			expectStacked(await cafeLayout(page));
		}

		await page.setViewportSize(LAPTOP);
		await sectionAtTop(page);
		expectTwoColumns(await cafeLayout(page));
	});

	test('scene: the pinning, the scale and the rise of the text follow the window', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		await toScene(page, 0.95);
		expectTwoColumns(await cafeLayout(page));

		for (const size of [PHONE, PHONE_ON_ITS_SIDE]) {
			await page.setViewportSize(size);
			await toScene(page, 0.5);
			expect(Math.abs(await topOnceStill(section(page))), `pinned at ${size.width}×${size.height}`).toBeLessThanOrEqual(1);
			expectStacked(await cafeLayout(page));
			expect(await opacityOnScreen(paragraph(page))).toBe(1);
		}

		await page.setViewportSize(LAPTOP);
		await toScene(page, 0.5);
		expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		expectTwoColumns(await cafeLayout(page));
		expect(await opacityOnScreen(paragraph(page))).toBe(0);
		await toScene(page, 0.95);
		expect(await opacityOnScreen(paragraph(page))).toBe(1);
	});
});

// Phones held upright and on their side, a tablet upright, and a wide window too low for two columns.
const STACKED = [
	{ name: 'small phone, portrait', width: 320, height: 568 },
	{ name: 'phone, portrait', width: 390, height: 844 },
	{ name: 'phone, landscape', width: 844, height: 390 },
	{ name: 'just under the breakpoint', width: 860, height: 800 },
	{ name: 'tablet, portrait', width: 768, height: 1024 },
	{ name: 'large phone, landscape', width: 932, height: 430 },
	{ name: 'just under the height threshold', width: 1280, height: 519 },
];

for (const { name, width, height } of STACKED) {
	test.describe(`Café stacked, ${name} (${width}×${height})`, () => {
		test.use({ viewport: { width, height } });

		test('final state: title, counter and rule, then the whole moka; the paragraph and actions follow', async ({
			page,
		}) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await sectionAtTop(page);

			expectStacked(await cafeLayout(page));
		});

		test('scene: pinned, the layout holds; the paragraph and actions wait after the screen, not animated', async ({
			page,
		}) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);

			// Before, during and after the board's rise of the paragraph (76–82%) and the actions (80–86%).
			for (const progress of [0.5, 0.79, 0.95]) {
				await scrollToScene(page, start, progress);
				expect(Math.abs(await topOnceStill(section(page))), `pinned at ${progress}`).toBeLessThanOrEqual(1);
				expectStacked(await cafeLayout(page));
				expect(await opacityOnScreen(paragraph(page)), `paragraph at ${progress}`).toBe(1);
				expect(await opacityOnScreen(coffee(page)), `actions at ${progress}`).toBe(1);
				expect(await verticalTranslation(paragraph(page))).toBe(0);
			}
		});
	});
}
