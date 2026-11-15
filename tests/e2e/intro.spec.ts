// Not `./fixtures`: these visits are direct, without a referrer from the site.
import { expect, test, type Page } from '@playwright/test';
import { drawPaper, scrollPosition, scrollWithWheel, statusline } from './helpers';

// A direct visit draws its paper by lot: these specs play the assembly on Auto.
test.beforeEach(({ page }) => drawPaper(page, 'auto'));

const SCREENS = [
	['desktop', { width: 1280, height: 720 }],
	['phone', { width: 390, height: 844 }],
] as const;

const hero = (page: Page) => page.locator('[data-hero]');
const bench = (page: Page) => page.locator('[data-bench]');
const replay = (page: Page) => page.getByRole('button', { name: 'Rejouer' });

const playing = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('intro'));

/** The hero's animations still running, the assembly's and the text's. */
const running = (page: Page) =>
	page.evaluate(() => {
		const root = document.querySelector('[data-hero]');
		return document
			.getAnimations()
			.filter(
				(animation) =>
					animation.playState === 'running' &&
					animation.effect instanceof KeyframeEffect &&
					animation.effect.target instanceof Element &&
					root?.contains(animation.effect.target),
			).length;
	});

/** Waits for the assembly to end: the class is gone and nothing of the hero moves. */
async function waitForTheEnd(page: Page) {
	await expect.poll(() => playing(page), { timeout: 10_000 }).toBe(false);
	await expect.poll(() => running(page)).toBe(0);
}

/** Every part of the board and every line of the text at rest: fully opaque, without a transform. */
async function expectFinalState(page: Page) {
	const moved = await hero(page).evaluate((root) =>
		[...root.querySelectorAll('*')]
			// The parts' own drawings, and what the lede's typist moves once it has started.
			.filter((element) => !element.closest('svg, [data-keys], [data-audience]'))
			// An animation held at its end leaves an identity matrix rather than `none`: the same place.
			.filter((element) => {
				const style = getComputedStyle(element);
				return !new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform).isIdentity || style.opacity !== '1';
			})
			.map((element) => element.className.toString()),
	);
	expect(moved).toEqual([]);
}

/** From the page's start, how many scenes are pinned at the very moment the assembly ends. */
async function recordPinsAtTheEnd(page: Page) {
	await page.addInitScript(() => {
		let started = false;
		// On the document: its root element may not exist yet when this runs.
		new MutationObserver((_, observer) => {
			const intro = document.documentElement?.classList.contains('intro') ?? false;
			if (intro) started = true;
			if (intro || !started) return;
			window.testPinsAtTheEnd = document.querySelectorAll('.pin-spacer').length;
			observer.disconnect();
		}).observe(document, { subtree: true, attributeFilter: ['class'] });
	});
	return () => page.evaluate(() => window.testPinsAtTheEnd);
}

declare global {
	interface Window {
		testPinsAtTheEnd?: number;
	}
}

