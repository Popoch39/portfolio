import { expect, test, type Page } from './fixtures';

interface LedeVersion {
	what: string;
	whose: string;
}

/** The Accroche's versions, as the page ships them to its typist. */
const ledeVersions = async (page: Page): Promise<LedeVersion[]> =>
	JSON.parse((await page.locator('[data-lede]').getAttribute('data-lede')) ?? '{}').versions;

/** "les cartes" → "cartes", "l’API" → "API": the offer's own word, without its article. */
const offerWord = (what: string) => what.replace(/^(les |le |la |l’)/, '');

test('every offer the Accroche names has visible text, with its audience and Besançon', async ({ page }) => {
	await page.goto('/');

	const versions = await ledeVersions(page);
	expect(versions.length).toBeGreaterThan(0);
	// `getByRole` leaves out what assistive technologies cannot reach: the typed, aria-hidden sentence.
	const offers = page.getByRole('region', { name: 'Prestations' }).getByRole('listitem');
	for (const { what, whose } of versions) {
		const offer = offers.filter({ hasText: offerWord(what) }).filter({ hasText: whose }).filter({ hasText: 'Besançon' });
		await expect(offer.first(), `${what} de votre ${whose}`).toBeVisible();
	}
});
