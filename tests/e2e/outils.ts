import { expect, type Locator, type Page } from '@playwright/test';

export const enveloppe = (page: Page) => page.locator('#smooth-wrapper');
export const contenu = (page: Page) => page.locator('#smooth-content');

/** Décalage vertical (px) que la transformation calculée impose à l'élément, 0 sans transformation. */
export function translationVerticale(element: Locator): Promise<number> {
	return element.evaluate((el) => {
		const transform = getComputedStyle(el).transform;
		return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
	});
}

export function transformationCalculee(element: Locator): Promise<string> {
	return element.evaluate((el) => getComputedStyle(el).transform);
}

/**
 * Donne à la page de quoi défiler : l'accueil tient pour l'instant dans un écran.
 * Attend que le document soit devenu défilable, smoother compris (il recalcule la hauteur du body).
 */
export async function allongerLaPage(page: Page) {
	await contenu(page).evaluate((el) => {
		const bloc = document.createElement('div');
		bloc.dataset.testAllonge = '';
		bloc.style.height = '300vh';
		el.append(bloc);
	});
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
		.toBeGreaterThan(1000);
}

/**
 * Glisse le doigt vers le haut au centre de la fenêtre (Chromium seulement, contexte `hasTouch`).
 * `Input.synthesizeScrollGesture` ne fait pas défiler le headless shell : on rejoue les événements tactiles.
 */
export async function glisserAuDoigt(page: Page, distance: number) {
	const taille = page.viewportSize();
	if (!taille) throw new Error('glisserAuDoigt : fenêtre sans taille');
	const x = taille.width / 2;
	const depart = taille.height * 0.8;
	const etapes = 10;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: depart }] });
	for (let i = 1; i <= etapes; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x, y: depart - (distance * i) / etapes }],
		});
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

/** Défile à la molette au centre de la fenêtre. */
export async function defilerALaMolette(page: Page, deltaY: number) {
	const taille = page.viewportSize();
	if (taille) await page.mouse.move(taille.width / 2, taille.height / 2);
	await page.mouse.wheel(0, deltaY);
}
