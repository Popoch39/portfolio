import { devices, expect, test } from './fixtures';
import { expectNativeScrolling, scrollPosition, swipeUp } from './helpers';

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

	test('the page runs under the notch and the home indicator, without the tap flash', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
		const highlight = await page.evaluate(
			() => getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'),
		);
		expect(highlight).toBe('rgba(0, 0, 0, 0)');
	});
});
