import { expect, test, type Locator, type Page } from './fixtures';
import { content, topOnceStill } from './helpers';
import { montageFigure as figure, sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

const coffee = (page: Page) => section(page).getByRole('button', { name: 'Proposer un café', exact: true });
const form = (page: Page) => section(page).getByRole('form');
const name = (page: Page) => form(page).getByRole('textbox', { name: 'Nom', exact: true });
const email = (page: Page) => form(page).getByRole('textbox', { name: 'E-mail', exact: true });
const when = (page: Page) => form(page).getByRole('radiogroup', { name: 'Quand ?' });
const message = (page: Page) => form(page).getByRole('textbox', { name: 'Message', exact: true });
/** The counter under the title: the Montage's « n/6 » at rest, the Démontage's « n/4 » while the form is open. */
const counter = (page: Page) => section(page).getByText(/^\d\/[46] · /);

const REST_LABEL =
	'Un Moka Express en pièces au-dessus d’un réchaud, que le défilement remonte pièce par pièce avant d’allumer le feu.';

/** The six pieces, bottom to top, each by its main layer. */
const PIECES = ['boiler', 'funnel-top', 'filter', 'gasket', 'collector', 'lid'] as const;
type Piece = (typeof PIECES)[number];

/**
 * How high each piece flies with every block up, in % of the moka's frame height: the generator's lifts
 * (`moka.json`), where each piece clears the one under it.
 */
const ALL_UP: Record<Piece, number> = {
	boiler: 7.756,
	'funnel-top': 20.583,
	filter: 27.593,
	gasket: 34.603,
	collector: 43.702,
	lid: 53.396,
};
/** The stove's height, in % of the frame: the ruler the lifts are measured with, whatever the camera's scale. */
const STOVE_HEIGHT = 27.4;

/** Brings the Café's end on screen, where the actions have risen in (two columns), and waits for it to settle. */
async function reachActions(page: Page) {
	await page.goto('/');
	await scrollToScene(page, await sceneStart(page), 1);
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

/** Where each piece's top stands above the stove's top, in stove heights: the camera's scale cancels out. */
const heights = (page: Page) =>
	figure(page).evaluate((el, pieces) => {
		const stove = el.querySelector('[data-layer="stove"]')!.getBoundingClientRect();
		return Object.fromEntries(
			pieces.map((piece) => {
				const box = el.querySelector(`[data-layer="${piece}"]`)!.getBoundingClientRect();
				return [piece, (stove.top - box.top) / stove.height];
			}),
		);
	}, PIECES as unknown as string[]) as Promise<Record<Piece, number>>;

/** How high each piece is lifted from its seat, in % of the frame, against the heights at rest. */
async function lifts(page: Page, rest: Record<Piece, number>) {
	const now = await heights(page);
	return Object.fromEntries(PIECES.map((piece) => [piece, (now[piece] - rest[piece]) * STOVE_HEIGHT])) as Record<
		Piece,
		number
	>;
}

/** A layer's opacity as seen: its own times that of every box around it in the figure. */
const opacityOnScreen = (layer: Locator) =>
	layer.evaluate((el) => {
		let opacity = 1;
		for (let node: Element | null = el; node && !node.matches('[data-montage]'); node = node.parentElement) {
			opacity *= Number(getComputedStyle(node).opacity);
		}
		return opacity;
	});

test.describe('Démontage, café mode in two columns', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

	test('opening lifts the four blocks off one another and counts them in pieces', async ({ page }) => {
		await reachActions(page);
		const rest = await heights(page);

		await coffee(page).click();
		await settled(page);

		const lifted = await lifts(page, rest);
		for (const piece of PIECES) expect(lifted[piece], `${piece} up`).toBeCloseTo(ALL_UP[piece], 0);
		await expect(counter(page)).toHaveText('0/4 · en pièces');
	});

	test('the lid goes up first and the boiler last, the camera steps back and the fire goes out', async ({ page }) => {
		await reachActions(page);
		const rest = await heights(page);
		const stoveWidth = () => figure(page).locator('[data-layer="stove"]').evaluate((el) => el.getBoundingClientRect().width);
		const wide = await stoveWidth();

		// The first frame each piece leaves its seat, in ms from the click.
		const firstMoves = figure(page).evaluate(
			(el, [pieces, before]) =>
				new Promise<Record<string, number>>((resolve) => {
					const stove = el.querySelector('[data-layer="stove"]')!;
					const start = performance.now();
					const moved: Record<string, number> = {};
					const sample = () => {
						const s = stove.getBoundingClientRect();
						for (const piece of pieces as string[]) {
							if (piece in moved) continue;
							const box = el.querySelector(`[data-layer="${piece}"]`)!.getBoundingClientRect();
							const height = (s.top - box.top) / s.height;
							if (height - (before as Record<string, number>)[piece] > 0.01) moved[piece] = performance.now() - start;
						}
						if (Object.keys(moved).length === (pieces as string[]).length || performance.now() - start > 3000) resolve(moved);
						else requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}),
			[PIECES as unknown as string[], rest] as const,
		);
		await coffee(page).click();
		const moves = await firstMoves;

		expect(moves.lid).toBeLessThan(moves.collector);
		expect(moves.collector).toBeLessThan(moves.gasket);
		expect(moves.gasket).toBeLessThan(moves.filter);
		expect(moves.filter).toBeLessThan(moves.boiler);
		await settled(page);
		// The whole moka at ×0.94 of the figure, from the close-up at ×1.56.
		expect((await stoveWidth()) / wide).toBeCloseTo(0.94 / 1.5606, 2);
		expect(await opacityOnScreen(figure(page).locator('[data-layer="knob-on"]'))).toBe(0);
		expect(await opacityOnScreen(figure(page).locator('[data-layer="glow"]'))).toBe(0);
		expect(await opacityOnScreen(figure(page).locator('[data-fire-off]'))).toBe(1);
		// The steam holds still under the fire put out.
		expect(
			await figure(page).evaluate(
				(el) =>
					document.getAnimations().filter((animation) => {
						const target = (animation.effect as KeyframeEffect | null)?.target;
						return target instanceof Element && el.contains(target) && animation.playState === 'running';
					}).length,
			),
		).toBe(0);
	});

	test('each valid field puts its block back on whatever is under it, in any order, and the counter follows', async ({
		page,
	}) => {
		await reachActions(page);
		const rest = await heights(page);
		await coffee(page).click();
		await settled(page);

		// Never sunk into the piece below: a piece is lifted at least as high as every piece under it.
		const expectStacked = async (when: string) => {
			const lifted = await lifts(page, rest);
			for (let i = 1; i < PIECES.length; i++) {
				expect(lifted[PIECES[i]], `${PIECES[i]} over ${PIECES[i - 1]}, ${when}`).toBeGreaterThanOrEqual(
					lifted[PIECES[i - 1]] - 0.2,
				);
			}
			return lifted;
		};

		await message(page).fill('Une carte des moulins du Doubs.');
		await settled(page);
		let lifted = await expectStacked('message');
		expect(lifted.boiler).toBeCloseTo(0, 0);
		expect(lifted['funnel-top']).toBeCloseTo(0, 0);
		// What was over the boiler and the funnel came down by their span.
		expect(lifted.filter).toBeCloseTo(ALL_UP.filter - ALL_UP['funnel-top'], 0);
		await expect(counter(page)).toHaveText('1/4 · une pièce posée');
		await expect(figure(page)).toHaveAccessibleName(
			'Un Moka Express démonté au-dessus de son réchaud éteint : 1 pièces sur 4 remises en place.',
		);

		await name(page).fill('Ada Lovelace');
		await settled(page);
		lifted = await expectStacked('message, name');
		// The lid rests on the collector, still up.
		expect(lifted.lid).toBeCloseTo(lifted.collector, 0);
		expect(lifted.collector).toBeGreaterThan(5);
		await expect(counter(page)).toHaveText('2/4 · à mi-hauteur');

		await email(page).fill('ada@example.org');
		await settled(page);
		await expectStacked('message, name, e-mail');
		await expect(counter(page)).toHaveText('3/4 · presque monté');

		await when(page).getByRole('radio', { name: 'Plus tard' }).check();
		await settled(page);
		lifted = await expectStacked('every field');
		for (const piece of PIECES) expect(lifted[piece], `${piece} seated`).toBeCloseTo(0, 0);
		await expect(counter(page)).toHaveText('4/4 · prêt à chauffer');

		// A field emptied lifts its block again, and everything over it.
		await name(page).fill('');
		await settled(page);
		lifted = await expectStacked('name emptied');
		expect(lifted.lid).toBeCloseTo(ALL_UP.lid - ALL_UP.collector, 0);
		expect(lifted.collector).toBeCloseTo(0, 0);
		await expect(counter(page)).toHaveText('3/4 · presque monté');
	});

	test('the progress rule fills by quarters as the blocks come back', async ({ page }) => {
		await reachActions(page);
		const rule = section(page).locator('.cafe-progress');
		// The ink showing: the rule's width less what the cover still hides.
		const filled = () =>
			rule.evaluate((el) => {
				const track = el.getBoundingClientRect();
				const cover = el.querySelector('[data-cafe-progress-cover]')!.getBoundingClientRect();
				return (track.width - cover.width) / track.width;
			});
		expect(await filled()).toBeCloseTo(1, 2);

		await coffee(page).click();
		await settled(page);
		expect(await filled()).toBeCloseTo(0, 2);

		await name(page).fill('Ada');
		await settled(page);
		expect(await filled()).toBeCloseTo(0.25, 2);
		await email(page).fill('ada@example.org');
		await settled(page);
		expect(await filled()).toBeCloseTo(0.5, 2);
	});

	test('a block glints as its field comes into place, and again each time it changes', async ({ page }) => {
		await reachActions(page);
		await coffee(page).click();
		await settled(page);
		const lidGlint = figure(page).locator('[data-glint-of="n"]');
		const boilerGlint = figure(page).locator('[data-glint-of="m"]').first();
		// The brightest the glint shows over the next second.
		const flash = (glint: Locator) =>
			glint.evaluate(
				(el) =>
					new Promise<number>((resolve) => {
						let brightest = 0;
						const start = performance.now();
						const sample = () => {
							let opacity = 1;
							for (let node: Element | null = el; node && !node.matches('[data-montage]'); node = node.parentElement) {
								opacity *= Number(getComputedStyle(node).opacity);
							}
							brightest = Math.max(brightest, opacity);
							if (performance.now() - start > 1000) resolve(brightest);
							else requestAnimationFrame(sample);
						};
						requestAnimationFrame(sample);
					}),
			);
		expect(await opacityOnScreen(lidGlint)).toBe(0);

		let seen = flash(lidGlint);
		await name(page).fill('Ada');
		expect(await seen).toBeGreaterThan(0.5);
		await settled(page);
		expect(await opacityOnScreen(lidGlint)).toBe(0);

		seen = flash(lidGlint);
		const others = flash(boilerGlint);
		await name(page).fill('');
		expect(await seen).toBeGreaterThan(0.5);
		// Only the block whose field changed.
		expect(await others).toBe(0);

		seen = flash(lidGlint);
		await name(page).fill('Ada');
		expect(await seen).toBeGreaterThan(0.5);
	});

	test('the Repères go with their pieces, show once they are up, and name the field in hand', async ({ page }) => {
		await reachActions(page);
		const TAGS = ['1 le couvercle', '2 le collecteur', '3 le filtre', '4 la chaudière'];
		// The tag, its number in a badge before its piece's name.
		const tag = (text: string) => section(page).getByText(new RegExp(`^${text.replace(' ', '\\s*')}$`));
		const lid = figure(page).locator('[data-layer="lid"]');
		const lidTag = tag(TAGS[0]);
		await expect(lidTag).toHaveCSS('opacity', '0');

		await coffee(page).click();
		await settled(page);
		for (const text of TAGS) await expect(tag(text)).toHaveCSS('opacity', '1');
		// Masked to assistive technologies: the figure's name says it all.
		expect(await section(page).ariaSnapshot()).not.toContain('couvercle');

		// Beside the lid, and still beside it once the collector it stood over has come down.
		const offset = async () => {
			const [a, b] = await Promise.all([lidTag.boundingBox(), lid.boundingBox()]);
			return (a?.y ?? 0) - (b?.y ?? 0);
		};
		const before = await offset();
		await email(page).fill('ada@example.org');
		await settled(page);
		expect(await offset()).toBeCloseTo(before, 0);
		// The collector's own is gone with it.
		await expect(tag(TAGS[1])).toHaveCSS('opacity', '0');

		const colour = (token: string) =>
			page.evaluate((value) => {
				const probe = document.createElement('i');
				probe.style.color = `var(${value})`;
				document.body.append(probe);
				const color = getComputedStyle(probe).color;
				probe.remove();
				return color;
			}, token);
		const [ink, muted] = await Promise.all([colour('--color-ink'), colour('--color-ink-muted')]);
		await message(page).focus();
		await expect(tag(TAGS[3])).toHaveCSS('color', ink);
		await expect(lidTag).toHaveCSS('color', muted);
		await name(page).focus();
		await expect(lidTag).toHaveCSS('color', ink);
		await expect(tag(TAGS[3])).toHaveCSS('color', muted);
	});

	test('closing puts every piece back and lights the fire: the Montage is as it was and plays again', async ({
		page,
	}) => {
		await reachActions(page);
		const layout = () =>
			figure(page).evaluate((el) =>
				// The steam drifts on its own loops once lit.
				[...el.querySelectorAll<HTMLElement>('img[data-layer]:not([data-wisp])')].map((img) => {
					const box = img.getBoundingClientRect();
					let opacity = 1;
					for (let node: Element | null = img; node && node !== el; node = node.parentElement) {
						opacity *= Number(getComputedStyle(node).opacity);
					}
					return [img.dataset.layer, Math.round(box.left), Math.round(box.top), Math.round(box.width), opacity];
				}),
			);
		const before = await layout();

		await coffee(page).click();
		await settled(page);
		await name(page).fill('Ada');
		await page.keyboard.press('Escape');
		await settled(page);

		await expect(figure(page)).toHaveAccessibleName(REST_LABEL);
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
		expect(await layout()).toEqual(before);

		// The scene plays as before: the lid up halfway, then all seated at the end.
		const start = await sceneStart(page);
		await scrollToScene(page, start, 0.5);
		await expect(counter(page)).toHaveText('3/6 · le joint');
		await scrollToScene(page, start, 1);
		await topOnceStill(content(page));
		await settled(page);
		expect(await layout()).toEqual(before);
	});

	test('nothing outlives the base’s cleanup: a flip of the motion preference leaves the Café at rest', async ({
		page,
	}) => {
		await reachActions(page);
		const rest = await heights(page);
		await coffee(page).click();
		await settled(page);
		await name(page).fill('Ada');

		await page.emulateMedia({ reducedMotion: 'reduce' });

		await expect(figure(page)).toHaveAccessibleName(REST_LABEL);
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
		await expect(section(page).getByText(/^1\s*le couvercle$/)).toHaveCSS('opacity', '0');
		await settled(page);
		const lifted = await lifts(page, rest);
		for (const piece of PIECES) expect(lifted[piece], `${piece} seated`).toBeCloseTo(0, 1);
		expect(await opacityOnScreen(figure(page).locator('[data-layer="knob-on"]'))).toBe(1);
	});
});

const visio = (page: Page) => section(page).getByRole('button', { name: 'Plutôt en visio', exact: true });
const toVisio = (page: Page) => form(page).getByRole('button', { name: 'plutôt en visio', exact: true });
const toCafe = (page: Page) => form(page).getByRole('button', { name: 'plutôt un café', exact: true });
/** The screen's frame, drawn one stroke after the other, clockwise from the top. */
const STROKES = ['top', 'right', 'bottom', 'left'] as const;
/** The call inside the screen and the monitor's stand. */
const CALL = ['café · en visio', '2 participants', 'Louis', 'vous'] as const;

/**
 * Samples the visio screen every frame for `ms`: when each stroke is first fully drawn and last seen fully drawn,
 * when the call is first and last fully shown, and the moka's scale (the stove's width against `restWidth`).
 */
const watchScreen = (page: Page, ms: number) =>
	section(page).evaluate(
		(el, [strokes, call, ms]) =>
			new Promise<{
				drawn: Record<string, number>;
				lastDrawn: Record<string, number>;
				undrawn: Record<string, number>;
				shown: number;
				lastShown: number;
				stoveFirstChange: number;
			}>((resolve) => {
				const start = performance.now();
				const stove = el.querySelector('[data-layer="stove"]')!;
				const width = stove.getBoundingClientRect().width;
				const strokeOf = (name: string) => el.querySelector(`[data-cafe-screen] [data-stroke="${name}"]`)!;
				// A stroke's drawn share: its length on screen against its full one, read off its transform's scale.
				const drawnShare = (node: Element) => {
					const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
					return Math.max(Math.abs(matrix.a), 0) * Math.abs(matrix.d) * Number(getComputedStyle(node).opacity);
				};
				const opacityOf = (node: Element) => {
					let opacity = 1;
					for (let at: Element | null = node; at && at !== el; at = at.parentElement) {
						opacity *= Number(getComputedStyle(at).opacity);
					}
					return opacity;
				};
				const callNodes = (call as string[]).map(
					(text) => [...el.querySelectorAll('[data-cafe-screen] *')].find((node) => node.textContent?.trim() === text)!,
				);
				const drawn: Record<string, number> = {};
				const lastDrawn: Record<string, number> = {};
				const undrawn: Record<string, number> = {};
				let shown = -1;
				let lastShown = -1;
				let stoveFirstChange = -1;
				const sample = () => {
					const now = performance.now() - start;
					for (const name of strokes as string[]) {
						const share = drawnShare(strokeOf(name));
						if (share > 0.99) {
							if (!(name in drawn)) drawn[name] = now;
							lastDrawn[name] = now;
						}
						if (share < 0.01 && !(name in undrawn)) undrawn[name] = now;
					}
					if (callNodes.every((node) => opacityOf(node) > 0.99)) {
						if (shown < 0) shown = now;
						lastShown = now;
					}
					if (stoveFirstChange < 0 && Math.abs(stove.getBoundingClientRect().width - width) > 0.5) stoveFirstChange = now;
					if (now > (ms as number)) resolve({ drawn, lastDrawn, undrawn, shown, lastShown, stoveFirstChange });
					else requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			}),
		[STROKES as unknown as string[], CALL as unknown as string[], ms] as const,
	);

/** How much of a piece of the call shows: its opacity times that of every box around it in the section. */
const callShown = (page: Page, text: string) =>
	section(page)
		.getByText(text, { exact: true })
		.evaluate((node) => {
			let opacity = 1;
			for (let at: Element | null = node; at && !at.matches('[data-cafe]'); at = at.parentElement) {
				opacity *= Number(getComputedStyle(at).opacity);
			}
			return opacity;
		});

const stoveWidth = (page: Page) =>
	figure(page)
		.locator('[data-layer="stove"]')
		.evaluate((el) => el.getBoundingClientRect().width);

test.describe('Démontage, visio mode in two columns', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

	test('opening in visio shrinks the moka into a call’s screen, its frame drawn stroke by stroke, then the call', async ({
		page,
	}) => {
		await reachActions(page);
		const wide = await stoveWidth(page);

		const watched = watchScreen(page, 2500);
		await visio(page).click();
		const { drawn, shown } = await watched;

		// Clockwise from the top, each stroke done before the next one is.
		expect(Object.keys(drawn).sort()).toEqual([...STROKES].sort());
		for (let i = 1; i < STROKES.length; i++) expect(drawn[STROKES[i]], STROKES[i]).toBeGreaterThan(drawn[STROKES[i - 1]]);
		// The call and the stand come in once the frame is whole.
		expect(shown).toBeGreaterThan(drawn.left);
		await settled(page);
		// The whole moka at ×0.4 of the figure, from the close-up at ×1.56.
		expect((await stoveWidth(page)) / wide).toBeCloseTo(0.4 / 1.5606, 2);
		for (const text of CALL) expect(await callShown(page, text), text).toBe(1);
		// The frame in the theme's ink.
		const ink = await page.evaluate(() => {
			const probe = document.createElement('i');
			probe.style.color = 'var(--color-ink)';
			document.body.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		});
		for (const stroke of STROKES) {
			await expect(section(page).locator(`[data-cafe-screen] [data-stroke="${stroke}"]`)).toHaveCSS('background-color', ink);
		}
	});

	test('the screen is masked to assistive technologies; the figure is named in a screen', async ({ page }) => {
		await reachActions(page);
		await visio(page).click();
		await settled(page);

		await expect(figure(page)).toHaveAccessibleName(
			'Un Moka Express démonté au-dessus de son réchaud éteint, dans le cadre d’un écran : 0 pièces sur 4 remises en place.',
		);
		const tree = await section(page).ariaSnapshot();
		// « vous » aside, which the visio's heading says too.
		for (const text of CALL.filter((text) => text !== 'vous')) expect(tree).not.toContain(text);

		await toCafe(page).click();
		await settled(page);
		await expect(figure(page)).toHaveAccessibleName(
			'Un Moka Express démonté au-dessus de son réchaud éteint : 0 pièces sur 4 remises en place.',
		);
	});

	test('back to café, the call and the stand leave first, the frame comes undone in reverse, then the moka grows', async ({
		page,
	}) => {
		await reachActions(page);
		const wide = await stoveWidth(page);
		await visio(page).click();
		await settled(page);

		const watched = watchScreen(page, 2000);
		await toCafe(page).click();
		const { lastDrawn, lastShown, undrawn, stoveFirstChange } = await watched;

		expect(Object.keys(undrawn).sort()).toEqual([...STROKES].sort());
		// Left first, top last: each stroke starts going once the one after it has.
		for (let i = 1; i < STROKES.length; i++) {
			expect(lastDrawn[STROKES[i - 1]], STROKES[i - 1]).toBeGreaterThan(lastDrawn[STROKES[i]]);
		}
		expect(stoveFirstChange).toBeGreaterThan(lastShown);
		await settled(page);
		expect((await stoveWidth(page)) / wide).toBeCloseTo(0.94 / 1.5606, 2);
		for (const text of CALL) expect(await callShown(page, text), text).toBe(0);
	});

	test('closing from visio takes the screen down before the moka is whole again', async ({ page }) => {
		await reachActions(page);
		await visio(page).click();
		await settled(page);

		const watched = watchScreen(page, 2000);
		await page.keyboard.press('Escape');
		const { undrawn, lastShown, stoveFirstChange } = await watched;

		expect(Object.keys(undrawn).sort()).toEqual([...STROKES].sort());
		expect(stoveFirstChange).toBeGreaterThan(lastShown);
		await settled(page);
		await expect(figure(page)).toHaveAccessibleName(REST_LABEL);
	});

	test('on a switch the Repères follow the camera, and the blocks and the input stay as they were', async ({ page }) => {
		await reachActions(page);
		const rest = await heights(page);
		await coffee(page).click();
		await settled(page);
		await name(page).fill('Ada');
		await settled(page);
		const before = await lifts(page, rest);

		// The collector's tag against its piece, in stove heights: the camera's moves cancel out if the tag rides with it.
		const drift = () =>
			section(page).evaluate(
				(el) =>
					new Promise<number[]>((resolve) => {
						// The innermost: the text itself, not the tag's box at the figure's corner.
						const tag = [...el.querySelectorAll('[aria-hidden="true"] *')].findLast((node) =>
							/^2\s*le collecteur$/.test(node.textContent?.trim() ?? ''),
						)!;
						const piece = el.querySelector('[data-layer="collector"]')!;
						const stove = el.querySelector('[data-layer="stove"]')!;
						const offsets: number[] = [];
						const start = performance.now();
						const sample = () => {
							const t = tag.getBoundingClientRect();
							const p = piece.getBoundingClientRect();
							const s = stove.getBoundingClientRect();
							offsets.push((t.top + t.height / 2 - p.top) / s.height);
							if (performance.now() - start > 1600) resolve(offsets);
							else requestAnimationFrame(sample);
						};
						requestAnimationFrame(sample);
					}),
			);
		const spread = (offsets: number[]) => Math.max(...offsets) - Math.min(...offsets);

		let watched = drift();
		await toVisio(page).click();
		expect(spread(await watched)).toBeLessThan(0.03);
		await settled(page);
		watched = drift();
		await toCafe(page).click();
		expect(spread(await watched)).toBeLessThan(0.03);
		await settled(page);

		const after = await lifts(page, rest);
		for (const piece of PIECES) expect(after[piece], piece).toBeCloseTo(before[piece], 0);
		await expect(name(page)).toHaveValue('Ada');
		await expect(counter(page)).toHaveText('1/4 · une pièce posée');
	});
});

test.describe('Démontage, visio under reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

	test('the screen and the call fade in and out, nothing moves', async ({ page }) => {
		await page.goto('/');
		await visio(page).scrollIntoViewIfNeeded();

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
		await visio(page).click();
		await expect.poll(() => callShown(page, 'café · en visio')).toBe(1);
		await toCafe(page).click();
		await expect.poll(() => callShown(page, 'café · en visio')).toBe(0);
		const properties = await running;
		expect(properties.length).toBeGreaterThan(0);
		for (const property of properties) expect(['opacity', 'visibility', 'color', 'background-color']).toContain(property);
	});
});

test.describe('Démontage, reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

	test('only short fades: no piece moves and nothing glints', async ({ page }) => {
		await page.goto('/');
		await coffee(page).scrollIntoViewIfNeeded();
		const rest = await heights(page);

		// Everything that runs in the section over the opening.
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
						if (performance.now() - start > 1500) resolve([...seen]);
						else requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}),
		);
		await coffee(page).click();
		// At once, without moving there.
		await expect.poll(async () => (await lifts(page, rest)).lid).toBeCloseTo(ALL_UP.lid, 0);
		const properties = await running;
		expect(properties.length).toBeGreaterThan(0);
		for (const property of properties) expect(['opacity', 'visibility', 'color', 'background-color']).toContain(property);
		await expect(counter(page)).toHaveText('0/4 · en pièces');

		await name(page).fill('Ada');
		for (const glint of await figure(page).locator('[data-glint-of]').all()) expect(await opacityOnScreen(glint)).toBe(0);
		// Down onto the collector, still up.
		expect((await lifts(page, rest)).lid).toBeCloseTo(ALL_UP.collector, 0);
	});
});
