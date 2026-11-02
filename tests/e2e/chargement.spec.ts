import { expect, test, type Response } from '@playwright/test';

// Message d'erreur du cœur de GSAP : il survit à la minification et n'existe qu'une fois dans la lib.
const EMPREINTE_GSAP = 'GSAP target ';

test('le chunk qui contient GSAP n’est demandé qu’une fois par page', async ({ page }) => {
	const scripts: Response[] = [];
	page.on('response', (reponse) => {
		if (reponse.request().resourceType() === 'script') scripts.push(reponse);
	});

	await page.goto('/', { waitUntil: 'networkidle' });

	const avecGsap: string[] = [];
	for (const reponse of scripts) {
		if ((await reponse.text()).includes(EMPREINTE_GSAP)) avecGsap.push(reponse.url());
	}
	expect(avecGsap).toHaveLength(1);
});
