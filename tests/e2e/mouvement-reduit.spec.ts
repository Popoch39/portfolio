import { expect, test } from '@playwright/test';
import {
	allongerLaPage,
	contenu,
	defilerALaMolette,
	enveloppe,
	transformationCalculee,
} from './outils';

test.describe('mouvement réduit', () => {
	test.use({ reducedMotion: 'reduce' });

	test('pas de défilement lissé : le contenu défile nativement, sans transformation', async ({
		page,
	}) => {
		await page.goto('/');
		await allongerLaPage(page);

		await defilerALaMolette(page, 600);

		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		expect(await transformationCalculee(contenu(page))).toBe('none');
		await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');
		// Défilement natif : le contenu remonte d'autant que la page a défilé.
		const { haut, defilement } = await contenu(page).evaluate((el) => ({
			haut: el.getBoundingClientRect().top,
			defilement: scrollY,
		}));
		expect(haut).toBeCloseTo(-defilement, 0);
	});
});
