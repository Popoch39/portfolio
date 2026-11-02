import { expect, test } from '@playwright/test';
import {
	allongerLaPage,
	contenu,
	defilerALaMolette,
	enveloppe,
	transformationCalculee,
	translationVerticale,
} from './outils';

test.describe('défilement lissé, mouvement autorisé', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('à la molette, le contenu enveloppé suit le défilement par une transformation', async ({
		page,
	}) => {
		await page.goto('/');
		await allongerLaPage(page);

		await defilerALaMolette(page, 600);

		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		await expect.poll(() => translationVerticale(contenu(page))).toBeLessThan(0);
	});

	test('la préférence basculée pendant la visite arrête puis relance le défilement lissé', async ({
		page,
	}) => {
		await page.goto('/');
		await allongerLaPage(page);
		await expect(enveloppe(page)).toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect.poll(() => transformationCalculee(contenu(page))).toBe('none');
		await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await defilerALaMolette(page, 600);
		await expect.poll(() => translationVerticale(contenu(page))).toBeLessThan(0);
	});
});
