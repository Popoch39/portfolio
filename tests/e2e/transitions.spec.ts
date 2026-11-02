import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { allongerLaPage, contenu, defilerALaMolette, translationVerticale } from './outils';

/** Erreurs console et exceptions non rattrapées, collectées sur toute la visite. */
function erreursDe(page: Page): string[] {
	const erreurs: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') erreurs.push(message.text());
	});
	page.on('pageerror', (erreur) => erreurs.push(erreur.message));
	return erreurs;
}

/** Tout le CSS que reçoit le navigateur pour une page : blocs `<style>` en ligne et feuilles liées. */
async function cssServi(request: APIRequestContext, chemin: string): Promise<string> {
	const html = await (await request.get(chemin)).text();
	const enLigne = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
	const liens = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
		.map((m) => /href="([^"]+)"/.exec(m[0])?.[1])
		.filter((href): href is string => !!href);
	const feuilles = await Promise.all(
		liens.map(async (href) => (await request.get(new URL(href, `http://x${chemin}`).pathname)).text()),
	);
	return [...enLigne, ...feuilles].join('\n');
}

test('le CSS servi déclare la view transition cross-document', async ({ request }) => {
	expect(await cssServi(request, '/')).toMatch(/@view-transition\s*\{\s*navigation:\s*auto\s*;?\s*\}/);
});

test.describe('navigation entre pages, mouvement autorisé', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('l’accueil et la seconde page se lient dans les deux sens, chacune avec son titre et sa description', async ({
		page,
	}) => {
		await page.goto('/');
		const titreAccueil = await page.title();
		const descriptionAccueil = await page.locator('meta[name="description"]').getAttribute('content');

		await page.getByRole('link', { name: 'About' }).click();
		await expect(page).toHaveURL('/about/');
		await expect(page).not.toHaveTitle(titreAccueil);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
		await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
			'content',
			descriptionAccueil ?? '',
		);

		await page.getByRole('link', { name: 'Home' }).click();
		await expect(page).toHaveURL('/');
		await expect(page).toHaveTitle(titreAccueil);
	});

	test('aller sur la seconde page puis revenir en arrière retrouve l’accueil avec le défilement lissé, sans erreur', async ({
		page,
	}) => {
		const erreurs = erreursDe(page);
		await page.goto('/');
		await page.getByRole('link', { name: 'About' }).click();
		await expect(page).toHaveURL('/about/');

		await page.goBack();
		await expect(page).toHaveURL('/');
		await allongerLaPage(page);
		await defilerALaMolette(page, 600);

		await expect.poll(() => translationVerticale(contenu(page))).toBeLessThan(0);
		expect(erreurs).toEqual([]);
	});
});
