// The Intro plays on a direct visit only: the Worker test visits the home page without a referrer.
import { test as directVisit } from '@playwright/test';
import { expect, test, type Response } from './fixtures';

// Error message from the GSAP core: it survives minification and exists only once in the library.
const GSAP_FINGERPRINT = 'GSAP target ';

test('the chunk that holds GSAP is requested only once per page', async ({ page }) => {
	const scripts: Response[] = [];
	page.on('response', (response) => {
		if (response.request().resourceType() === 'script') scripts.push(response);
	});

	await page.goto('/', { waitUntil: 'networkidle' });

	const withGsap: string[] = [];
	for (const response of scripts) {
		if ((await response.text()).includes(GSAP_FINGERPRINT)) withGsap.push(response.url());
	}
	expect(withGsap).toHaveLength(1);
});

directVisit.describe('The Intro', () => {
	directVisit.use({ reducedMotion: 'no-preference' });

	directVisit('draws its globe in a Worker that does not hold GSAP', async ({ page, request }) => {
		const started = page.waitForEvent('worker');
		await page.goto('/');

		const worker = await started;
		const script = await (await request.get(worker.url())).text();
		expect(script).not.toContain(GSAP_FINGERPRINT);
		expect(script.length).toBeGreaterThan(0);
	});
});
