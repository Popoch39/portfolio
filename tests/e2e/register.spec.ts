import { devices, expect, test, type Locator, type Page } from './fixtures';

/**
 * The name out of register: a press on « Écrire » shows a second plate of the name in the accent,
 * slipped off the ink, which snaps back under it in 0.18 s and is gone.
 * On 9 November 2026 the sun is up at noon and sets at about 17:10, Paris time.
 */

const at = (time: string) => new Date(`2026-11-09T${time}:00+01:00`);

async function visitAt(page: Page, time: string) {
	await page.clock.setFixedTime(at(time));
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
}

const dayName = (page: Page) => page.getByRole('heading', { level: 1 });
const nightName = (page: Page) => page.locator('.sky-sheet .hero-title');
const write = (page: Page) => page.getByRole('link', { name: /^Écrire/ });

/** How long the plate takes from the press to its place under the ink (ms). */
const SNAP = 180;

/**
 * Holds the plates still from the moment they show, so that a test reads them at the times it picks
 * rather than racing 0.18 s. Called before the press. Held within the gesture's own event, once the
 * page has answered it: a late frame on a busy machine cannot let them through.
 */
async function holdPlates(page: Page) {
	await page.evaluate(() => {
		const hold = () => {
			for (const title of document.querySelectorAll('.hero-title'))
				for (const animation of title.getAnimations({ subtree: true })) animation.pause();
		};
		addEventListener('pointerdown', hold);
		addEventListener('keydown', hold);
	});
}

/** What shows of the name's two plates (first name, family name), `at` ms after the press when held. */
function plates(name: Locator, at?: number) {
	return name.evaluate((title, time) => {
		if (time !== undefined) for (const animation of title.getAnimations({ subtree: true })) animation.currentTime = time;
		const box = title.getBoundingClientRect();
		const pick = ({ left, width }: DOMRect) => ({ left, width });
		return ['::before', '::after'].map((pseudo, index) => {
			const style = getComputedStyle(title, pseudo);
			const slip = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
			const lineBox = title.querySelectorAll('.hero-line')[index];
			const letters = document.createRange();
			letters.selectNodeContents(lineBox.firstElementChild ?? lineBox);
			// The line's own top, its letters' left and width: on two lines, each box is as wide as the longer.
			const line = { top: lineBox.getBoundingClientRect().top, ...pick(letters.getBoundingClientRect()) };
			return {
				shown: style.opacity === '1',
				content: style.content,
				color: style.color,
				// In px; the font size makes it comparable from one window to the next.
				x: slip.m41 / Number.parseFloat(style.fontSize),
				y: slip.m42 / Number.parseFloat(style.fontSize),
				// How far the plate at rest lies from the line of the name it copies.
				offLine: Math.max(
					Math.abs(Number.parseFloat(style.left) - (line.left - box.left)),
					Math.abs(Number.parseFloat(style.top) - (line.top - box.top)),
					Math.abs(Number.parseFloat(style.width) - line.width),
				),
			};
		});
	}, at);
}

const shown = async (name: Locator) => (await plates(name)).map((plate) => plate.shown);

/** Lets the held plates run to their end. */
const letGo = (page: Page) =>
	page.evaluate(() => {
		for (const title of document.querySelectorAll('.hero-title'))
			for (const animation of title.getAnimations({ subtree: true })) animation.finish();
	});

async function pressWithPointer(page: Page) {
	const box = await write(page).boundingBox();
	if (!box) throw new Error('« Écrire » missing');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
}

