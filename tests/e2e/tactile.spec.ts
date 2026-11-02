import { devices, expect, test } from '@playwright/test';
import {
	allongerLaPage,
	contenu,
	enveloppe,
	glisserAuDoigt,
	transformationCalculee,
} from './outils';

// Projet Chromium seulement (voir playwright.config.ts) : Firefox n'émule pas `isMobile`.
const { viewport, userAgent, deviceScaleFactor } = devices['Pixel 7'];

test.describe('au doigt', () => {
	test.use({
		viewport,
		userAgent,
		deviceScaleFactor,
		hasTouch: true,
		isMobile: true,
		reducedMotion: 'no-preference',
	});

	test('pas de lissage : la page défile nativement sous le doigt', async ({ page }) => {
		await page.goto('/');
		await allongerLaPage(page);

		await glisserAuDoigt(page, 400);

		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		expect(await transformationCalculee(contenu(page))).toBe('none');
		await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');
		const { haut, defilement } = await contenu(page).evaluate((el) => ({
			haut: el.getBoundingClientRect().top,
			defilement: scrollY,
		}));
		expect(haut).toBeCloseTo(-defilement, 0);
	});
});
