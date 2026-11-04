import { expect, test, type Page } from './fixtures';
import { statusline } from './helpers';

// The sentence as drawn for the eyes: hidden from assistive technologies, which read a stable one.
const buffer = (page: Page) => page.locator('.hero-lede [data-buffer]');
const version = (page: Page) => page.locator('.hero-lede [data-version]');

test.describe('the lede, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('shows the first version with its block cursor, and a stable sentence for screen readers', async ({
		page,
	}) => {
		await page.goto('/');

		await expect(buffer(page)).toHaveText('Je construis les cartes de votre réseau électrique.');
		await expect(buffer(page).locator('[data-kind="block"]')).toHaveText('e');
		await expect(version(page)).toHaveText(/version\s*1\/8\s*pour\s*: les grands comptes de l’énergie/);
		await expect(page.locator('.hero-lede')).toMatchAriaSnapshot(`
			- paragraph: "Je construis des cartes, des sites vitrines, des boutiques en ligne, des prises de rendez-vous, des API et des outils : pour votre réseau électrique, votre gîte, votre commerce, votre restaurant, votre salon, votre back-office, votre commune ou votre équipe terrain."
		`);
	});
});

test.describe('the lede, typed', () => {
	// Tall enough for the lede to be on screen: off screen, the typist waits.
	test.use({ viewport: { width: 1280, height: 900 } });

	test('rewrites itself into the next version in Vim, keys and modes shown', async ({ page }) => {
		await page.clock.install();
		await page.goto('/');

		const seen = { insert: false, keys: false };
		for (let i = 0; i < 300; i++) {
			await page.clock.runFor(100);
			const state = await page.evaluate(() => ({
				text: document.querySelector('.hero-lede [data-buffer]')?.textContent,
				mode: document.querySelector('#statusline [data-vim-mode]')?.textContent,
				keys: document.querySelectorAll('.hero-lede [data-keys] > *').length,
			}));
			seen.insert ||= state.mode === 'INSERT';
			seen.keys ||= state.keys > 0;
			if (state.text === 'Je construis le site de votre gîte.' && state.mode === 'NORMAL') break;
		}

		await expect(buffer(page)).toHaveText('Je construis le site de votre gîte.');
		expect(seen).toEqual({ insert: true, keys: true });
		await expect(statusline(page).locator('[data-vim-mode]')).toHaveText('NORMAL');
		await expect(version(page)).toHaveText(/version\s*2\/8\s*pour\s*: les gîtes et chambres d’hôtes/);
	});
});
