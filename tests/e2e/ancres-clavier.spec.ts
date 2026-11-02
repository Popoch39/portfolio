import { expect, test } from '@playwright/test';
import { allongerLaPage, contenu, defilerALaMolette } from './outils';

// Sous défilement lissé, le smoother doit amener les ancres ; en mouvement réduit, le navigateur
// le fait seul et le socle ne doit pas s'en mêler.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	test.describe(`ancres, mouvement ${reducedMotion}`, () => {
		test.use({ reducedMotion });

		test('le lien d’ancre du header amène la section cible dans la vue', async ({ page }) => {
			await page.goto('/');
			const cible = page.locator('#contact');
			await expect(cible).not.toBeInViewport();

			await page.getByRole('banner').getByRole('link', { name: 'Contact' }).click();

			await expect(cible).toBeInViewport();
			// C'est le document qui a défilé : la molette et le clavier repartent de la section.
			await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
			await expect(page).toHaveURL(/#contact$/);
		});

		test('l’accueil chargé avec l’ancre dans l’URL s’ouvre sur la section cible', async ({ page }) => {
			await page.goto('/#contact');

			await expect(page.locator('#contact')).toBeInViewport();
			await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		});
	});
}

test.describe('header et clavier sous défilement lissé', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('le header garde sa place à l’écran après un défilement à la molette', async ({ page }) => {
		await page.goto('/');
		await allongerLaPage(page);
		const header = page.getByRole('banner');
		await expect(header).toBeInViewport();
		const avant = await header.boundingBox();

		await defilerALaMolette(page, 600);

		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		await expect.poll(() => header.boundingBox()).toEqual(avant);
		await expect(header).toBeInViewport();
	});

	test('Tab jusqu’à un lien placé plus bas l’amène dans la vue', async ({ page }) => {
		await page.goto('/');
		const lien = page.locator('#contact').getByRole('link');
		await expect(lien).not.toBeInViewport();

		for (let i = 0; i < 20 && !(await lien.evaluate((el) => el === document.activeElement)); i++) {
			await page.keyboard.press('Tab');
		}

		await expect(lien).toBeFocused();
		await expect(lien).toBeInViewport();
	});

	test('la touche Fin amène le bas de la page dans la vue', async ({ page }) => {
		await page.goto('/');

		await page.keyboard.press('End');

		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY))
			.toBeLessThan(1);
		await expect(page.locator('#contact').getByRole('link')).toBeInViewport();
	});

	test('aucun élément du contenu enveloppé n’est en `position: sticky`', async ({ page }) => {
		await page.goto('/');

		// Le contenu est transformé par le smoother : un sticky y décroche, l'épinglage passe par `pin`.
		const collants = await contenu(page).evaluate((el) =>
			[el, ...el.querySelectorAll('*')]
				.filter((e) => getComputedStyle(e).position === 'sticky')
				.map((e) => e.outerHTML.slice(0, 80)),
		);
		expect(collants).toEqual([]);
	});
});
