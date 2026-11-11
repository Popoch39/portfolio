import { expect, test, type Page } from './fixtures';

/**
 * The statusline is one fixed row: from the narrowest phone to the desktop, the segments it keeps
 * stand side by side, whole. Those that do not fit give way; none runs over its neighbour.
 */

// Every 20px from the small phone up, and both sides of each breakpoint.
const WIDTHS = [...Array.from({ length: 52 }, (_, i) => 320 + i * 20), 344, 375, 599, 601, 859, 861].sort((a, b) => a - b);

/** What is wrong with the row at this width: segments that overlap, are cut or out of the window, or a control gone. */
function rowFaults(page: Page) {
	return page.evaluate(() => {
		const row = document.querySelector('#statusline')?.getBoundingClientRect();
		// A segment that has given way sits under the row, clipped: only those on the row count.
		const onRow = (el: Element) => {
			const box = el.getBoundingClientRect();
			return box.width > 0 && !!row && box.top < row.bottom - 1;
		};
		// The switch is one segment of the row, but its choices are what must not be covered.
		const segments = [...document.querySelectorAll<HTMLElement>('#statusline .side > *, #statusline .bg > *')]
			.filter((el) => !el.matches('script, fieldset, .visually-hidden') && onRow(el))
			.map((el) => ({
				name: `${el.classList[0]} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 12)}"`,
				box: el.getBoundingClientRect(),
				cut: el.scrollWidth > el.clientWidth + 1,
			}));
		const faults: string[] = [];
		for (const [index, a] of segments.entries()) {
			if (a.box.left < -0.5 || a.box.right > innerWidth + 0.5) faults.push(`${a.name} runs out of the window`);
			if (a.cut) faults.push(`${a.name} is cut`);
			for (const b of segments.slice(index + 1)) {
				if (a.box.left < b.box.right - 0.5 && b.box.left < a.box.right - 0.5) faults.push(`${a.name} overlaps ${b.name}`);
			}
		}
		// What the visitor acts on or reads the state from never gives way.
		for (const kept of document.querySelectorAll('#statusline :is([data-vim-mode], .pause, .choice)')) {
			if (!onRow(kept)) faults.push(`${kept.classList[0]} has left the row`);
		}
		return faults;
	});
}

for (const [name, path] of [
	['the home page', '/'],
	['the 404', '/nope'],
] as const) {
	// Motion reduced: the lede stays at rest, and the row is measured in its widest state, set by hand.
	test.describe(`the statusline on ${name}`, () => {
		test.use({ reducedMotion: 'reduce' });

		test('keeps its segments side by side at every width, the buffer modified or not', async ({ page }) => {
			await page.goto(path);
			await page.evaluate(() => document.fonts.ready);
			const modified = page.locator('#statusline [data-vim-modified]');

			const faults: Record<string, string[]> = {};
			// INSERT mode shows ` [+]` after the file name: the row must hold both ways.
			for (const hidden of [true, false]) {
				await modified.evaluate((mark: HTMLElement, hide) => {
					mark.hidden = hide;
				}, hidden);
				for (const width of WIDTHS) {
					await page.setViewportSize({ width, height: 700 });
					const found = await rowFaults(page);
					if (found.length > 0) faults[`${width}${hidden ? '' : ' [+]'}`] = found;
				}
			}
			expect(faults).toEqual({});
		});

		test('entering INSERT moves no segment: the file name keeps the room of its `[+]`', async ({ page }) => {
			await page.goto(path);
			await page.evaluate(() => document.fonts.ready);
			const modified = page.locator('#statusline [data-vim-modified]');
			const row = () =>
				page.evaluate(() =>
					[...document.querySelectorAll('#statusline .side > *')].map((el) => {
						const box = el.getBoundingClientRect();
						return [box.left, box.top, box.width];
					}),
				);

			for (const width of WIDTHS) {
				await page.setViewportSize({ width, height: 700 });
				await modified.evaluate((mark: HTMLElement) => {
					mark.hidden = true;
				});
				const before = await row();
				await modified.evaluate((mark: HTMLElement) => {
					mark.hidden = false;
				});
				expect(await row(), `at ${width}px`).toEqual(before);
			}
		});
	});
}

test.describe('the statusline on a phone', () => {
	test.use({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });

	test('keeps the Pause and every `:set bg=` choice wide enough for a finger', async ({ page }) => {
		await page.goto('/');

		for (const control of await page.locator('#statusline :is(.pause, .choice)').all()) {
			const box = await control.boundingBox();
			expect(box?.width).toBeGreaterThanOrEqual(44);
		}
	});
});
