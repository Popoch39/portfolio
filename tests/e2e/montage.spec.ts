import { expect, test, type Locator, type Page } from './fixtures';
import { content, header, scrollPosition, scrollWithWheel, topOnceStill, verticalTranslation } from './helpers';
import {
	PIN_HEIGHTS,
	cafeCounter as counter,
	montageFigure as montage,
	sceneStart,
	scrollToScene,
	cafeSection as section,
} from './montage-helpers';

// Without JavaScript and under reduced motion alike, the Café stays at its final state.
const FINAL_STATE_CONTEXTS = [
	{ name: 'without JavaScript', use: { javaScriptEnabled: false } },
	{ name: 'reduced motion', use: { reducedMotion: 'reduce' as const } },
];

for (const { name, use } of FINAL_STATE_CONTEXTS) {
	test.describe(`Café, final state, ${name}`, () => {
		test.use(use);

		test('the Café is section 04, between the Stack and the Contact, now 05', async ({ page }) => {
			await page.goto('/');

			const order = await page.evaluate(() => {
				const cafe = document.querySelector('[aria-labelledby="cafe-title"]');
				const [stack, contact] = ['#stack', '#contact'].map((selector) => document.querySelector(selector));
				if (!cafe || !stack || !contact) return null;
				return {
					afterStack: !!(stack.compareDocumentPosition(cafe) & Node.DOCUMENT_POSITION_FOLLOWING),
					beforeContact: !!(cafe.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING),
				};
			});
			expect(order).toEqual({ afterStack: true, beforeContact: true });
			await expect(section(page).locator('.section-number')).toHaveText('04');
			await expect(page.locator('#contact .section-number')).toHaveText('05');
		});

		test('the section has a single heading, its title on three lines, and its aside', async ({ page }) => {
			await page.goto('/');

			await expect(section(page).getByRole('heading')).toHaveCount(1);
			const title = section(page).getByRole('heading', { level: 2 });
			await expect(title).toBeVisible();
			const lines = await title.evaluate((el) => {
				const tops = new Set<number>();
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				for (let node = walker.nextNode(); node; node = walker.nextNode()) {
					if (!node.textContent?.trim()) continue;
					const range = document.createRange();
					range.selectNodeContents(node);
					for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
				}
				return tops.size;
			});
			expect(lines).toBe(3);
			await expect(section(page).getByText('on monte, puis on en parle', { exact: true })).toBeVisible();
		});

		test('the counter reads the last step, over a full progress rule', async ({ page }) => {
			await page.goto('/');

			await expect(section(page).getByText(/\d\/6 · /)).toHaveText('6/6 · sur le feu');
			await expect(section(page).getByText(/\d\/6 · /)).toHaveCSS('opacity', '1');
			const [track, fill] = await Promise.all(
				['.cafe-progress', '[data-cafe-progress]'].map((selector) => section(page).locator(selector).boundingBox()),
			);
			expect(track?.width).toBeGreaterThan(0);
			expect(fill?.width).toBeCloseTo(track?.width ?? 0, 0);
		});

		test('the paragraph and both actions are there, the actions write a mail to Louis', async ({ page }) => {
			await page.goto('/');

			const paragraph = section(page).getByText(/^À Besançon, ou en visio si vous êtes plus loin\./);
			await expect(paragraph).toBeVisible();
			await expect(paragraph).toHaveText(
				'À Besançon, ou en visio si vous êtes plus loin. Comme une moka : on assemble les pièces dans l’ordre, sans rien forcer. Et sans engagement : au pire, on aura bu un café.',
			);
			const coffee = section(page).getByRole('link', { name: 'Proposer un café', exact: true });
			const visio = section(page).getByRole('link', { name: 'Plutôt en visio', exact: true });
			await expect(coffee).toBeVisible();
			await expect(visio).toBeVisible();
			await expect(coffee).toHaveAttribute('href', 'mailto:pocheron.louis@gmail.com?subject=Un%20caf%C3%A9%20%3F');
			await expect(visio).toHaveAttribute('href', 'mailto:pocheron.louis@gmail.com?subject=Une%20visio%20%3F');
		});

		test('the drawing is announced as a single image, its layers decorative, sized and loaded late', async ({
			page,
		}) => {
			await page.goto('/');

			await expect(section(page).getByRole('img')).toHaveCount(1);
			await expect(montage(page)).toHaveAccessibleName(
				'Une Moka Express en pièces au-dessus d’un réchaud, que le défilement remonte pièce par pièce avant d’allumer le feu.',
			);
			const layers = montage(page).locator('img');
			expect(await layers.count()).toBeGreaterThan(0);
			for (const layer of await layers.all()) {
				await expect(layer).toHaveAttribute('alt', '');
				await expect(layer).toHaveAttribute('width', /^\d+$/);
				await expect(layer).toHaveAttribute('height', /^\d+$/);
				await expect(layer).toHaveAttribute('loading', 'lazy');
			}
		});

		test('the moka stands assembled on the stove, closed in on: the drawing fills the figure', async ({ page }) => {
			await page.goto('/');
			await montage(page).scrollIntoViewIfNeeded();

			// The layers: the screwing's strip only shows during the scene.
			const layers = montage(page).locator('img[data-layer]');
			for (const layer of await layers.all()) {
				await expect.poll(() => layer.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
				// Every piece at its seat: nothing lifted.
				await expect(layer).toHaveCSS('transform', 'none');
			}
			const { figure, drawing } = await montage(page).evaluate((el) => {
				const boxes = [...el.querySelectorAll('img[data-layer]')].map((img) => img.getBoundingClientRect());
				const box = el.getBoundingClientRect();
				return {
					figure: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
					drawing: {
						left: Math.min(...boxes.map((b) => b.left)),
						top: Math.min(...boxes.map((b) => b.top)),
						right: Math.max(...boxes.map((b) => b.right)),
						bottom: Math.max(...boxes.map((b) => b.bottom)),
					},
				};
			});
			// Seen whole and large: the camera has closed in from ×1 (the stove alone is 61% of the frame). The images'
			// boxes run a little past what they draw (a blur's reach): a margin of 4% of the figure.
			const width = figure.right - figure.left;
			const margin = 0.04 * width;
			expect(drawing.left).toBeGreaterThanOrEqual(figure.left - margin);
			expect(drawing.right).toBeLessThanOrEqual(figure.right + margin);
			expect(drawing.top).toBeGreaterThanOrEqual(figure.top - margin);
			expect(drawing.bottom).toBeLessThanOrEqual(figure.bottom + margin);
			expect(drawing.right - drawing.left).toBeGreaterThan(0.9 * width);
		});

		test('the final state shows the collector’s layer, not the screwing’s strip', async ({ page }) => {
			await page.goto('/');
			await montage(page).scrollIntoViewIfNeeded();

			await expect(montage(page).locator('[data-layer="collector"]')).toBeVisible();
			await expect(montage(page).locator('[data-screw]')).toBeHidden();
		});

		test('nothing moves in the figure: the steam stands still', async ({ page }) => {
			await page.goto('/');
			await montage(page).scrollIntoViewIfNeeded();

			const running = await montage(page).evaluate(
				(el) => document.getAnimations().filter((animation) => {
					const target = (animation.effect as KeyframeEffect | null)?.target;
					return target instanceof Element && el.contains(target);
				}).length,
			);
			expect(running).toBe(0);
		});
	});
}

// Without JavaScript, browsers load lazy images as eager ones: only reduced motion can spare the strip.
test.describe('Café, final state, reduced motion, the screwing', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the screwing’s strip is never downloaded', async ({ page }) => {
		const strips: string[] = [];
		page.on('request', (request) => {
			if (/screw.*\.webp/.test(request.url())) strips.push(request.url());
		});
		await page.goto('/');
		await page.locator('#contact').scrollIntoViewIfNeeded();
		await montage(page).scrollIntoViewIfNeeded();
		await expect(montage(page).locator('[data-layer="collector"]')).toBeVisible();

		expect(strips).toEqual([]);
	});
});

