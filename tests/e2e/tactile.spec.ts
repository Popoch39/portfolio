import { devices, expect, test } from '@playwright/test';
import {
	allongerLaPage,
	attendreLeDefilementNatif,
	glisserAuDoigt,
	positionDeDefilement,
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

		await expect.poll(() => positionDeDefilement(page)).toBeGreaterThan(0);
		await attendreLeDefilementNatif(page);
	});
});
