import { expect, test, type Page } from '@playwright/test';
import {
	allongerLaPage,
	attendreJusteSousLEntete,
	attendreLeDefilementLisse,
	attendreVisibleSousLEntete,
	contenu,
	defilerALaMolette,
	entete,
	hautDansLaPage,
	hautUneFoisImmobile,
	positionDeDefilement,
	translationVerticale,
} from './outils';

/**
 * Sert l'accueil avec de la place sous la section Contact, pour que l'ancre puisse l'amener en
 * haut de la fenêtre (sinon le bas de page la retient plus bas, header ou pas), et avec l'id
 * de la section remplacé si besoin. Vaut dès le chargement, ancre d'arrivée comprise.
 */
async function servirLAccueil(page: Page, { id = 'contact' } = {}) {
	await page.route('/', async (route) => {
		const reponse = await route.fetch();
		const html = (await reponse.text())
			.replace(
				'</head>',
				'<style>[data-testid=contact]::after{content:"";display:block;height:300vh}</style></head>',
			)
			.replace('id="contact"', `id="${id}" data-testid="contact"`)
			.replace('href="/#contact"', `href="/#${id}"`);
		await route.fulfill({ response: reponse, body: html });
	});
}

const sectionContact = (page: Page) => page.getByTestId('contact');
const lienContact = (page: Page) => entete(page).getByRole('link', { name: 'Contact' });

// Sous défilement lissé, le smoother doit amener les ancres ; en mouvement réduit, le navigateur
// le fait seul. Dans les deux cas, la cible s'arrête sous le header fixe, pas dessous.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	test.describe(`ancres, mouvement ${reducedMotion}`, () => {
		test.use({ reducedMotion });

		test('le lien d’ancre du header amène la section cible juste sous le header', async ({ page }) => {
			await servirLAccueil(page);
			await page.goto('/');
			await expect(sectionContact(page)).not.toBeInViewport();

			await lienContact(page).click();

			await attendreJusteSousLEntete(page, sectionContact(page));
			// C'est le document qui a défilé : la molette et le clavier repartent de la section.
			expect(await positionDeDefilement(page)).toBeGreaterThan(0);
			await expect(page).toHaveURL(/#contact$/);
		});

		test('le lien d’ancre ramène à la section même quand l’URL la porte déjà', async ({ page }) => {
			await servirLAccueil(page);
			await page.goto('/');
			await lienContact(page).click();
			await attendreJusteSousLEntete(page, sectionContact(page));
			await page.keyboard.press('Home');
			await expect.poll(() => hautUneFoisImmobile(page.locator('h1'))).toBeGreaterThan(0);

			await lienContact(page).click();

			await attendreJusteSousLEntete(page, sectionContact(page));
		});

		test('l’accueil chargé avec l’ancre dans l’URL s’ouvre sur la section cible, juste sous le header', async ({
			page,
		}) => {
			await servirLAccueil(page);
			await page.goto('/#contact');

			await attendreJusteSousLEntete(page, sectionContact(page));
			expect(await positionDeDefilement(page)).toBeGreaterThan(0);
		});

		test('changer l’ancre de l’URL sans lien amène la section cible juste sous le header', async ({
			page,
		}) => {
			await servirLAccueil(page);
			await page.goto('/');

			await page.evaluate(() => {
				location.hash = 'contact';
			});

			await attendreJusteSousLEntete(page, sectionContact(page));
		});

		test('une ancre à l’id non ASCII marche au chargement comme au clic', async ({ page }) => {
			await servirLAccueil(page, { id: 'contact-été' });
			await page.goto('/#contact-été');
			await attendreJusteSousLEntete(page, sectionContact(page));

			await page.goto('/');
			await lienContact(page).click();

			await attendreJusteSousLEntete(page, sectionContact(page));
		});
	});

	test.describe(`focus, mouvement ${reducedMotion}`, () => {
		test.use({ reducedMotion });

		test('Tab jusqu’à un lien placé plus bas l’amène dans la vue, sous le header', async ({ page }) => {
			await page.goto('/');
			const lien = page.locator('#contact').getByRole('link');
			await expect(lien).not.toBeInViewport();

			for (let i = 0; i < 20 && !(await lien.evaluate((el) => el === document.activeElement)); i++) {
				await page.keyboard.press('Tab');
			}

			await expect(lien).toBeFocused();
			await attendreVisibleSousLEntete(page, lien);
		});

		test('un lien focalisé alors qu’il est caché sous le header en ressort', async ({ page }) => {
			await page.goto('/');
			await allongerLaPage(page);
			const lien = page.locator('#contact').getByRole('link');
			const haut = await hautDansLaPage(lien);
			await page.evaluate((y) => scrollTo(0, y - 10), haut);
			await expect.poll(() => hautUneFoisImmobile(lien)).toBeLessThan(20);

			await lien.focus();

			await attendreVisibleSousLEntete(page, lien);
		});
	});
}

test.describe('header et clavier sous défilement lissé', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('le header garde sa place à l’écran après un défilement à la molette', async ({ page }) => {
		await page.goto('/');
		await allongerLaPage(page);
		const header = entete(page);
		await expect(header).toBeInViewport();
		const avant = await header.boundingBox();

		await defilerALaMolette(page, 600);

		await expect.poll(() => positionDeDefilement(page)).toBeGreaterThan(0);
		await expect.poll(() => header.boundingBox()).toEqual(avant);
		await expect(header).toBeInViewport();
	});

	for (const touche of ['Space', 'PageDown', 'ArrowDown']) {
		test(`la touche ${touche} fait descendre la page`, async ({ page }) => {
			await page.goto('/');
			await allongerLaPage(page);

			await page.keyboard.press(touche);

			await expect.poll(() => positionDeDefilement(page)).toBeGreaterThan(0);
			await attendreLeDefilementLisse(page);
		});
	}

	test('la touche PageUp fait remonter la page', async ({ page }) => {
		await page.goto('/');
		await allongerLaPage(page);
		await page.keyboard.press('PageDown');
		await attendreLeDefilementLisse(page);

		await page.keyboard.press('PageUp');

		await expect.poll(() => positionDeDefilement(page)).toBe(0);
		await expect.poll(() => translationVerticale(contenu(page))).toBeGreaterThan(-1);
	});

	test('la touche Fin amène le bas de la page dans la vue', async ({ page }) => {
		await page.goto('/');

		await page.keyboard.press('End');

		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY))
			.toBeLessThan(1);
		await expect(page.locator('#contact').getByRole('link')).toBeInViewport();
	});

	test('la touche Début ramène le haut de la page dans la vue', async ({ page }) => {
		await page.goto('/');
		await allongerLaPage(page);
		await page.keyboard.press('End');
		await attendreLeDefilementLisse(page);

		await page.keyboard.press('Home');

		await expect.poll(() => positionDeDefilement(page)).toBe(0);
		await expect.poll(() => translationVerticale(contenu(page))).toBeGreaterThan(-1);
		await expect(page.locator('h1')).toBeInViewport();
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
