import { expect, test, type Page, type Route } from './fixtures';
import { content, statusline, topOnceStill } from './helpers';
import { cafeCounter as counter, sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

const coffee = (page: Page) => section(page).getByRole('button', { name: 'Proposer un café', exact: true });
const visio = (page: Page) => section(page).getByRole('button', { name: 'Plutôt en visio', exact: true });
const paragraph = (page: Page) => section(page).getByText(/^À Besançon, ou en visio/);
const form = (page: Page) => section(page).getByRole('form');
const name = (page: Page) => form(page).getByRole('textbox', { name: 'Nom', exact: true });
const email = (page: Page) => form(page).getByRole('textbox', { name: 'E-mail', exact: true });
const when = (page: Page) => form(page).getByRole('radiogroup', { name: 'Quand ?' });
const message = (page: Page) => form(page).getByRole('textbox', { name: 'Message', exact: true });
const send = (page: Page) => form(page).getByRole('button', { name: /^(Envoyer|envoi…)$/ });
const hint = (page: Page) => form(page).locator('[aria-live="polite"]');
const mode = (page: Page) => statusline(page).locator('.mode:visible').first();

declare global {
	interface Window {
		testCspViolations?: string[];
		/** The first form's panel and « Proposer un café » button, held weakly. */
		testFormLeft?: WeakRef<Element>[];
	}
}

const CAFE_TITLE ='Un café, à Besançon.';
const VISIO_TITLE = 'Une visio, où que vous soyez.';

/** Brings the Café's end on screen, where the actions have risen in, and waits for the page to settle. */
async function reachActions(page: Page) {
	await page.goto('/');
	await scrollToScene(page, await sceneStart(page), 1);
	// Stacked, the actions follow the pinned screen: the page goes on until they stand above the statusline.
	const below = await coffee(page).evaluate((el) => el.getBoundingClientRect().bottom - (innerHeight - 60));
	if (below > 0) {
		await page.evaluate((by) => scrollBy(0, by), below);
		await topOnceStill(content(page));
	}
	await expect(coffee(page)).toBeInViewport();
}

async function fill(page: Page) {
	await name(page).fill('Ada Lovelace');
	await email(page).fill('ada@example.org');
	await when(page).getByRole('radio', { name: 'Semaine prochaine' }).check();
	await message(page).fill('Une carte des moulins du Doubs.');
}

/** Holds `/api/contact` until `release` answers it with `status`; records the bodies it receives. */
async function holdContact(page: Page) {
	const bodies: unknown[] = [];
	let pending: Route | undefined;
	let arrived = () => {};
	const reached = new Promise<void>((resolve) => (arrived = resolve));
	await page.route('**/api/contact', (route) => {
		bodies.push(route.request().postDataJSON());
		pending = route;
		arrived();
	});
	return {
		bodies,
		reached,
		release: (status: number) => pending?.fulfill({ status, json: { ok: status === 200 } }),
	};
}

test.describe('Formulaire du Café', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

	test('« Proposer un café » opens the form in café mode, in place of the paragraph and the actions', async ({ page }) => {
		await reachActions(page);

		await coffee(page).click();

		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);
		await expect(section(page).getByRole('heading', { name: CAFE_TITLE, level: 3 })).toBeVisible();
		await expect(name(page)).toBeFocused();
		await expect(mode(page)).toHaveText('INSERT');
		await expect(paragraph(page)).toBeHidden();
		await expect(coffee(page)).toBeHidden();
		await expect(form(page).getByRole('button', { name: 'plutôt en visio', exact: true })).toBeVisible();
		await expect(form(page).getByText('sans engagement', { exact: true })).toBeVisible();
		// The counter is the Démontage's while the form is open.
		await expect(section(page).getByText(/^\d\/4 · /)).toHaveText('0/4 · en pièces');
	});

	test('« Plutôt en visio » opens the form in visio mode', async ({ page }) => {
		await reachActions(page);

		await visio(page).click();

		await expect(form(page)).toHaveAccessibleName(VISIO_TITLE);
		await expect(name(page)).toBeFocused();
		await expect(form(page).getByRole('button', { name: 'plutôt un café', exact: true })).toBeVisible();
	});

	test('the fields are numbered 1 to 4: Nom, E-mail, Quand ? with its three choices, Message, optional', async ({
		page,
	}) => {
		await reachActions(page);
		await coffee(page).click();

		await expect(name(page)).toHaveAttribute('autocomplete', 'name');
		await expect(email(page)).toHaveAttribute('type', 'email');
		await expect(email(page)).toHaveAttribute('autocomplete', 'email');
		await expect(when(page).getByRole('radio')).toHaveCount(3);
		for (const choice of ['Cette semaine', 'Semaine prochaine', 'Plus tard']) {
			await expect(when(page).getByRole('radio', { name: choice, exact: true })).toBeVisible();
		}
		await expect(message(page)).toHaveAttribute('placeholder', 'facultatif');
		const badges = await form(page).locator('label, [role="radiogroup"]').evaluateAll((rows) =>
			rows.map((row) => row.querySelector('[aria-hidden="true"]')?.textContent).filter(Boolean),
		);
		expect(badges).toEqual(['1', '2', '3', '4']);
		// The trap field, which robots fill in, is out of reach for people and assistive technologies.
		await expect(form(page).locator('input[name="site"]')).not.toBeInViewport();
		await expect(form(page).locator('input[name="site"]')).toHaveAttribute('tabindex', '-1');
		await expect(form(page).getByRole('textbox')).toHaveCount(3);
	});

	test('a field’s badge turns to the accent once the field is valid', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		const accent = await page.evaluate(() => {
			const probe = document.createElement('i');
			probe.style.color = 'var(--color-accent)';
			document.body.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		});
		const badge = form(page).locator('label[for]', { hasText: 'E-mail' }).locator('[aria-hidden="true"]');

		await email(page).fill('ada');
		await expect(badge).not.toHaveCSS('background-color', accent);
		await email(page).fill('ada@example.org');
		await expect(badge).toHaveCSS('background-color', accent);
	});

	test('an incomplete send names only what is missing, politely, and takes focus to the first of it', async ({
		page,
	}) => {
		const contact = await holdContact(page);
		await reachActions(page);
		await coffee(page).click();
		await expect(name(page)).toBeFocused();

		await send(page).click();
		await expect(hint(page)).toHaveText('encore en l’air : votre nom, votre e-mail, quand');
		await expect(name(page)).toBeFocused();

		await name(page).fill('Ada');
		await when(page).getByRole('radio', { name: 'Plus tard' }).check();
		await send(page).click();
		await expect(hint(page)).toHaveText('encore en l’air : votre e-mail');
		await expect(email(page)).toBeFocused();

		await email(page).fill('ada');
		await send(page).click();
		await expect(hint(page)).toHaveText('encore en l’air : votre e-mail');
		expect(contact.bodies).toHaveLength(0);
	});

	test('switching between café and visio keeps what was typed', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		await fill(page);

		await form(page).getByRole('button', { name: 'plutôt en visio', exact: true }).click();
		await expect(form(page)).toHaveAccessibleName(VISIO_TITLE);
		await form(page).getByRole('button', { name: 'plutôt un café', exact: true }).click();
		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);

		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(email(page)).toHaveValue('ada@example.org');
		await expect(when(page).getByRole('radio', { name: 'Semaine prochaine' })).toBeChecked();
		await expect(message(page)).toHaveValue('Une carte des moulins du Doubs.');
	});

	test('Escape closes the form: the paragraph and the actions come back, focus on « Proposer un café »', async ({
		page,
	}) => {
		await reachActions(page);
		await coffee(page).click();
		await expect(name(page)).toBeFocused();

		await page.keyboard.press('Escape');

		await expect(coffee(page)).toBeFocused();
		await expect(form(page)).toBeHidden();
		await expect(paragraph(page)).toBeVisible();
		await expect(mode(page)).toHaveText('NORMAL');
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
	});

	test('« esc · fermer » closes the form the same way', async ({ page }) => {
		await reachActions(page);
		await visio(page).click();

		await form(page).getByRole('button', { name: 'esc · fermer', exact: true }).click();

		await expect(coffee(page)).toBeFocused();
		await expect(form(page)).toBeHidden();
		await expect(visio(page)).toBeVisible();
		await expect(mode(page)).toHaveText('NORMAL');
	});

	test('a send shows « envoi… », posts the proposal, then confirms and offers to start again', async ({ page }) => {
		const contact = await holdContact(page);
		await reachActions(page);
		await coffee(page).click();
		await fill(page);

		await send(page).click();
		await contact.reached;
		await expect(send(page)).toHaveAccessibleName('envoi…');
		await expect(send(page)).toBeDisabled();
		expect(contact.bodies).toEqual([
			{
				mode: 'cafe',
				nom: 'Ada Lovelace',
				email: 'ada@example.org',
				quand: 'La semaine prochaine',
				message: 'Une carte des moulins du Doubs.',
				site: '',
			},
		]);

		await contact.release(200);
		await expect(section(page).getByText('Envoyé. À très vite autour d’un café.', { exact: true })).toBeVisible();
		const again = section(page).getByRole('button', { name: 'recommencer', exact: true });
		await expect(again).toBeFocused();
		await expect(form(page)).toBeHidden();
		await expect(mode(page)).toHaveText('NORMAL');

		await again.click();
		await expect(coffee(page)).toBeFocused();
		await expect(paragraph(page)).toBeVisible();

		// A proposal sent is not proposed again: the next opening starts afresh.
		await coffee(page).click();
		await expect(name(page)).toBeFocused();
		await expect(name(page)).toHaveValue('');
		await expect(email(page)).toHaveValue('');
		await expect(when(page).getByRole('radio', { name: 'Semaine prochaine' })).not.toBeChecked();
		await expect(message(page)).toHaveValue('');
		await expect(section(page).getByText(/^\d\/4 · /)).toHaveText('0/4 · en pièces');
	});

	test('a proposal sent then closed with Escape is not found again at the next opening', async ({ page }) => {
		const contact = await holdContact(page);
		await reachActions(page);
		await coffee(page).click();
		await fill(page);
		await send(page).click();
		await contact.reached;
		await contact.release(200);
		await expect(section(page).getByRole('button', { name: 'recommencer', exact: true })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(coffee(page)).toBeFocused();
		await visio(page).click();

		await expect(name(page)).toBeFocused();
		await expect(name(page)).toHaveValue('');
		await expect(message(page)).toHaveValue('');
	});

	test('a send in visio mode is confirmed for a visio', async ({ page }) => {
		const contact = await holdContact(page);
		await reachActions(page);
		await visio(page).click();
		await fill(page);

		await send(page).click();
		await contact.reached;
		expect(contact.bodies).toEqual([expect.objectContaining({ mode: 'visio' })]);
		await contact.release(200);

		await expect(section(page).getByText('Envoyé. À très vite en visio.', { exact: true })).toBeVisible();
	});

	test('a failed send keeps everything typed and gives the address to write to', async ({ page }) => {
		const contact = await holdContact(page);
		await reachActions(page);
		await coffee(page).click();
		await fill(page);

		await send(page).click();
		await contact.reached;
		await contact.release(500);

		await expect(hint(page)).toHaveText('pas parti : réessayez, ou écrivez à pocheron.louis@gmail.com');
		await expect(send(page)).toHaveAccessibleName('Envoyer');
		await expect(send(page)).toBeEnabled();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(message(page)).toHaveValue('Une carte des moulins du Doubs.');
		await expect(mode(page)).toHaveText('INSERT');
	});

	test('the Content Security Policy lets the send through', async ({ page }) => {
		await page.addInitScript(() => {
			window.testCspViolations = [];
			document.addEventListener('securitypolicyviolation', (event) =>
				window.testCspViolations?.push(`${event.effectiveDirective} ${event.blockedURI}`),
			);
		});
		const contact = await holdContact(page);
		await reachActions(page);
		await coffee(page).click();
		await fill(page);

		await send(page).click();
		await contact.reached;
		await contact.release(200);

		await expect(section(page).getByRole('button', { name: 'recommencer', exact: true })).toBeVisible();
		const policy = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
		expect(policy).toContain("connect-src 'self'");
		expect(await page.evaluate(() => window.testCspViolations)).toEqual([]);
	});

	test('a send the network drops fails the same way', async ({ page }) => {
		await page.route('**/api/contact', (route) => route.abort('failed'));
		await reachActions(page);
		await coffee(page).click();
		await fill(page);

		await send(page).click();

		await expect(hint(page)).toHaveText('pas parti : réessayez, ou écrivez à pocheron.louis@gmail.com');
		await expect(email(page)).toHaveValue('ada@example.org');
	});

	test('nothing of a closed form survives a change of motion preference', async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium', 'garbage collection is only asked for through the Chrome DevTools Protocol');
		await reachActions(page);
		await coffee(page).click();
		await name(page).fill('Ada');
		await page.keyboard.press('Escape');
		await expect(coffee(page)).toBeFocused();
		// Held weakly: only the page's own references keep them.
		await page.evaluate(() => {
			const panel = document.querySelector('[data-cafe] form')?.parentElement;
			const button = document.querySelector('[data-cafe] button[data-cafe-open]');
			if (!panel || !button) throw new Error('no form nor action to watch');
			window.testFormLeft = [new WeakRef(panel), new WeakRef(button)];
		});

		// The form's detail is undone, then set up again with a panel and buttons of its own.
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(coffee(page)).toBeVisible();
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('HeapProfiler.collectGarbage');

		expect(await page.evaluate(() => window.testFormLeft?.map((ref) => ref.deref() !== undefined))).toEqual([false, false]);
	});
});

test.describe('Formulaire du Café, reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

	test('the form opens, sends and closes all the same', async ({ page }) => {
		const contact = await holdContact(page);
		await page.goto('/');
		await coffee(page).scrollIntoViewIfNeeded();

		await coffee(page).click();
		await expect(name(page)).toBeFocused();
		await fill(page);
		await send(page).click();
		await contact.reached;
		await contact.release(200);

		await expect(section(page).getByRole('button', { name: 'recommencer', exact: true })).toBeFocused();
	});
});

test.describe('Formulaire du Café, stacked on a phone', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 412, height: 915 } });

	test('the form opens under the moka, and Escape brings the actions back', async ({ page }) => {
		await reachActions(page);

		await coffee(page).click();
		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);
		await expect(name(page)).toBeFocused();
		await expect(name(page)).toBeInViewport();

		await page.keyboard.press('Escape');
		await expect(coffee(page)).toBeFocused();
	});
});