/** A point inside each step of the board, as a share of the pinning, and what the counter says there. */
const STEPS: [number, string][] = [
	[0.02, '0/6 · en pièces'],
	[0.1, '0/6 · la chaudière'],
	[0.25, '1/6 · l’entonnoir et le café'],
	[0.4, '2/6 · le filtre'],
	[0.47, '3/6 · le joint'],
	[0.58, '4/6 · on visse le collecteur, un tour'],
	[0.7, '5/6 · le couvercle'],
	[0.9, '6/6 · sur le feu'],
];

/** A layer's opacity as seen: its own times that of every box around it in the figure. */
const opacityOnScreen = (layer: Locator) =>
	layer.evaluate((el) => {
		let opacity = 1;
		for (let node: Element | null = el; node && !node.matches('[data-montage]'); node = node.parentElement) {
			opacity *= Number(getComputedStyle(node).opacity);
		}
		return opacity;
	});

/** Animations running in the figure: only the steam loops. */
const runningAnimations = (page: Page) =>
	montage(page).evaluate(
		(el) =>
			document.getAnimations().filter((animation) => {
				const target = (animation.effect as KeyframeEffect | null)?.target;
				return target instanceof Element && el.contains(target) && animation.playState === 'running';
			}).length,
	);

/** Where each layer stands in the figure and how opaque it shows. */
const figureLayout = (page: Page) =>
	montage(page).evaluate((figure) => {
		const frame = figure.getBoundingClientRect();
		const layout: Record<string, { left: number; top: number; width: number; height: number; opacity: number }> = {};
		for (const img of figure.querySelectorAll<HTMLElement>('img[data-layer]')) {
			const box = img.getBoundingClientRect();
			let opacity = 1;
			for (let node: Element | null = img; node && node !== figure; node = node.parentElement) {
				opacity *= Number(getComputedStyle(node).opacity);
			}
			layout[img.dataset.layer ?? ''] = {
				left: box.left - frame.left,
				top: box.top - frame.top,
				width: box.width,
				height: box.height,
				opacity,
			};
		}
		return layout;
	});

