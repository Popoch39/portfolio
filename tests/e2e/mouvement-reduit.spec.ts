import { expect, test } from '@playwright/test';
import {
	allongerLaPage,
	attendreLeDefilementNatif,
	defilerALaMolette,
	positionDeDefilement,
} from './outils';

test.describe('mouvement réduit', () => {
	test.use({ reducedMotion: 'reduce' });

	test('pas de défilement lissé : le contenu défile nativement, sans transformation', async ({
		page,
	}) => {
		await page.goto('/');
		await allongerLaPage(page);

		await defilerALaMolette(page, 600);

		await expect.poll(() => positionDeDefilement(page)).toBeGreaterThan(0);
		await attendreLeDefilementNatif(page);
	});
});
