import { heard, key, leftOn, listen, playedAt, sound, topOf, travel } from './etabli-sound-helpers';
import { expect, test, type Page } from './fixtures';

/** The Son of the Établi (ADR 0013): off until the visitor turns it on, remembered from one visit to the next. */

test.describe('the Son', () => {
	test('is off on a first visit, and nothing of it is loaded', async ({ page }) => {
		const audio: string[] = [];
		page.on('request', (request) => {
			if (request.resourceType() === 'media' || /\.(wav|mp3)$/.test(request.url())) audio.push(request.url());
		});
		await listen(page);
		await page.goto('/');

		await expect(sound(page)).toHaveAttribute('aria-pressed', 'false');
		await expect(sound(page)).toContainText('coupé');
		await page.waitForLoadState('networkidle');
		expect(audio).toEqual([]);
		expect(await heard(page)).toBe(0);
	});

	test('turned on, it loads the sound, and says so', async ({ page }) => {
		await page.goto('/');
		const loaded = page.waitForRequest(/\.mp3$/);

		await sound(page).click();

		await loaded;
		await expect(sound(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(sound(page)).toContainText('allumé');
	});

	test('the choice is remembered on the next visit', async ({ page }) => {
		await page.goto('/');
		await sound(page).click();
		await expect(sound(page)).toHaveAttribute('aria-pressed', 'true');

		await page.reload();
		await expect(sound(page)).toHaveAttribute('aria-pressed', 'true');

		await sound(page).click();
		await page.reload();
		await expect(sound(page)).toHaveAttribute('aria-pressed', 'false');
	});

	test('stays offered under reduced motion, where « Rejouer » is not', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');

		await expect(sound(page)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Rejouer' })).toBeHidden();
	});
});

/** Turns the Son on and waits for the press that says the board now sounds. */
async function turnOn(page: Page) {
	await sound(page).click();
	await expect.poll(() => heard(page)).toBe(1);
}

test.describe('the Frappe, with a mouse', () => {
	test('a key bottoms out while pressed, and comes back up', async ({ page }) => {
		await page.goto('/');
		const cap = key(page, 20);
		const top = await topOf(cap);

		await page.mouse.move(top.x, top.y);
		await expect.poll(() => travel(cap)).toBeCloseTo(2.5, 1);
		await page.mouse.down();
		await expect.poll(() => travel(cap)).toBeCloseTo(5, 1);
		await page.mouse.up();
		await expect.poll(() => travel(cap)).toBeCloseTo(2.5, 1);
		await page.mouse.move(0, 0);
		await expect.poll(() => travel(cap)).toBe(0);
	});

	test('the Son off, nothing is heard', async ({ page }) => {
		await listen(page);
		await page.goto('/');
		const top = await topOf(key(page, 20));

		await page.mouse.click(top.x, top.y);

		await expect.poll(() => travel(key(page, 20))).toBeCloseTo(2.5, 1);
		expect(await heard(page)).toBe(0);
	});

	test('the Son on, a whole stroke is heard as the key goes down, and nothing more as it comes up', async ({ page }) => {
		await listen(page);
		await page.goto('/');
		await turnOn(page);
		const top = await topOf(key(page, 20));
		await page.mouse.move(top.x, top.y);
		const before = await heard(page);

		await page.mouse.down();
		await expect.poll(() => heard(page)).toBe(before + 1);
		await page.mouse.up();
		await expect.poll(() => travel(key(page, 20))).toBeCloseTo(2.5, 1);
		expect(await heard(page)).toBe(before + 1);
	});

	test('a sweep across the board brushes the keys, one every 40 ms at most', async ({ page }) => {
		await listen(page);
		await page.goto('/');
		await turnOn(page);
		const from = await topOf(key(page, 14));
		const to = await topOf(key(page, 27));

		await page.mouse.move(from.x - 30, from.y);
		await page.mouse.move(to.x + 30, to.y, { steps: 40 });

		const times = (await playedAt(page)).slice(1);
		expect(times.length).toBeGreaterThan(1);
		const gaps = times.slice(1).map((time, i) => time - times[i]);
		// Counted when each sound starts, a little after its stroke was let through: a few ms of slack on a busy
		// machine. Unbridled, the strokes come every 15 to 20 ms.
		expect(Math.min(...gaps)).toBeGreaterThanOrEqual(35);
	});

	test('« Rejouer » with the Son on: every cap is heard as it clips onto its switch', async ({ page }) => {
		await listen(page);
		await page.goto('/');
		await turnOn(page);

		await page.getByRole('button', { name: 'Rejouer' }).click();

		await expect.poll(() => heard(page), { timeout: 10_000 }).toBe(1 + 61);
	});

	test('« Rejouer » pressed again mid-way: the caps are heard again as they clip', async ({ page }) => {
		await listen(page);
		await page.goto('/');
		await turnOn(page);
		const replay = page.getByRole('button', { name: 'Rejouer' });

		await replay.click();
		await expect.poll(() => heard(page), { timeout: 10_000 }).toBeGreaterThan(1 + 10);
		// Counted in the press's own task: the clips of the first run stop there.
		const before = await replay.evaluate((button: HTMLElement) => {
			const count = (window as unknown as { played: number[] }).played.length;
			button.click();
			return count;
		});

		await expect.poll(() => heard(page), { timeout: 10_000 }).toBe(before + 61);
	});
});

test.describe('the Son left on at the last visit', () => {
	test.beforeEach(async ({ page }) => {
		await leftOn(page);
		await listen(page);
	});

	test('the sound comes once the page has settled, and the first press is heard', async ({ page }) => {
		await page.goto('/');
		// Every stroke decoded: the press below must not race the last of them.
		await page.waitForLoadState('networkidle');
		const top = await topOf(key(page, 20));
		await page.mouse.move(top.x, top.y);
		const before = await heard(page);

		await page.mouse.down();

		await expect.poll(() => heard(page)).toBe(before + 1);
	});

	test('the first « Rejouer » is heard whole', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('button', { name: 'Rejouer' }).click();

		await expect.poll(() => heard(page), { timeout: 10_000 }).toBe(61);
	});
});
