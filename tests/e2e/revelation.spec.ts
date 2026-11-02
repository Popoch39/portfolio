import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	attendreLeDefilementLisse,
	contenu,
	defilerALaMolette,
	enveloppe,
	hautDansLaPage,
	transformationCalculee,
	translationVerticale,
} from './outils';

const revelation = (page: Page) => page.locator('[data-revelation-cible]').first();
const opacite = (element: Locator) =>
	element.evaluate((el) => Number(getComputedStyle(el).opacity));

/** État de départ : invisible et décalée vers le bas. */
async function attendreEtatDeDepart(element: Locator) {
	await expect.poll(() => opacite(element)).toBe(0);
	await expect.poll(() => translationVerticale(element)).toBeGreaterThan(0);
}

/** État final : celui que rend le HTML/CSS seul. */
async function attendreEtatFinal(element: Locator) {
	await expect.poll(() => opacite(element)).toBe(1);
	await expect.poll(() => translationVerticale(element)).toBe(0);
}

test.describe('révélation, mouvement autorisé', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('hors de la vue au chargement, elle part de son état de départ puis atteint son état final', async ({
		page,
	}) => {
		await page.goto('/');
		const element = revelation(page);
		await expect(element).not.toBeInViewport();
		await attendreEtatDeDepart(element);

		await defilerALaMolette(page, 2000);

		await expect(element).toBeInViewport();
		await attendreEtatFinal(element);
	});

	test('la préférence basculée pendant la visite arrête la scène et le lissage, puis les rétablit', async ({
		page,
	}) => {
		await page.goto('/');
		const element = revelation(page);
		await attendreEtatDeDepart(element);
		await expect(enveloppe(page)).toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await attendreEtatFinal(element);
		await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');
		await expect.poll(() => transformationCalculee(contenu(page))).toBe('none');

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await attendreEtatDeDepart(element);
		await expect(enveloppe(page)).toHaveCSS('position', 'fixed');

		await defilerALaMolette(page, 2000);
		await attendreLeDefilementLisse(page);
		await attendreEtatFinal(element);
	});
});

test.describe('révélation après un redimensionnement', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 1200 } });

	test('elle se déclenche toujours à son entrée dans la vue', async ({ page }) => {
		await page.goto('/');
		const element = revelation(page);
		await attendreEtatDeDepart(element);

		// Fenêtre deux fois moins haute : la révélation remonte dans la page, et son seuil
		// de déclenchement mesuré avant le redimensionnement tomberait plus bas qu'elle.
		await page.setViewportSize({ width: 1280, height: 600 });
		await expect(element).not.toBeInViewport();
		await attendreEtatDeDepart(element);

		// Le haut de la révélation à 80 % de la fenêtre : tout juste entrée dans la vue.
		const haut = await hautDansLaPage(element);
		await page.evaluate((y) => scrollTo(0, y - innerHeight * 0.8), haut);

		await expect(element).toBeInViewport();
		await attendreEtatFinal(element);
	});
});

test.describe('révélation, mouvement réduit', () => {
	test.use({ reducedMotion: 'reduce' });

	test('elle est à son état final dès le chargement, hors de la vue', async ({ page }) => {
		await page.goto('/');
		const element = revelation(page);
		await expect(element).not.toBeInViewport();
		await attendreEtatFinal(element);
	});
});

test.describe('révélation, sans JavaScript', () => {
	test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });

	test('elle est à son état final dès le chargement, hors de la vue', async ({ page }) => {
		await page.goto('/');
		const element = revelation(page);
		await expect(element).not.toBeInViewport();
		await attendreEtatFinal(element);
	});
});
