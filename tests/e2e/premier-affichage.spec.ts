import { expect, test, type Page } from '@playwright/test';
import { enveloppe } from './outils';

// Le smoother fixe l'enveloppe et transforme le contenu : un élément positionné par rapport à la
// fenêtre changerait alors de bloc conteneur et sauterait au démarrage du lissage (décalage de mise en page).
const boites = (page: Page) =>
	Promise.all(['#news', '#background'].map((selecteur) => page.locator(selecteur).boundingBox()));

test.describe('premier affichage', () => {
	test.use({ reducedMotion: 'reduce' });

	test('les éléments positionnés du hero gardent leur place quand le défilement lissé démarre', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');
		const sansLissage = await boites(page);
		await expect(page.locator('#news')).toBeInViewport({ ratio: 1 });

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(enveloppe(page)).toHaveCSS('position', 'fixed');

		expect(await boites(page)).toEqual(sansLissage);
	});
});