for (const [screen, viewport] of SCREENS) {
	test.describe(`the Établi’s assembly, on a ${screen}`, () => {
		test.use({ reducedMotion: 'no-preference', viewport });

		test('plays on a direct visit, then the hero rests at its final state', async ({ page }) => {
			await page.goto('/');
			expect(await playing(page)).toBe(true);
			expect(await running(page)).toBeGreaterThan(0);

			await waitForTheEnd(page);

			await expectFinalState(page);
		});

		test('every part moves on its transform or its opacity alone: the compositor plays it', async ({ page }) => {
			await page.goto('/');

			const properties = await page.evaluate(() => {
				const root = document.querySelector('[data-hero]');
				const found = new Set<string>();
				for (const animation of document.getAnimations()) {
					const effect = animation.effect;
					if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element) || !root?.contains(effect.target)) continue;
					for (const frame of effect.getKeyframes()) {
						for (const key of Object.keys(frame)) {
							if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) found.add(key);
						}
					}
				}
				return [...found].sort();
			});
			expect(properties).toEqual(['opacity', 'transform']);
		});

		test('the parts fly from outside the window without widening the page', async ({ page }) => {
			await page.goto('/');
			await page.waitForTimeout(1_000);
			expect(await playing(page)).toBe(true);

			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
			expect(overflow).toBeLessThanOrEqual(0);
		});

		test('nothing moves in the layout while it plays', async ({ page }) => {
			const boxes = () =>
				Promise.all([page.locator('h1'), bench(page), page.locator('.hero-actions'), statusline(page)].map((l) => l.boundingBox()));
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const playingBoxes = await boxes();

			await waitForTheEnd(page);

			expect(await boxes()).toEqual(playingBoxes);
		});

		test('the scenes further down are built while the parts fly, before it ends', async ({ page }) => {
			const pinnedAtTheEnd = await recordPinsAtTheEnd(page);
			await page.goto('/');

			await waitForTheEnd(page);

			expect(await pinnedAtTheEnd()).toBeGreaterThan(0);
		});

		test('the lede is not rewritten before it has ended', async ({ page }) => {
			const keys = page.locator('[data-lede] [data-keys] > *');
			await page.goto('/');
			await expect.poll(() => playing(page)).toBe(true);
			await expect(keys).toHaveCount(0);

			await waitForTheEnd(page);
			await expect.poll(() => keys.count(), { timeout: 10_000 }).toBeGreaterThan(0);
		});

		test('« Rejouer » plays the board’s assembly again, from its start, and leaves it at rest', async ({ page }) => {
			await page.goto('/');
			await waitForTheEnd(page);

			// From the keyboard: below the fold on a phone, a pointer would aim through the smoother's transform.
			await replay(page).press('Enter');

			await expect.poll(() => running(page)).toBeGreaterThan(0);
			const progress = await bench(page).evaluate((element) =>
				Math.max(...element.getAnimations({ subtree: true }).map((animation) => Number(animation.currentTime))),
			);
			expect(progress).toBeLessThan(1_000);
			// The board alone: the text stays put.
			expect(await page.locator('h1 .tx').first().evaluate((line) => line.getAnimations().length)).toBe(0);

			await expect.poll(() => running(page), { timeout: 10_000 }).toBe(0);
			await expectFinalState(page);

			// Again, once more from the start.
			await replay(page).press('Enter');
			await expect.poll(() => running(page)).toBeGreaterThan(0);
			await expect.poll(() => running(page), { timeout: 10_000 }).toBe(0);
		});

		test('flipping to reduced motion while it plays brings the page back to its final state', async ({ page }) => {
			await page.goto('/');
			await page.waitForTimeout(500);

			await page.emulateMedia({ reducedMotion: 'reduce' });

			await waitForTheEnd(page);
			await expectFinalState(page);
			await expect(replay(page)).toBeHidden();
		});

		test('does not play with an anchor in the URL', async ({ page }) => {
			await page.goto('/#parcours');

			expect(await playing(page)).toBe(false);
			expect(await running(page)).toBe(0);
		});

		test('does not play when arriving from another page of the site', async ({ page }) => {
			await page.goto('/this-page-does-not-exist/');

			await page.getByRole('link', { name: 'Retour à l’accueil' }).click();

			await expect(page).toHaveURL('/');
			expect(await playing(page)).toBe(false);
			expect(await running(page)).toBe(0);
		});

		test('does not play again when coming back through history', async ({ page }) => {
			await page.goto('/');
			await waitForTheEnd(page);
			await page.goto('about:blank');

			await page.goBack();

			await expect(page).toHaveURL('/');
			expect(await playing(page)).toBe(false);
		});

		test('a reload replays it from the top of the page, not from where the visitor had scrolled', async ({ page }) => {
			await page.goto('/');
			await waitForTheEnd(page);
			await scrollWithWheel(page, 1_500);
			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(500);

			await page.reload();

			expect(await playing(page)).toBe(true);
			await page.waitForLoadState('load');
			// Restoring the scroll happens around `load`: the page must stay at the top past it.
			await page.waitForTimeout(500);
			expect(await scrollPosition(page)).toBe(0);
		});
	});
}

test.describe('the Établi’s assembly, when its module cannot run', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('no script loads: the board still assembles, and the belt takes the class away', async ({ page }) => {
		await page.route(/\/_astro\/.*\.js$/, (route) => route.abort());
		await page.goto('/');
		expect(await playing(page)).toBe(true);

		// The assembly (3.9 s) and the belt's margin.
		await expect.poll(() => playing(page), { timeout: 10_000 }).toBe(false);
		await expectFinalState(page);
	});
});

test.describe('the Établi’s assembly, reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('does not play: the page is at its final state, with nothing to replay', async ({ page }) => {
		await page.goto('/');

		expect(await playing(page)).toBe(false);
		expect(await running(page)).toBe(0);
		await expectFinalState(page);
		await expect(replay(page)).toBeHidden();
	});
});

test.describe('the Établi’s assembly, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the board stands assembled, and no button offers to replay it', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('h1')).toBeVisible();
		await expect(page.getByRole('img', { name: /Clavier mécanique/ })).toBeVisible();
		await expect(replay(page)).toBeHidden();
	});
});
