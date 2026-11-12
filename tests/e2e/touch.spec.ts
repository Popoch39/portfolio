import { devices, expect, test, type Page } from './fixtures';
import { friseSection } from './frise-helpers';
import { expectNativeScrolling, scrollPosition, swipeUp, topInPage, topOnceStill, verticalTranslation } from './helpers';

// Chromium project only (see playwright.config.ts): Firefox does not emulate `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

test.describe('under a finger', () => {
	test.use({
		viewport,
		userAgent,
		deviceScaleFactor,
		hasTouch: true,
		isMobile: true,
		reducedMotion: 'no-preference',
	});

	test('no smoothing: the page scrolls natively under the finger', async ({ page }) => {
		await page.goto('/');

		await swipeUp(page, 400);

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expectNativeScrolling(page);
	});

	// Pinned by a transform, the section is moved by script a frame behind the compositor's scroll:
	// on iOS it jumps into place and the fling dies at the start of every pinned scene. The Frise is
	// sticky rather than fixed: switching to `fixed` would shift its 3D layers (ADR 0001).
	for (const [scene, section, position] of [
		['Frise', friseSection, 'sticky'],
		['Atome', (page: Page) => page.locator('section:has([data-atome])'), 'fixed'],
	] as const) {
		test(`${scene}: the browser holds the pinned section in place, not a script`, async ({ page }) => {
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const pinned = section(page);
			const start = await topInPage(pinned);

			for (const screens of [1, 2]) {
				await page.evaluate(([top, at]) => scrollTo(0, top + at * innerHeight), [start, screens]);
				await topOnceStill(pinned);

				await expect(pinned).toHaveCSS('position', position);
				expect(await verticalTranslation(pinned)).toBe(0);
			}
		});
	}

	test('a tap leaves no hover state behind: every `:hover` rule waits for a fine hovering pointer', async ({
		page,
	}) => {
		await page.goto('/');

		// A finger fakes `:hover` on the tapped element and keeps it until the next tap elsewhere.
		const ungated = await page.evaluate(() => {
			const gate = '(hover: hover) and (pointer: fine)';
			const found: string[] = [];
			const visit = (rules: CSSRuleList, gated: boolean) => {
				for (const rule of rules) {
					if (rule instanceof CSSMediaRule) visit(rule.cssRules, gated || rule.conditionText === gate);
					else if (rule instanceof CSSGroupingRule) visit(rule.cssRules, gated);
					else if (rule instanceof CSSStyleRule && rule.selectorText.includes(':hover') && !gated)
						found.push(rule.selectorText);
				}
			};
			for (const sheet of document.styleSheets) visit(sheet.cssRules, false);
			return found;
		});

		expect(ungated).toEqual([]);
	});

	test('no Traîne: a finger has no cursor to draw, and a tap brings no ring', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('body')).toHaveCSS('cursor', 'auto');
		await expect(page.locator('main p').first()).toHaveCSS('cursor', 'auto');
		await expect(page.locator('main a[href]').first()).toHaveCSS('cursor', 'pointer');

		await page.touchscreen.tap(200, 300);
		await swipeUp(page, 200);
		await expect(page.locator('[data-trail]')).toBeHidden();
	});

	test('the page runs under the notch and the home indicator, without the tap flash', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
		const highlight = await page.evaluate(
			() => getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'),
		);
		expect(highlight).toBe('rgba(0, 0, 0, 0)');
	});
});
