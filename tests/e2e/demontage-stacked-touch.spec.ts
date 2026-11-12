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
const visio = (page: Page) => section(page).getByRole('button', { name: 'Plutôt en visio', exact: true });
const form = (page: Page) => section(page).getByRole('form');
const name = (page: Page) => form(page).getByRole('textbox', { name: 'Nom', exact: true });
const email = (page: Page) => form(page).getByRole('textbox', { name: 'E-mail', exact: true });
const when = (page: Page) => form(page).getByRole('radiogroup', { name: 'Quand ?' });
const message = (page: Page) => form(page).getByRole('textbox', { name: 'Message', exact: true });
/** The mini moka over the form, masked to assistive technologies: the big figure's name says what it shows. */
const mini = (page: Page) => section(page).locator('[data-cafe-mini]');

/** How high each piece flies with every block up, in % of the moka's frame height (`moka.json`). */
const ALL_UP = { boiler: 7.756, 'funnel-top': 20.583, filter: 27.593, gasket: 34.603, collector: 43.702, lid: 53.396 };
type Piece = keyof typeof ALL_UP;
const PIECES = Object.keys(ALL_UP) as Piece[];
/** The stove's height, in % of the frame: the ruler the lifts are measured with, whatever the camera's scale. */
const STOVE_HEIGHT = 27.4;

/** Brings the Café's actions above the statusline, past the pinned screen, and waits for the page to settle. */
async function reachActions(page: Page) {
	await page.goto('/');
	await scrollToScene(page, await sceneStart(page), 1);
	const below = await coffee(page).evaluate((el) => el.getBoundingClientRect().bottom - (innerHeight - 60));
	if (below > 0) {
		await page.evaluate((by) => scrollBy(0, by), below);
		await topOnceStill(content(page));
	}
	await expect(coffee(page)).toBeInViewport();
}

/** Waits until nothing moves in the section any more but the steam's loops. */
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
					quiet = moving.length === 0 ? quiet + 1 : 0;
					if (quiet >= 5) resolve();
					else requestAnimationFrame(check);
				};
				requestAnimationFrame(check);
			}),
	);

/** Where each of a moka's pieces stands above its stove's top, in stove heights: the camera's scale cancels out. */
const heights = (moka: Locator) =>
	moka.evaluate((el, pieces) => {
		const stove = el.querySelector('[data-layer="stove"]')!.getBoundingClientRect();
		return Object.fromEntries(
			pieces.map((piece) => {
				const box = el.querySelector(`[data-layer="${piece}"]`)!.getBoundingClientRect();
				return [piece, (stove.top - box.top) / stove.height];
			}),
		);
	}, PIECES as string[]) as Promise<Record<Piece, number>>;

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

async function fill(page: Page) {
	await name(page).fill('Ada Lovelace');
	await email(page).fill('ada@example.org');
	await when(page).getByRole('radio', { name: 'Semaine prochaine' }).check();
	await message(page).fill('Une carte des moulins du Doubs.');
}

test.describe('Démontage stacked, on a phone, reduced motion', () => {
	test.use({ ...finger, viewport: PORTRAIT, reducedMotion: 'reduce' });

	test('the mini moka and its screen only fade: nothing moves', async ({ page }) => {
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
		await expect(mini(page)).toBeVisible();
		await form(page).getByRole('button', { name: 'plutôt en visio', exact: true }).click();
		await expect.poll(() => seen(mini(page).locator('[data-stroke="top"]'))).toBe(1);
		await form(page).getByRole('button', { name: 'plutôt un café', exact: true }).click();
		const properties = await running;

		expect(properties.length).toBeGreaterThan(0);
		for (const property of properties) expect(['opacity', 'visibility', 'color', 'background-color']).toContain(property);
	});
});

