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
