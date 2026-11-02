import { expect, test, type Page } from '@playwright/test';

const section = (page: Page) => page.getByRole('region', { name: 'Parcours', exact: true });
const band = (page: Page) => page.getByRole('region', { name: 'Frise du parcours' });

/** Every commit of the career, oldest first: studies, jobs, then the current missions up to HEAD. */
const COMMITS_IN_ORDER = [
	/Baccalauréat/,
	/Langues étrangères appliquées/,
	/Développeur web/,
	/Jordel Média/,
	/CDOS/,
	/Concepteur & développeur d’applications/,
	/Da Viking Code/,
	/Cartographie énergie/,
	/Back-office santé/,
	/Terrain hors-ligne/,
	/Micro-services Rust/,
	/Monorepos & CI\/CD/,
	/HEAD.*aujourd’hui|aujourd’hui.*HEAD/,
];

// Without JavaScript and under reduced motion alike, the Frise stays at its final state.
const FINAL_STATE_CONTEXTS = [
	{ name: 'without JavaScript', use: { javaScriptEnabled: false } },
	{ name: 'reduced motion', use: { reducedMotion: 'reduce' as const } },
];

for (const { name, use } of FINAL_STATE_CONTEXTS) {
	test.describe(`Frise, final state, ${name}`, () => {
		test.use(use);

		test('every commit is listed, in chronological order', async ({ page }) => {
			await page.goto('/');

			await expect(band(page).getByRole('listitem')).toHaveText(COMMITS_IN_ORDER);
			for (const commit of await band(page).getByRole('listitem').all()) {
				await expect(commit).toBeVisible();
				await expect(commit).toHaveCSS('opacity', '1');
			}
		});

		test('the section keeps its single heading, with the branches as its aside and the years of experience', async ({
			page,
		}) => {
			await page.goto('/');

			await expect(section(page).getByRole('heading')).toHaveCount(1);
			await expect(section(page).getByRole('heading', { level: 2, name: 'Parcours' })).toBeVisible();
			await expect(section(page).getByText('main ← lea, access-code, cda', { exact: true })).toBeVisible();
			await expect(section(page).getByText(/~\d+ ans d’expérience/)).toBeVisible();
		});

		test('focused, the strip scrolls horizontally with the keyboard', async ({ page }) => {
			await page.goto('/');
			const strip = band(page);
			await strip.scrollIntoViewIfNeeded();
			const scrollLeft = () => strip.evaluate((el) => el.scrollLeft);
			expect(await scrollLeft()).toBe(0);

			await strip.focus();
			await expect(strip).toBeFocused();
			for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');

			await expect.poll(scrollLeft).toBeGreaterThan(0);
		});

		test('the section scrolls with the page, without pinning nor an active commit legend', async ({ page }) => {
			await page.goto('/');
			await section(page).scrollIntoViewIfNeeded();
			const top = () => section(page).evaluate((el) => el.getBoundingClientRect().top);
			const before = await top();

			await page.evaluate(() => scrollBy(0, 300));

			await expect.poll(top).toBeCloseTo(before - 300, 0);
			await expect(page.locator('[data-frise-legend]')).toBeHidden();
		});

		test('assistive technologies get the list of commits, not the drawing', async ({ page }) => {
			await page.goto('/');

			// The strip holds the list and nothing else: the graph and the grid stay out of the tree.
			await expect(band(page)).toMatchAriaSnapshot(`
				- region "Frise du parcours":
				  - /children: equal
				  - list
			`);
			const first = band(page).getByRole('listitem').first();
			await expect(first.getByRole('time')).toHaveText('2018');
			await expect(first).toContainText('Baccalauréat économique et social');
			await expect(first).toContainText('Lycée Carnot, Dijon');
			await expect(first).toContainText('main');
		});
	});
}

test.describe('Frise data elsewhere on the page', () => {
	test.use({ javaScriptEnabled: false });

	test('the hero and the JSON-LD still name the current job and every school', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('definition').filter({ hasText: 'Da Viking Code, Dijon — depuis 2023' })).toBeVisible();
		const person = await page
			.locator('script[type="application/ld+json"]')
			.evaluate((script) => JSON.parse(script.textContent ?? '').mainEntity);
		expect(person.alumniOf.map((school: { name: string }) => school.name)).toEqual([
			'Access Code School',
			'UFR SLHS',
			'Lycée Carnot',
		]);
	});
});