test.describe('Démontage stacked, on a phone', () => {
	test.use({ ...finger, viewport: PORTRAIT, reducedMotion: 'no-preference' });

	test('the mini moka is only put in as the form opens, above it, apart, without Repères', async ({ page }) => {
		await reachActions(page);
		await expect(mini(page)).toHaveCount(0);

		await coffee(page).click();
		await settled(page);

		await expect(mini(page)).toBeVisible();
		await expect(mini(page)).toHaveAttribute('aria-hidden', 'true');
		const [over, under] = await Promise.all([mini(page).boundingBox(), form(page).boundingBox()]);
		expect(over!.y + over!.height).toBeLessThanOrEqual(under!.y + 1);
		// Still one image in the section, the big figure, which says how far the moka is put back.
		await expect(section(page).getByRole('img')).toHaveCount(1);
		for (const text of ['le couvercle', 'le collecteur', 'le filtre', 'la chaudière']) {
			for (const node of await section(page).getByText(text).all()) expect(await seen(node), text).toBe(0);
		}

		// Every block up, as in two columns: measured against the same moka once every field has put its block back.
		const apart = await heights(mini(page));
		await fill(page);
		await settled(page);
		const together = await heights(mini(page));
		for (const piece of PIECES) {
			expect((apart[piece] - together[piece]) * STOVE_HEIGHT, `${piece} up`).toBeCloseTo(ALL_UP[piece], 0);
		}
	});

	test('the mini moka downloads nothing more: its layers are the Montage’s, at the same URLs', async ({ page }) => {
		await reachActions(page);
		const requested: string[] = [];
		page.on('request', (request) => requested.push(request.url()));

		await coffee(page).click();
		await settled(page);
		await form(page).getByRole('button', { name: 'plutôt en visio', exact: true }).click();
		await settled(page);

		const [own, montage] = await Promise.all([
			mini(page).locator('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src)),
			montageFigure(page).locator('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src)),
		]);
		expect(own.length).toBeGreaterThan(0);
		for (const src of own) expect(montage).toContain(src);
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
		await expect(mini(page)).toBeVisible();
		await expect(counter).toHaveText('2/4 · à mi-hauteur');

		await page.setViewportSize(PORTRAIT);
		await settled(page);
		await expect(email(page)).toBeFocused();
		await expect(email(page)).toBeInViewport();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(counter).toHaveText('2/4 · à mi-hauteur');
		await expect(mini(page)).toBeVisible();

		// A tablet on its side: two columns, the Montage's figure beside the form, the mini moka gone with its layout.
		await page.setViewportSize({ width: 1024, height: 768 });
		await settled(page);
		await expect(email(page)).toBeFocused();
		await expect(email(page)).toBeInViewport();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(mini(page)).toBeHidden();
		await expect(montageFigure(page)).toBeInViewport();
		await expect(counter).toHaveText('2/4 · à mi-hauteur');
	});

	test('the page makes room for the mini moka and the form: the Contact comes after them, and back up on closing', async ({
		page,
	}) => {
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

	test('the mini moka comes apart from whole, the lid first and the boiler last', async ({ page }) => {
		await reachActions(page);

		// Each piece's height over the frames of the opening, from the first frame the mini moka is drawn.
		const watched = section(page).evaluate(
			(el, pieces) =>
				new Promise<Record<string, number[]>>((resolve) => {
					const samples: Record<string, number[]> = Object.fromEntries(pieces.map((piece) => [piece, []]));
					let start = 0;
					const sample = () => {
						const moka = el.querySelector('[data-cafe-mini]');
						const stove = moka?.querySelector('[data-layer="stove"]')?.getBoundingClientRect();
						if (moka && stove && stove.height > 0) {
							start ||= performance.now();
							for (const piece of pieces) {
								const box = moka.querySelector(`[data-layer="${piece}"]`)!.getBoundingClientRect();
								samples[piece].push((stove.top - box.top) / stove.height);
							}
						}
						if (start && performance.now() - start > 1600) resolve(samples);
						else requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}),
			PIECES as string[],
		);
		await coffee(page).click();
		const samples = await watched;

		// The first frame each piece has left its first height.
		const leaves = Object.fromEntries(
			PIECES.map((piece) => [piece, samples[piece].findIndex((height) => height - samples[piece][0] > 0.01)]),
		);
		for (const piece of PIECES) expect(leaves[piece], `${piece} moves`).toBeGreaterThan(0);
		expect(leaves.lid).toBeLessThan(leaves.boiler);
		expect(leaves.collector).toBeLessThan(leaves.filter);
	});

	test('in visio, the mini moka shrinks into a frame drawn stroke by stroke, on its stand, without the call', async ({
		page,
	}) => {
		await reachActions(page);
		const STROKES = ['top', 'right', 'bottom', 'left'];

		// When each stroke of the mini moka's frame is first fully drawn, in ms from the first frame it is drawn at all.
		const watched = section(page).evaluate(
			(el, strokes) =>
				new Promise<Record<string, number>>((resolve) => {
					const drawn: Record<string, number> = {};
					let start = 0;
					const sample = () => {
						const nodes = strokes.map((stroke) => el.querySelector(`[data-cafe-mini] [data-stroke="${stroke}"]`));
						// Laid out, whatever its scale.
						if (nodes.every((node) => node instanceof HTMLElement && node.offsetHeight > 0)) {
							start ||= performance.now();
							nodes.forEach((node, rank) => {
								const box = node!.getBoundingClientRect();
								const full = rank % 2 === 0 ? box.width > 0.99 * (node as HTMLElement).offsetWidth : box.height > 0.99 * (node as HTMLElement).offsetHeight;
								if (full && !(strokes[rank] in drawn)) drawn[strokes[rank]] = performance.now() - start;
							});
						}
						if (start && performance.now() - start > 2500) resolve(drawn);
						else requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}),
			STROKES,
		);
		await visio(page).click();
		const drawn = await watched;
		await settled(page);

		expect(Object.keys(drawn).sort()).toEqual([...STROKES].sort());
		expect(drawn.top).toBeGreaterThan(0);
		for (let i = 1; i < STROKES.length; i++) expect(drawn[STROKES[i]], STROKES[i]).toBeGreaterThan(drawn[STROKES[i - 1]]);

		const frame = await mini(page).locator('[data-stroke="top"]').boundingBox();
		const moka = await mini(page).locator('[data-layer="stove"]').boundingBox();
		// The moka stands inside the frame, its stove much narrower than the screen.
		expect(moka!.x).toBeGreaterThan(frame!.x);
		expect(moka!.x + moka!.width).toBeLessThan(frame!.x + frame!.width);
		expect(moka!.width / frame!.width).toBeLessThan(0.4);
		// The stand under the frame, and none of the call: no bar, no tiles, no buttons.
		const stand = mini(page).locator('[data-stroke="left"] + *');
		expect(await seen(stand)).toBe(1);
		expect((await stand.locator('*').last().boundingBox())!.y).toBeGreaterThan(frame!.y + 10);
		for (const text of ['café · en visio', '2 participants', 'Louis', 'vous']) {
			for (const node of await section(page).getByText(text, { exact: true }).all()) expect(await seen(node), text).toBe(0);
		}
		await expect(mini(page).locator('svg')).toHaveCount(0);
	});
});
