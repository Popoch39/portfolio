import { devices, expect, test, type Locator, type Page } from './fixtures';
import { content, statusline, topOnceStill } from './helpers';
import { montageFigure, sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

// Chromium project only: the name matches the Firefox `testIgnore` (playwright.config.ts), which
// does not emulate `isMobile`.
const { userAgent, deviceScaleFactor } = devices['Pixel 7'];
const finger = { userAgent, deviceScaleFactor, hasTouch: true, isMobile: true };
const PORTRAIT = { width: 412, height: 915 };
const LANDSCAPE = { width: 915, height: 412 };

const coffee = (page: Page) => section(page).getByRole('button', { name: 'Proposer un café', exact: true });
const form = (page: Page) => section(page).getByRole('form');
const name = (page: Page) => form(page).getByRole('textbox', { name: 'Nom', exact: true });
const email = (page: Page) => form(page).getByRole('textbox', { name: 'E-mail', exact: true });
const when = (page: Page) => form(page).getByRole('radiogroup', { name: 'Quand ?' });
const message = (page: Page) => form(page).getByRole('textbox', { name: 'Message', exact: true });

/** Brings the Café's actions above the statusline, past the pinned screen, and waits for the page to settle. */
async function reachActions(page: Page) {
	await page.goto('/');
	await actionsInView(page, await sceneStart(page));
}

/** The same, from wherever the page stands, for a scene that starts at `start`. */
async function actionsInView(page: Page, start: number) {
	await scrollToScene(page, start, 1);
	const below = await coffee(page).evaluate((el) => el.getBoundingClientRect().bottom - (innerHeight - 60));
	if (below > 0) {
		await page.evaluate((by) => scrollBy(0, by), below);
		await topOnceStill(content(page));
	}
	await expect(coffee(page)).toBeInViewport();
}

/**
 * Waits until the phase has played, the focus moved at its end, and nothing moves in the section any more but the
 * steam's loops. The phase outlasts the form's own transitions: they alone end before the focus moves.
 */
const settled = (page: Page) =>
	section(page).evaluate(
		(el) =>
			new Promise<void>((resolve) => {
				let quiet = 0;
				const check = () => {
					const moving = document.getAnimations().filter((animation) => {
						const target = (animation.effect as KeyframeEffect | null)?.target;
						return (
							target instanceof Element &&
							el.contains(target) &&
							animation.playState === 'running' &&
							(animation as CSSAnimation).animationName !== 'wisp'
						);
					});
					quiet = moving.length === 0 && !(el as HTMLElement).dataset.cafePhase ? quiet + 1 : 0;
					if (quiet >= 5) resolve();
					else requestAnimationFrame(check);
				};
				requestAnimationFrame(check);
			}),
	);

/** A node's opacity as seen: its own times that of every box around it in the section. */
const seen = (node: Locator) =>
	node.evaluate((el) => {
		let opacity = 1;
		for (let at: Element | null = el; at && !at.matches('[data-cafe]'); at = at.parentElement) {
			const style = getComputedStyle(at);
			if (style.display === 'none' || style.visibility === 'hidden') return 0;
			opacity *= Number(style.opacity);
		}
		return opacity;
	});

test.describe('Démontage stacked, on a phone, reduced motion', () => {
	test.use({ ...finger, viewport: PORTRAIT, reducedMotion: 'reduce' });

	test('the form only fades: nothing moves', async ({ page }) => {
		await page.goto('/');
		await coffee(page).scrollIntoViewIfNeeded();

		// Every property that runs in the section over the opening, the switch to visio and back.
		const running = section(page).evaluate(
			(el) =>
				new Promise<string[]>((resolve) => {
					const seen = new Set<string>();
					const start = performance.now();
					const sample = () => {
						for (const animation of document.getAnimations()) {
							const target = (animation.effect as KeyframeEffect | null)?.target;
							if (!(target instanceof Element) || !el.contains(target) || animation.playState !== 'running') continue;
							const properties =
								animation instanceof CSSTransition
									? [animation.transitionProperty]
									: (animation.effect as KeyframeEffect).getKeyframes().flatMap((frame) =>
											Object.keys(frame).filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)),
										);
							for (const property of properties) seen.add(property);
						}
						if (performance.now() - start > 2500) resolve([...seen]);
						else requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}),
		);
		await coffee(page).click();
		await expect(form(page)).toBeVisible();
		await form(page).getByRole('button', { name: 'plutôt en visio', exact: true }).click();
		await form(page).getByRole('button', { name: 'plutôt un café', exact: true }).click();
		const properties = await running;

		expect(properties.length).toBeGreaterThan(0);
		for (const property of properties) expect(['opacity', 'visibility', 'color', 'background-color']).toContain(property);
	});
});

