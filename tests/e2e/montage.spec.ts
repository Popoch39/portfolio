import { expect, test } from './fixtures';
import { montageFigure as montage, cafeSection as section } from './montage-helpers';

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

			const layers = montage(page).locator('img');
			for (const layer of await layers.all()) {
				await expect.poll(() => layer.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
				// Every piece at its seat: nothing lifted.
				await expect(layer).toHaveCSS('transform', 'none');
			}
			const { figure, drawing } = await montage(page).evaluate((el) => {
				const boxes = [...el.querySelectorAll('img')].map((img) => img.getBoundingClientRect());
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