/** The six pieces, each by its main layer, in the order they come down. */
const PIECES = ['boiler', 'funnel-top', 'filter', 'gasket', 'collector', 'lid'];

test.describe('Montage, scene', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the section stays pinned for 290svh, then the page scrolls on', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);

		for (const progress of [0, 0.5, 0.95]) {
			await scrollToScene(page, start, progress);
			expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		}

		await page.evaluate(([top, heights]) => scrollTo(0, top + heights * innerHeight + 300), [start, PIN_HEIGHTS]);
		await expect.poll(() => topOnceStill(section(page))).toBeCloseTo(-300, -1);
	});

	test('the counter names the step in progress, forward then back', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);

		for (const [progress, step] of STEPS) {
			await scrollToScene(page, start, progress);
			await expect(counter(page)).toHaveText(step);
		}
		for (const [progress, step] of [...STEPS].reverse()) {
			await scrollToScene(page, start, progress);
			await expect(counter(page)).toHaveText(step);
		}
	});

	test('the counter text only changes when the step does, never on every frame', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);
		await scrollToScene(page, start, 0);
		// The count lands in an attribute, which the observer does not watch.
		await counter(page).evaluate((el) => {
			el.dataset.testChanges = '0';
			new MutationObserver((records) => {
				el.dataset.testChanges = String(Number(el.dataset.testChanges) + records.length);
			}).observe(el, { subtree: true, childList: true, characterData: true });
		});

		// The smoothing eases this jump over about a second: dozens of frames.
		await scrollToScene(page, start, 1);
		await expect(counter(page)).toHaveText('6/6 · sur le feu');

		// Seven steps after the first one.
		const changes = Number(await counter(page).getAttribute('data-test-changes'));
		expect(changes).toBeGreaterThan(0);
		expect(changes).toBeLessThanOrEqual(7);
	});

	test('as the section comes in, before the pinning, the title rises line by line and the header rule draws', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const lines = section(page).getByRole('heading', { level: 2 }).locator('[data-cafe-line]');
		const rule = section(page).locator('[data-cafe-rule]');
		const ruleShare = () =>
			rule.evaluate((el) => el.getBoundingClientRect().width / (el.parentElement?.clientWidth || 1));

		// The section's top a third of the way down the window, past the middle where the entrance begins.
		await page.evaluate((top) => scrollTo(0, top - innerHeight * 0.3), start);
		await topOnceStill(section(page));
		const rises = await Promise.all((await lines.all()).map(verticalTranslation));
		expect(rises[0]).toBeGreaterThan(0);
		// One after the other: the lower lines lag behind.
		expect(rises[1]).toBeGreaterThan(rises[0]);
		expect(rises[2]).toBeGreaterThan(rises[1]);
		expect(await ruleShare()).toBeLessThan(0.5);

		await scrollToScene(page, start, 0);
		for (const line of await lines.all()) expect(await verticalTranslation(line)).toBe(0);
		expect(await ruleShare()).toBeGreaterThan(0.9);
	});

	test('the pieces come down one after another, each in its range of the board', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const lift = (name: string) => verticalTranslation(montage(page).locator(`[data-layer="${name}"]`));

		await scrollToScene(page, start, 0.02);
		for (const name of PIECES) expect(await lift(name), `${name} up`).toBeLessThan(-5);
		const boilerUp = await lift('boiler');
		const funnelUp = await lift('funnel-top');

		// The boiler (4–16.8%) is on its way, the funnel (16.8–34.4%) still up.
		await scrollToScene(page, start, 0.1);
		expect(await lift('boiler')).toBeLessThan(-1);
		expect(await lift('boiler')).toBeGreaterThan(boilerUp + 1);
		expect(await lift('funnel-top')).toBe(funnelUp);

		await scrollToScene(page, start, 0.3);
		expect(await lift('boiler')).toBe(0);
		expect(await lift('funnel-top')).toBeLessThan(-1);
		expect(await lift('lid')).toBeLessThan(-5);

		// The collector (44–66%) is coming down, everything under it seated.
		await scrollToScene(page, start, 0.55);
		for (const name of ['boiler', 'funnel-top', 'filter', 'gasket']) expect(await lift(name), `${name} seated`).toBe(0);
		expect(await lift('collector')).toBeLessThan(0);
		expect(await lift('lid')).toBeLessThan(-5);

		await scrollToScene(page, start, 0.8);
		for (const name of PIECES) expect(await lift(name), `${name} seated`).toBe(0);
	});

	test('a piece glints along its edge while it comes down, not once seated', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const glint = montage(page).locator('[data-layer="edge-boiler"]');

		await scrollToScene(page, start, 0.02);
		await expect.poll(() => opacityOnScreen(glint)).toBe(0);
		await scrollToScene(page, start, 0.1);
		await expect.poll(() => opacityOnScreen(glint)).toBe(1);
		await scrollToScene(page, start, 0.2);
		await expect.poll(() => opacityOnScreen(glint)).toBe(0);
	});

	test('the collector is screwed on in one clockwise turn, view by view, and comes undone scrolling back', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const layer = montage(page).locator('[data-layer="collector"]');
		const screw = montage(page).locator('[data-screw]');
		// The strip's view in the window, counted from its top: a whole number when a step lands on a whole image.
		const view = () =>
			screw.evaluate((window) => {
				const strip = window.querySelector('img')?.getBoundingClientRect();
				const box = window.getBoundingClientRect();
				return strip ? (box.top - strip.top) / box.height : Number.NaN;
			});
		const expectWholeView = async (expected: number) => {
			const shown = await view();
			expect(Math.abs(shown - Math.round(shown)), `view ${shown}`).toBeLessThan(0.01);
			expect(Math.round(shown)).toBe(expected);
		};
		/*
		 * Points of the turn, as shares of the pinning, and the view the board shows there: views 1 to 35 share the
		 * turn from 50.701% to 64.799%, the seated view 36 comes after it.
		 */
		const TURN: [number, number][] = [
			[0.53, 6],
			[0.57, 16],
			[0.61, 26],
			[0.6455, 35],
		];

		// Before: the collector's layer comes down alone.
		await scrollToScene(page, start, 0.42);
		expect(await opacityOnScreen(layer)).toBe(1);
		expect(await opacityOnScreen(screw)).toBe(0);
		// The relay: the first view, lit, glows over the layer as it lands on the thread.
		await scrollToScene(page, start, 0.48);
		expect(await opacityOnScreen(layer)).toBe(1);
		expect(await opacityOnScreen(screw)).toBe(1);
		await expectWholeView(0);

		for (const [progress, expected] of TURN) {
			await scrollToScene(page, start, progress);
			expect(await opacityOnScreen(layer), `layer at ${progress}`).toBe(0);
			expect(await opacityOnScreen(screw), `strip at ${progress}`).toBe(1);
			await expectWholeView(expected);
		}

		// After: the seated view has faded out over the layer, back on screen.
		await scrollToScene(page, start, 0.7);
		expect(await opacityOnScreen(layer)).toBe(1);
		expect(await opacityOnScreen(screw)).toBe(0);
		await expectWholeView(36);

		for (const [progress, expected] of [...TURN].reverse()) {
			await scrollToScene(page, start, progress);
			expect(await opacityOnScreen(layer), `layer at ${progress}`).toBe(0);
			await expectWholeView(expected);
		}
		await scrollToScene(page, start, 0.42);
		expect(await opacityOnScreen(layer)).toBe(1);
		expect(await opacityOnScreen(screw)).toBe(0);
		await expectWholeView(0);
	});

	test('the screwing’s strip is ready before the turn: loaded by the time the scene starts', async ({ page }) => {
		await page.goto('/');
		const strip = montage(page).locator('[data-screw] img');
		expect(await strip.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(false);

		await scrollToScene(page, await sceneStart(page), 0);

		await expect.poll(() => strip.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
	});

	test('the scrolling keys move the scene forward and back', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);

		for (const [forward, back] of [
			['PageDown', 'PageUp'],
			['Space', 'Shift+Space'],
		]) {
			await scrollToScene(page, start, 0.2);
			await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');
			await page.keyboard.press(forward);
			await expect(counter(page)).not.toHaveText('1/6 · l’entonnoir et le café');
			await expect(counter(page)).not.toHaveText(/^0\/6/);
			await page.keyboard.press(back);
			await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');
		}

		// An arrow scrolls a few lines: the funnel, on its way, moves with it.
		await scrollToScene(page, start, 0.2);
		const funnel = montage(page).locator('[data-layer="funnel-top"]');
		const before = await verticalTranslation(funnel);
		for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
		await expect.poll(() => verticalTranslation(funnel)).toBeGreaterThan(before + 1);
		await topOnceStill(content(page));
		const lower = await verticalTranslation(funnel);
		for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
		await expect.poll(() => verticalTranslation(funnel)).toBeLessThan(lower - 1);
	});

	test('once the lid is on, the fire lights, the glow rises, the steam drifts and the camera closes in on the top', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const layer = (name: string) => montage(page).locator(`[data-layer="${name}"]`);
		const stoveWidth = () => layer('stove').evaluate((el) => el.getBoundingClientRect().width);

		await scrollToScene(page, start, 0.5);
		expect(await opacityOnScreen(layer('knob-off'))).toBe(1);
		expect(await opacityOnScreen(layer('knob-on'))).toBe(0);
		expect(await opacityOnScreen(layer('glow'))).toBe(0);
		expect(await opacityOnScreen(layer('steam-0'))).toBe(0);
		expect(await runningAnimations(page)).toBe(0);
		const wide = await stoveWidth();

		await scrollToScene(page, start, 1);
		expect(await opacityOnScreen(layer('knob-off'))).toBe(0);
		expect(await opacityOnScreen(layer('knob-on'))).toBe(1);
		expect(await opacityOnScreen(layer('glow'))).toBeCloseTo(0.3, 2);
		// The three wisps drift, each on its own loop.
		expect(await runningAnimations(page)).toBe(3);
		// The board's close-up: ×1.56 from ×1.
		expect((await stoveWidth()) / wide).toBeCloseTo(1.5606 / 1.0086, 1);
	});

	test('the end of the scene is the final state', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 1);
		const atTheEnd = await figureLayout(page);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect.poll(() => runningAnimations(page)).toBe(0);
		await montage(page).scrollIntoViewIfNeeded();
		const finalState = await figureLayout(page);

		for (const [name, layout] of Object.entries(finalState)) {
			// The steam drifts at the end of the scene; still, it is the final state's own.
			if (name.startsWith('steam')) continue;
			const end = atTheEnd[name];
			expect(end.opacity, `${name} opacity`).toBeCloseTo(layout.opacity, 2);
			for (const side of ['left', 'top', 'width', 'height'] as const) {
				expect(end[side], `${name} ${side}`).toBeCloseTo(layout[side], 0);
			}
		}
	});

	test('the paragraph and the actions rise in at the end of the scene', async ({ page }) => {
		await page.goto('/');
		const start = await sceneStart(page);
		const paragraph = section(page).getByText(/^À Besançon/);
		const actions = section(page).getByRole('link', { name: 'Proposer un café', exact: true });
		const opacity = (element: Locator) => element.evaluate((el) => {
			let value = 1;
			for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
			return value;
		});

		await scrollToScene(page, start, 0.7);
		expect(await opacity(paragraph)).toBe(0);
		expect(await opacity(actions)).toBe(0);

		// The paragraph first (76–82%), then the actions (80–86%).
		await scrollToScene(page, start, 0.79);
		expect(await opacity(paragraph)).toBeGreaterThan(0);
		expect(await opacity(actions)).toBe(0);

		await scrollToScene(page, start, 0.9);
		expect(await opacity(paragraph)).toBe(1);
		expect(await opacity(actions)).toBe(1);
		expect(await verticalTranslation(paragraph)).toBe(0);
	});

	test('at the end, the page scrolls on to the Contact without a jump', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 1);
		const end = await scrollPosition(page);

		for (const extra of [100, 200, 300]) {
			await page.evaluate((y) => scrollTo(0, y), end + extra);
			await expect.poll(() => topOnceStill(section(page))).toBeCloseTo(-extra, -1);
		}
		await page.evaluate((y) => scrollTo(0, y + innerHeight), end);
		await expect(page.locator('#contact')).toBeInViewport();
	});

	test('flipping the preference during the visit switches between the scene and the final state', async ({
		page,
	}) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0.5);
		await expect(counter(page)).toHaveText('3/6 · le joint');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
		await expect.poll(() => verticalTranslation(content(page))).toBe(0);
		for (const name of PIECES) {
			await expect(montage(page).locator(`[data-layer="${name}"]`), `${name} seated`).toHaveCSS('transform', 'none');
		}
		await expect(section(page).getByText(/^À Besançon/)).toHaveCSS('opacity', '1');
		await expect(section(page).locator('[data-cafe-actions]')).toHaveCSS('opacity', '1');

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await scrollToScene(page, await sceneStart(page), 0.5);
		expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		await expect(counter(page)).toHaveText('3/6 · le joint');
		expect(await verticalTranslation(montage(page).locator('[data-layer="lid"]'))).toBeLessThan(-5);
	});

	test('the header’s Contact link leads past the scene to the Contact', async ({ page }) => {
		await page.goto('/');

		await header(page).getByRole('link', { name: 'Contact' }).click();

		await expect(page.locator('#contact')).toBeInViewport();
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
	});

	test('the page loaded with /#contact opens on the Contact, past the scene', async ({ page }) => {
		await page.goto('/#contact');

		await expect(page.locator('#contact')).toBeInViewport();
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
	});

	test('Tab reaches the actions shown: the scene moves on to where they have risen in', async ({ page }) => {
		await page.goto('/');
		await page.locator('#stack').getByRole('link').last().focus();
		const coffee = section(page).getByRole('link', { name: 'Proposer un café', exact: true });

		await page.keyboard.press('Tab');

		await expect(coffee).toBeFocused();
		await expect.poll(() => coffee.evaluate((el) => Number(getComputedStyle(el.parentElement!).opacity))).toBe(1);
		await expect(coffee).toBeInViewport();
	});

	test('Shift+Tab from the Contact comes back to the actions shown', async ({ page }) => {
		await page.goto('/#contact');
		await page.locator('#contact').getByRole('link').first().focus();
		const visio = section(page).getByRole('link', { name: 'Plutôt en visio', exact: true });

		await page.keyboard.press('Shift+Tab');

		await expect(visio).toBeFocused();
		await expect.poll(() => visio.evaluate((el) => Number(getComputedStyle(el.parentElement!).opacity))).toBe(1);
		await expect(visio).toBeInViewport();
	});

	test('with the wheel, the moka goes on assembling, and comes apart again when scrolling up', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await sceneStart(page), 0.2);
		const funnel = montage(page).locator('[data-layer="funnel-top"]');
		const before = await verticalTranslation(funnel);
		expect(before, 'the funnel on its way down').toBeLessThan(-1);
		await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');

		await scrollWithWheel(page, 600);
		await expect(counter(page)).toHaveText('3/6 · le joint');
		await topOnceStill(content(page));
		expect(await verticalTranslation(funnel)).toBe(0);

		await scrollWithWheel(page, -600);
		await expect(counter(page)).toHaveText('1/6 · l’entonnoir et le café');
		await topOnceStill(content(page));
		// Up again, near where it was: the wheel's steps do not bring the page back to the exact pixel.
		expect(await verticalTranslation(funnel)).toBeLessThan(before / 2);
	});
});
