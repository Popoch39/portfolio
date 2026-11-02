import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	computedTransform,
	content,
	expectSmoothScrolling,
	scrollWithWheel,
	topInPage,
	verticalTranslation,
	wrapper,
} from './helpers';

const reveal = (page: Page) => page.locator('[data-reveal-target]').first();
const opacity = (element: Locator) => element.evaluate((el) => Number(getComputedStyle(el).opacity));

/** Starting state: invisible and shifted down. */
async function expectStartingState(element: Locator) {
	await expect.poll(() => opacity(element)).toBe(0);
	await expect.poll(() => verticalTranslation(element)).toBeGreaterThan(0);
}

/** Final state: the one HTML/CSS render on their own. */
async function expectFinalState(element: Locator) {
	await expect.poll(() => opacity(element)).toBe(1);
	await expect.poll(() => verticalTranslation(element)).toBe(0);
}

/** Scrolls until the top of the element sits at 80 % of the window: it has just entered the view. */
async function bringIntoView(page: Page, element: Locator) {
	const top = await topInPage(element);
	await page.evaluate((y) => scrollTo(0, y - innerHeight * 0.8), top);
}

test.describe('reveal, motion allowed', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('out of view at load, it starts from its starting state then reaches its final state', async ({
		page,
	}) => {
		await page.goto('/');
		const element = reveal(page);
		await expect(element).not.toBeInViewport();
		await expectStartingState(element);

		await bringIntoView(page, element);

		await expect(element).toBeInViewport();
		await expectFinalState(element);
	});

	test('flipping the preference during the visit stops the scene and the smoothing, then restores them', async ({
		page,
	}) => {
		await page.goto('/');
		const element = reveal(page);
		await expectStartingState(element);
		await expect(wrapper(page)).toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expectFinalState(element);
		await expect(wrapper(page)).not.toHaveCSS('position', 'fixed');
		await expect.poll(() => computedTransform(content(page))).toBe('none');

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expectStartingState(element);
		await expect(wrapper(page)).toHaveCSS('position', 'fixed');

		await scrollWithWheel(page, 600);
		await expectSmoothScrolling(page);
		await bringIntoView(page, element);
		await expectFinalState(element);
	});
});

test.describe('reveal after a resize', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 1200 } });

	test('it still triggers as it enters the view', async ({ page }) => {
		await page.goto('/');
		const element = reveal(page);
		await expectStartingState(element);

		// A window half as tall: the reveal moves up the page, and its trigger threshold measured
		// before the resize would fall below it.
		await page.setViewportSize({ width: 1280, height: 600 });
		await expect(element).not.toBeInViewport();
		await expectStartingState(element);

		await bringIntoView(page, element);

		await expect(element).toBeInViewport();
		await expectFinalState(element);
	});
});

test.describe('reveal, reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('it is at its final state from the load, out of view', async ({ page }) => {
		await page.goto('/');
		const element = reveal(page);
		await expect(element).not.toBeInViewport();
		await expectFinalState(element);
	});
});

test.describe('reveal, without JavaScript', () => {
	test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });

	test('it is at its final state from the load, out of view', async ({ page }) => {
		await page.goto('/');
		const element = reveal(page);
		await expect(element).not.toBeInViewport();
		await expectFinalState(element);
	});
});