test.describe('Démontage stacked, on a phone', () => {
	test.use({ ...finger, viewport: PORTRAIT, reducedMotion: 'no-preference' });

	test('the form opens alone, no moka over it, without Repères, and downloads nothing', async ({ page }) => {
		await reachActions(page);
		const requested: string[] = [];
		page.on('request', (request) => requested.push(request.url()));

		await coffee(page).click();
		await settled(page);

		await expect(form(page)).toBeVisible();
		// Still one image in the section, the big figure, out of sight above: nothing drawn with the form.
		await expect(section(page).getByRole('img')).toHaveCount(1);
		await expect(section(page).locator('.cafe-panel img')).toHaveCount(0);
		for (const text of ['le couvercle', 'le collecteur', 'le filtre', 'la chaudière']) {
			for (const node of await section(page).getByText(text).all()) expect(await seen(node), text).toBe(0);
		}
		await form(page).getByRole('button', { name: 'plutôt en visio', exact: true }).click();
		await settled(page);
		expect(requested).toEqual([]);
	});

	test('every control takes a finger and no field zooms the page', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		await settled(page);

		const controls = form(page).locator('input:not([tabindex="-1"]), textarea, button');
		expect(await controls.count()).toBeGreaterThan(8);
		for (const control of await controls.all()) {
			// A radio covers its whole chip.
			const box = (await control.boundingBox())!;
			const label = (await control.getAttribute('name')) ?? (await control.textContent());
			expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
			expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
		}
		for (const field of await form(page).getByRole('textbox').all()) {
			const size = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
			expect(size).toBeGreaterThanOrEqual(16);
		}
	});

	test('the field in hand stays above the keyboard as it comes up', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		await settled(page);
		await message(page).focus();

		// A keyboard taking the lower half of the screen: the visible area shrinks from the bottom.
		await page.setViewportSize({ width: PORTRAIT.width, height: 460 });

		await expect
			.poll(() =>
				message(page).evaluate((el) => {
					const box = el.getBoundingClientRect();
					const bar = document.querySelector('#statusline')!.getBoundingClientRect();
					const bottom = Math.min(visualViewport!.height, bar.top);
					return box.top >= 0 && box.bottom <= bottom + 1;
				}),
			)
			.toBe(true);
		await expect(message(page)).toBeFocused();
	});

	test('turning the phone with the form open keeps it open, what was typed and the field in hand', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		await settled(page);
		await name(page).fill('Ada Lovelace');
		await email(page).fill('ada@example.org');
		const counter = section(page).getByText(/^\d\/[46] · /);

		await page.setViewportSize(LANDSCAPE);
		await settled(page);
		await expect(email(page)).toBeFocused();
		await expect(email(page)).toBeInViewport();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(email(page)).toHaveValue('ada@example.org');
		await expect(counter).toHaveText('2/4 · à mi-hauteur');

		await page.setViewportSize(PORTRAIT);
		await settled(page);
		await expect(email(page)).toBeFocused();
		await expect(email(page)).toBeInViewport();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(counter).toHaveText('2/4 · à mi-hauteur');

		// A tablet on its side: two columns, the Montage's figure beside the form.
		await page.setViewportSize({ width: 1024, height: 768 });
		await settled(page);
		await expect(email(page)).toBeFocused();
		await expect(email(page)).toBeInViewport();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(montageFigure(page)).toBeInViewport();
		await expect(counter).toHaveText('2/4 · à mi-hauteur');
	});

	test('opened, then the phone turned, scrolling straight back under the actions closes the form and keeps what was typed', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await sceneStart(page);
		await actionsInView(page, start);
		await coffee(page).click();
		await settled(page);
		await name(page).fill('Ada Lovelace');
		// Each one a refresh of the pinning: the form's own height, then the layout turned twice.
		await page.setViewportSize(LANDSCAPE);
		await settled(page);
		await page.setViewportSize(PORTRAIT);
		await settled(page);
		await expect(form(page)).toBeVisible();

		await scrollToScene(page, start, 0.6);

		await expect(form(page)).toBeHidden();
		await expect(statusline(page).locator('.mode:visible').first()).toHaveText('NORMAL');
		await actionsInView(page, start);
		await coffee(page).click();
		await expect(name(page)).toHaveValue('Ada Lovelace');
	});

	test('the page makes room for the form: the Contact comes after it, and back up on closing', async ({ page }) => {
		await reachActions(page);
		const contact = page.locator('#contact');
		/** From the bottom of the Café's last control on show to the top of the Contact. */
		const gap = (last: Locator) => async () => {
			const [cafe, next] = await Promise.all([last.boundingBox(), contact.boundingBox()]);
			return next!.y - (cafe!.y + cafe!.height);
		};
		const restGap = await gap(coffee(page))();
		// The Contact starts where the Café ends, to a fraction of a pixel.
		expect(restGap).toBeGreaterThanOrEqual(-1);

		await coffee(page).click();
		await settled(page);
		const formGap = gap(form(page));
		await expect.poll(formGap).toBeGreaterThanOrEqual(-1);
		await expect.poll(formGap).toBeLessThan(restGap + 200);

		await page.keyboard.press('Escape');
		await expect.poll(gap(coffee(page))).toBeCloseTo(restGap, 0);
	});
});