test.describe('the name out of register', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('at rest, no plate shows', async ({ page }) => {
		await visitAt(page, '12:00');

		expect(await shown(dayName(page))).toEqual([false, false]);
	});

	test('a press on « Écrire » slips a plate of the name in the accent, which snaps back and is gone', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		const nameBox = await name.boundingBox();
		await holdPlates(page);

		await pressWithPointer(page);

		await expect.poll(() => shown(name)).toEqual([true, true]);
		const [first, family] = await plates(name, 0);
		expect(first.content).toContain('"Louis"');
		expect(family.content).toContain('"Pocheron"');
		for (const plate of [first, family]) {
			// The accent's display shade on the day's paper (ADR 0006).
			expect(plate.color).toBe('rgb(235, 82, 16)');
			expect(plate.offLine).toBeLessThan(0.5);
			expect(plate.x).toBeGreaterThan(0.03);
			expect(plate.y).toBeLessThan(-0.02);
		}
		// It stands off for a few frames, then comes back without passing its place.
		expect(await plates(name, SNAP * 0.5)).toEqual([first, family]);
		let previous = first;
		for (const time of [SNAP * 0.6, SNAP * 0.7, SNAP * 0.8, SNAP * 0.9]) {
			const [plate] = await plates(name, time);
			expect(plate.x).toBeGreaterThanOrEqual(0);
			expect(plate.x).toBeLessThan(previous.x);
			expect(plate.y).toBeLessThanOrEqual(0);
			expect(plate.y).toBeGreaterThan(previous.y);
			previous = plate;
		}
		// Nothing but the plate moves: the name keeps its box.
		expect(await name.boundingBox()).toEqual(nameBox);

		await page.mouse.up();
		await letGo(page);

		await expect.poll(() => shown(name)).toEqual([false, false]);
	});

	test('a second press slips the plate again', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		await holdPlates(page);

		for (const _ of [1, 2]) {
			await pressWithPointer(page);
			await expect.poll(() => shown(name)).toEqual([true, true]);
			await page.mouse.up();
			await letGo(page);
			await expect.poll(() => shown(name)).toEqual([false, false]);
		}
	});

	test('left alone, the plate is gone within a moment of the press', async ({ page }) => {
		await visitAt(page, '12:00');
		const seconds = page.evaluate(
			() =>
				new Promise<number>((resolve) => {
					document.addEventListener('animationend', (event) => {
						if (event.target instanceof Element && event.target.matches('.hero-title')) resolve(event.elapsedTime);
					});
				}),
		);

		await pressWithPointer(page);
		await page.mouse.up();

		expect(await seconds).toBeCloseTo(SNAP / 1000, 3);
		await expect.poll(() => shown(dayName(page))).toEqual([false, false]);
	});

	test('Enter on the focused link slips the plate, once however long the key is held', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		await holdPlates(page);
		// The press is the subject: the mail client stays shut.
		await page.evaluate(() => addEventListener('click', (event) => event.preventDefault()));
		await write(page).focus();

		await page.keyboard.down('Enter');

		await expect.poll(() => shown(name)).toEqual([true, true]);
		await letGo(page);
		await expect.poll(() => shown(name)).toEqual([false, false]);

		// The key repeats while held: the name does not stutter.
		await page.keyboard.down('Enter');
		await page.keyboard.up('Enter');
		// Two frames: a plate slipped again would have shown by then, and be held.
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
		expect(await shown(name)).toEqual([false, false]);
	});

	test('the press still opens the mail: the link is followed as before', async ({ page }) => {
		await visitAt(page, '12:00');
		await expect(write(page)).toHaveAttribute('href', /^mailto:/);
		// Read once every listener of the page has had the click, then stopped here: no mail client in a test.
		await page.evaluate(() => {
			addEventListener('click', (event) => {
				document.documentElement.dataset.testFollowed = String(!event.defaultPrevented);
				event.preventDefault();
			});
		});

		await write(page).click();
		await expect(page.locator('html')).toHaveAttribute('data-test-followed', 'true');

		await write(page).press('Enter');
		await expect(page.locator('html')).toHaveAttribute('data-test-followed', 'true');
	});

	test('the night’s copy of the name slips with the day’s, in the night’s accent', async ({ page }) => {
		// Half an hour after sunset the line crosses the hero: both drawings of the name show.
		await visitAt(page, '17:40');
		await holdPlates(page);

		await pressWithPointer(page);

		await expect.poll(() => shown(nightName(page))).toEqual([true, true]);
		const day = await plates(dayName(page), 0);
		const night = await plates(nightName(page), 0);
		expect(night.map(({ x, y, content, shown, offLine }) => ({ x, y, content, shown, offLine: offLine < 0.5 }))).toEqual(
			day.map(({ x, y, content, shown, offLine }) => ({ x, y, content, shown, offLine: offLine < 0.5 })),
		);
		for (const plate of night) expect(plate.color).toBe('rgb(255, 91, 20)');

		await page.mouse.up();
		await letGo(page);
		await expect.poll(() => shown(nightName(page))).toEqual([false, false]);
	});

	test('screen readers hear the name once', async ({ page }) => {
		await visitAt(page, '12:00');

		await expect(dayName(page)).toHaveAccessibleName('Louis Pocheron');
		await expect(dayName(page)).toHaveText('Louis Pocheron');
	});
});

test.describe('the name out of register, under a finger', () => {
	// The size of a phone, where the name stands on two lines.
	test.use({ reducedMotion: 'no-preference', viewport: devices['Pixel 7'].viewport, hasTouch: true });

	test('a tap on « Écrire » slips the plate of each line, and leaves nothing behind', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		await holdPlates(page);
		await page.evaluate(() => addEventListener('click', (event) => event.preventDefault()));

		await write(page).tap();

		await expect.poll(() => shown(name)).toEqual([true, true]);
		for (const plate of await plates(name, 0)) {
			expect(plate.offLine).toBeLessThan(0.5);
			expect(plate.x).toBeGreaterThan(0.03);
		}
		await letGo(page);
		await expect.poll(() => shown(name)).toEqual([false, false]);
	});
});

test.describe('the name out of register, under reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('the plate shows off the ink for the same moment and is gone in one step: nothing slides', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		await holdPlates(page);

		await pressWithPointer(page);

		await expect.poll(() => shown(name)).toEqual([true, true]);
		const pressed = await plates(name, 0);
		expect(pressed[0].x).toBeGreaterThan(0.03);
		for (const time of [SNAP * 0.6, SNAP * 0.8, SNAP - 1]) expect(await plates(name, time)).toEqual(pressed);

		await page.mouse.up();
		await letGo(page);
		await expect.poll(() => shown(name)).toEqual([false, false]);
	});

	test('the preference lifted during the visit, the plate eases back again', async ({ page }) => {
		await visitAt(page, '12:00');
		const name = dayName(page);
		await holdPlates(page);
		await page.emulateMedia({ reducedMotion: 'no-preference' });

		await pressWithPointer(page);

		await expect.poll(() => shown(name)).toEqual([true, true]);
		const [pressed] = await plates(name, 0);
		const [easing] = await plates(name, SNAP * 0.7);
		expect(easing.x).toBeGreaterThan(0);
		expect(easing.x).toBeLessThan(pressed.x);

		await page.mouse.up();
		await letGo(page);
		await expect.poll(() => shown(name)).toEqual([false, false]);
	});

	test('Enter answers too', async ({ page }) => {
		await visitAt(page, '12:00');
		await holdPlates(page);
		await page.evaluate(() => addEventListener('click', (event) => event.preventDefault()));
		await write(page).focus();

		await page.keyboard.press('Enter');

		await expect.poll(() => shown(dayName(page))).toEqual([true, true]);
	});
});
