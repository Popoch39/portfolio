import { expect, test } from './fixtures';
import { computedTransform, content, statusline } from './helpers';
import { LANGAGES, bandPoint, inkOf, tool, towerLook } from './stack-aim-helpers';

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('all the content is visible, at its final state', async ({ page }) => {
		await page.goto('/');

		// The hero's night (ADR 0008) is a drawing over the content, aria-hidden: without JavaScript, there is none.
		const elements = content(page).locator(
			':is(h1, h2, h3, h4, p, a, img, li, figure, section):not(.sky *)',
		);
		expect(await elements.count()).toBeGreaterThan(0);
		for (const element of await elements.all()) {
			await expect(element).toBeVisible();
			await expect(element).toHaveCSS('opacity', '1');
		}
		expect(await computedTransform(content(page))).toBe('none');
	});

	test('the tower stands at its final state, and aiming at a bague changes nothing', async ({ page }) => {
		await page.goto('/');
		await tool(page, 'Rust').scrollIntoViewIfNeeded();
		const atRest = await towerLook(page);
		expect(atRest.map(({ accent }) => accent)).toEqual(atRest.map(() => 0));
		const ink = await inkOf(page, LANGAGES);

		await tool(page, 'Rust').hover();
		const { x, y } = await bandPoint(page, LANGAGES);
		await page.mouse.move(x, y);

		expect(await towerLook(page)).toEqual(atRest);
		expect(await inkOf(page, LANGAGES)).toBe(ink);
		await expect(statusline(page).locator('.message')).toBeHidden();
		await expect(statusline(page).locator('.branch')).toBeVisible();
	});

	test('the statusline carries no message, and the address is a plain mail link', async ({ page }) => {
		await page.goto('/');

		const mail = page.getByRole('link', { name: 'pocheron.louis@gmail.com' });
		await expect(mail).toHaveAttribute('href', 'mailto:pocheron.louis@gmail.com');
		// Nothing would copy it: the pointer must not say so.
		await expect(mail).toHaveCSS('cursor', 'pointer');
		await expect(statusline(page).locator('.mode:visible').first()).toHaveText('NORMAL');
		await expect(statusline(page).locator('.message')).toBeHidden();
		await expect(statusline(page).locator('.branch')).toBeVisible();
		await expect(statusline(page).locator('.file')).toBeVisible();
	});
});
