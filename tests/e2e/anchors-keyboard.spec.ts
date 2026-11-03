import { expect, test, type Page } from './fixtures';
import {
	content,
	expectAtTopOfWindow,
	expectSmoothScrolling,
	expectVisibleAboveStatusline,
	header,
	lengthenPage,
	scrollPosition,
	scrolledToBottom,
	scrollWithWheel,
	statusline,
	statuslineTop,
	topInPage,
	topOnceStill,
	verticalTranslation,
} from './helpers';

/**
 * Serves the home page with room under the Contact section, so the anchor can bring it to the top
 * of the window (otherwise the end of the page holds it lower), and with the section id replaced
 * if needed. Applies from the first load, landing anchor included.
 */
async function serveHomePage(page: Page, { id = 'contact' } = {}) {
	await page.route('/', async (route) => {
		const response = await route.fetch();
		const html = (await response.text())
			.replace(
				'</head>',
				'<style>[data-testid=contact]::after{content:"";display:block;height:300vh}</style></head>',
			)
			.replace('id="contact"', `id="${id}" data-testid="contact"`)
			.replace('href="/#contact"', `href="/#${id}"`);
		await route.fulfill({ response, body: html });
	});
}

const contactSection = (page: Page) => page.getByTestId('contact');
const contactLink = (page: Page) => header(page).getByRole('link', { name: 'Contact' });
const emailLink = (page: Page) => page.locator('#contact').getByRole('link', { name: /@/ });

// Under smoothed scrolling, the smoother must bring anchors; with reduced motion, the browser does
// it on its own. Either way, the header scrolls with the page: the target stops at the top of the window.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	test.describe(`anchors, motion ${reducedMotion}`, () => {
		test.use({ reducedMotion });

		test('the header anchor link brings the target section to the top of the window', async ({ page }) => {
			await serveHomePage(page);
			await page.goto('/');
			await expect(contactSection(page)).not.toBeInViewport();

			await contactLink(page).click();

			await expectAtTopOfWindow(contactSection(page));
			// The document is what scrolled: the wheel and the keyboard start again from the section.
			expect(await scrollPosition(page)).toBeGreaterThan(0);
			await expect(page).toHaveURL(/#contact$/);
		});

		test('the anchor link brings the section back even when the URL already carries it', async ({ page }) => {
			await serveHomePage(page);
			await page.goto('/');
			await contactLink(page).click();
			await expectAtTopOfWindow(contactSection(page));
			await page.keyboard.press('Home');
			// The header scrolls with the content: clicking it while the smoothing still eases would aim
			// at a moving link. Wait until the content rests at the top, transform included.
			await expect.poll(() => scrollPosition(page)).toBe(0);
			await expect.poll(() => verticalTranslation(content(page))).toBe(0);

			await contactLink(page).click();

			await expectAtTopOfWindow(contactSection(page));
		});

		test('the home page loaded with the anchor in the URL opens on the target section', async ({ page }) => {
			await serveHomePage(page);
			await page.goto('/#contact');

			await expectAtTopOfWindow(contactSection(page));
			expect(await scrollPosition(page)).toBeGreaterThan(0);
		});

		test('changing the URL anchor without a link brings the target section to the top', async ({ page }) => {
			await serveHomePage(page);
			await page.goto('/');

			await page.evaluate(() => {
				location.hash = 'contact';
			});

			await expectAtTopOfWindow(contactSection(page));
		});

		test('a non-ASCII anchor id works at load as on click', async ({ page }) => {
			await serveHomePage(page, { id: 'contact-été' });
			await page.goto('/#contact-été');
			await expectAtTopOfWindow(contactSection(page));

			await page.goto('/');
			await contactLink(page).click();

			await expectAtTopOfWindow(contactSection(page));
		});
	});

	test.describe(`focus, motion ${reducedMotion}`, () => {
		test.use({ reducedMotion });

		test('tabbing to a link further down brings it into view, above the statusline', async ({ page }) => {
			await page.goto('/');
			const link = emailLink(page);
			await expect(link).not.toBeInViewport();

			for (let i = 0; i < 40 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
				await page.keyboard.press('Tab');
			}

			await expect(link).toBeFocused();
			await expectVisibleAboveStatusline(page, link);
		});

		test('a link focused while hidden under the statusline comes out from under it', async ({ page }) => {
			await page.goto('/');
			await lengthenPage(page);
			const link = emailLink(page);
			// The top of the link 10px above the bottom of the window: inside the statusline band.
			const top = await topInPage(link);
			await page.evaluate((y) => scrollTo(0, y - innerHeight + 10), top);
			const barTop = await statuslineTop(page);
			await expect.poll(() => topOnceStill(link)).toBeGreaterThan(barTop);

			await link.focus();

			await expectVisibleAboveStatusline(page, link);
		});
	});
}

test.describe('statusline and keyboard under smoothed scrolling', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the statusline keeps its place on screen after a wheel scroll', async ({ page }) => {
		await page.goto('/');
		const bar = statusline(page);
		await expect(bar).toBeInViewport();
		const before = await bar.boundingBox();

		await scrollWithWheel(page, 600);

		await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
		await expect.poll(() => bar.boundingBox()).toEqual(before);
		await expect(bar).toBeInViewport();
	});

	for (const key of ['Space', 'PageDown', 'ArrowDown']) {
		test(`the ${key} key moves the page down`, async ({ page }) => {
			await page.goto('/');

			await page.keyboard.press(key);

			await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
			await expectSmoothScrolling(page);
		});
	}

	test('the PageUp key moves the page back up', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('PageDown');
		await expectSmoothScrolling(page);

		await page.keyboard.press('PageUp');

		await expect.poll(() => scrollPosition(page)).toBe(0);
		await expect.poll(() => verticalTranslation(content(page))).toBeGreaterThan(-1);
	});

	test('the End key brings the bottom of the page into view', async ({ page }) => {
		await page.goto('/');

		await page.keyboard.press('End');

		await scrolledToBottom(page);
		await expect(page.locator('#contact').getByRole('link').last()).toBeInViewport();
	});

	test('the Home key brings the top of the page back into view', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('End');
		await expectSmoothScrolling(page);

		await page.keyboard.press('Home');

		await expect.poll(() => scrollPosition(page)).toBe(0);
		await expect.poll(() => verticalTranslation(content(page))).toBeGreaterThan(-1);
		await expect(page.locator('h1')).toBeInViewport();
	});

	test('no element of the wrapped content is `position: sticky`', async ({ page }) => {
		await page.goto('/');

		// The smoother transforms the content: a sticky element comes loose there, pinning goes through `pin`.
		const stickies = await content(page).evaluate((el) =>
			[el, ...el.querySelectorAll('*')]
				.filter((e) => getComputedStyle(e).position === 'sticky')
				.map((e) => e.outerHTML.slice(0, 80)),
		);
		expect(stickies).toEqual([]);
	});
});
