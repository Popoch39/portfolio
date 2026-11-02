import { expect, type Locator, type Page } from '@playwright/test';

export const enveloppe = (page: Page) => page.locator('#smooth-wrapper');
export const contenu = (page: Page) => page.locator('#smooth-content');
export const entete = (page: Page) => page.getByRole('banner');

export const positionDeDefilement = (page: Page) => page.evaluate(() => scrollY);

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

/** Le contenu enveloppé suit le défilement par une transformation : le lissage est à l'œuvre. */
export async function attendreLeDefilementLisse(page: Page) {
	await expect.poll(() => translationVerticale(contenu(page))).toBeLessThan(0);
}

/** Ni transformation ni enveloppe fixe : le contenu remonte d'autant que la page a défilé. */
export async function attendreLeDefilementNatif(page: Page) {
	await expect.poll(() => transformationCalculee(contenu(page))).toBe('none');
	await expect(enveloppe(page)).not.toHaveCSS('position', 'fixed');
	const { haut, defilement } = await contenu(page).evaluate((el) => ({
		haut: el.getBoundingClientRect().top,
		defilement: scrollY,
	}));
	expect(haut).toBeCloseTo(-defilement, 0);
}

/**
 * Haut de l'élément dans la fenêtre une fois le défilement arrêté (lissé ou non) :
 * immobile pendant dix images de suite.
 */
export function hautUneFoisImmobile(element: Locator): Promise<number> {
	return element.evaluate(
		(el) =>
			new Promise<number>((resoudre) => {
				let precedent = Number.NaN;
				let imagesImmobiles = 0;
				const mesurer = () => {
					const haut = el.getBoundingClientRect().top;
					imagesImmobiles = Math.abs(haut - precedent) < 0.5 ? imagesImmobiles + 1 : 0;
					precedent = haut;
					if (imagesImmobiles >= 10) resoudre(haut);
					else requestAnimationFrame(mesurer);
				};
				requestAnimationFrame(mesurer);
			}),
	);
}

async function basDeLEntete(page: Page) {
	const boite = await entete(page).boundingBox();
	if (!boite) throw new Error('header absent');
	return boite.y + boite.height;
}

/** L'élément s'arrête juste sous le header fixe : ni caché dessous, ni laissé plus bas. */
export async function attendreJusteSousLEntete(page: Page, element: Locator) {
	const limite = await basDeLEntete(page);
	await expect
		.poll(async () => Math.abs((await hautUneFoisImmobile(element)) - limite))
		.toBeLessThanOrEqual(1);
}

/** L'élément s'arrête entièrement visible, entre le bas du header fixe et le bas de la fenêtre. */
export async function attendreVisibleSousLEntete(page: Page, element: Locator) {
	const limite = await basDeLEntete(page);
	await expect
		.poll(async () => {
			const haut = await hautUneFoisImmobile(element);
			const { bas, hauteurFenetre } = await element.evaluate((el) => ({
				bas: el.getBoundingClientRect().bottom,
				hauteurFenetre: innerHeight,
			}));
			return haut >= limite - 1 && bas <= hauteurFenetre + 1;
		})
		.toBe(true);
}

/** Position de l'élément dans la page, sans les transformations (ni lissage, ni scène). */
export function hautDansLaPage(element: Locator): Promise<number> {
	return element.evaluate((el) => {
		let haut = 0;
		for (let n: Element | null = el; n instanceof HTMLElement; n = n.offsetParent) {
			haut += n.offsetTop;
		}
		return haut;
	});
}

/**
 * Donne à la page de quoi défiler : l'accueil tient en un peu plus d'un écran.
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

export async function defilerALaMolette(page: Page, deltaY: number) {
	const taille = page.viewportSize();
	// La molette agit sous le pointeur : au centre, il n'est ni sur le header ni hors de la page.
	if (taille) await page.mouse.move(taille.width / 2, taille.height / 2);
	await page.mouse.wheel(0, deltaY);
}
