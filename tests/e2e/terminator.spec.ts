import { test as direct } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { paper as option, pickPaper } from './nuancier-helpers';

/**
 * The Terminateur: the night falls on the hero along the line where the sun sets at Besançon, and the
 * whole site follows the sun. The Nuancier forces the day or the night at any hour.
 * On 9 November 2026 the sun rises at about 07:30 and sets at about 17:10, Paris time.
 */

const at = (time: string) => new Date(`2026-11-09T${time}:00+01:00`);

const root = (page: Page) => page.locator('html');
const night = (page: Page) => page.locator('.sky-night');

async function visitAt(page: Page, time: string) {
	await page.clock.setFixedTime(at(time));
	await page.goto('/');
}

test.describe('the Terminateur', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	test('at noon, the site is in daylight and the hero has no night', async ({ page }) => {
		await visitAt(page, '12:00');

		await expect(root(page)).toHaveAttribute('data-theme', 'light');
		await expect(root(page)).toHaveAttribute('data-sky', 'day');
		await expect(night(page)).toBeHidden();
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(239, 238, 233)');
	});

	test('at night, the whole site is dark and the night covers the hero', async ({ page }) => {
		await visitAt(page, '23:00');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 20, 18)');
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141412');
	});

	test('half an hour after sunset, the line crosses the hero and the site has gone dark', async ({ page }) => {
		await visitAt(page, '17:40');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'dusk');
		await expect(night(page)).toBeVisible();
		// The line stands inside the map: west of the marker, the sun is still up.
		const box = await page.locator('.hero-map').boundingBox();
		const line = await page.locator('.sky').boundingBox();
		expect(line && box && line.x > box.x && line.x < box.x + box.width).toBe(true);
	});

	test('the statusline gives the day’s sunrise and sunset at Besançon', async ({ page }) => {
		await visitAt(page, '12:00');

		const times = await page
			.locator('#statusline [data-sun]')
			.evaluateAll((spans) => spans.map((span) => getComputedStyle(span, '::after').content));
		expect(times).toEqual([expect.stringMatching(/^"07:[23]\d"$/), expect.stringMatching(/^"17:[01]\d"$/)]);
	});

	test('the night copy of the hero is out of reach of the keyboard and of screen readers', async ({ page }) => {
		await visitAt(page, '23:00');

		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('link', { name: /^Écrire/ })).toHaveCount(1);
		await expect(page.locator('.sky')).toHaveAttribute('inert', '');
	});

	test('the night’s paper brings the night at noon, the day’s the day at night, `auto` the sun back', async ({
		page,
	}) => {
		await visitAt(page, '12:00');
		await expect(option(page, 'auto')).toBeChecked();

		await pickPaper(page, 'dark');
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');

		await page.clock.setFixedTime(at('23:00'));
		await pickPaper(page, 'light');
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
		await expect(root(page)).toHaveAttribute('data-sky', 'day');

		await pickPaper(page, 'auto');
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
	});

	test('the choice is remembered from one visit to the next, from the first paint', async ({ page }) => {
		await visitAt(page, '12:00');
		await pickPaper(page, 'dark');

		await page.goto('/');
		await expect(option(page, 'dark')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');

		await pickPaper(page, 'auto');
		await page.goto('/');
		await expect(option(page, 'auto')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'light');
	});

	test('is reached with the keyboard: the arrows move from one choice to the next', async ({ page }) => {
		await visitAt(page, '12:00');
		await option(page, 'auto').focus();

		await page.keyboard.press('ArrowRight');
		await expect(option(page, 'light')).toBeChecked();
		await page.keyboard.press('ArrowRight');
		await expect(option(page, 'dark')).toBeChecked();
		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
	});

	test('the night slides in on a transform alone, and the copy stays put under it', async ({ page }) => {
		await visitAt(page, '12:00');
		await pickPaper(page, 'dark');

		const transitioned = await page.locator('.sky, .sky-sheet').evaluateAll((elements) =>
			elements.map((element) => getComputedStyle(element).transitionProperty),
		);
		expect(transitioned).toEqual(['translate', 'translate']);
		// Once still, the copy lies exactly over the map.
		await expect
			.poll(async () => {
				const map = await page.locator('.hero-map').evaluate((el) => el.getBoundingClientRect().left);
				const copy = await page.locator('.sky-sheet').evaluate((el) => el.getBoundingClientRect().left);
				return Math.abs(copy - map - 1);
			})
			.toBeLessThan(0.5);
	});

	test('the page’s own night follows the next sunset without a reload', async ({ page }) => {
		await visitAt(page, '17:05');
		await expect(root(page)).toHaveAttribute('data-theme', 'light');

		await page.clock.setFixedTime(at('17:30'));
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
	});

	test('at solar noon the night changes sides at once, never sweeping across the day', async ({ page }) => {
		await visitAt(page, '12:10');
		await expect(root(page)).toHaveAttribute('data-sky-half', 'morning');

		await page.clock.setFixedTime(at('12:40'));
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

		await expect(root(page)).toHaveAttribute('data-sky-half', 'evening');
		expect(await page.locator('.sky').evaluate((el) => el.getAnimations().length)).toBe(0);
		await expect(page.locator('.sky-sliver')).toBeHidden();
	});

	test('the night’s label keeps to the middle of the map in full night, and says so under `dark`', async ({
		page,
	}) => {
		const label = page.locator('.sky-label[data-label="4"]');
		const centreInMap = () =>
			page.evaluate(() => {
				const map = document.querySelector('.hero-map')!.getBoundingClientRect();
				const box = document.querySelector('.sky-label[data-label="4"]')!.getBoundingClientRect();
				return (box.left + box.width / 2 - map.left) / map.width;
			});
		await visitAt(page, '23:00');
		await expect(label).toHaveCSS('opacity', '1');
		expect(await centreInMap()).toBeCloseTo(0.5, 1);

		await page.clock.setFixedTime(at('12:00'));
		await pickPaper(page, 'dark');
		await expect.poll(() => label.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"nuit · papier EN-02"');
		await expect(label).toHaveCSS('opacity', '1');
		await expect.poll(centreInMap).toBeCloseTo(0.5, 1);
	});

	test('still works for the visit when the browser blocks storage', async ({ page }) => {
		const errors: Error[] = [];
		page.on('pageerror', (error) => errors.push(error));
		await page.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new DOMException('The operation is insecure.', 'SecurityError');
				},
			});
		});
		await visitAt(page, '12:00');

		await pickPaper(page, 'dark');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		expect(errors).toEqual([]);
	});

	test('reaches the other pages: the 404 follows the sun too', async ({ page }) => {
		await page.clock.setFixedTime(at('23:00'));
		await page.goto('/nowhere');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(option(page, 'auto')).toBeChecked();
	});
});

test.describe('the Terminateur, motion reduced', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

	test('switches at once, without sliding', async ({ page }) => {
		await visitAt(page, '12:00');

		await pickPaper(page, 'dark');

		await expect(root(page)).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('.sky')).toHaveCSS('transition-duration', '0s');
	});
});

// On a phone the lede's keys stand above the scale bar's row, where the night's label hangs on a wider map.
for (const width of [320, 375, 430, 600]) {
	test.describe(`the Terminateur on a ${width}px phone`, () => {
		// Motion reduced: the lede types nothing, and the keys are laid down by hand, as many as a phone shows.
		test.use({ reducedMotion: 'reduce', viewport: { width, height: 700 } });

		for (const [name, time, bg] of [
			['in full night', '23:00', 'auto'],
			['on the night’s paper', '12:00', 'dark'],
		] as const) {
			test(`${name}, the night’s label stands clear of the lede’s keys and of the scale bar`, async ({ page }) => {
				await visitAt(page, time);
				await pickPaper(page, bg);
				await page.locator('.hero-map > .hero-south [data-keys]').evaluate((keys: HTMLElement) => {
					keys.append(...Array.from({ length: 5 }, () => Object.assign(document.createElement('kbd'), { textContent: 'w' })));
					keys.dataset.on = 'true';
				});
				const label = page.locator('.sky-label[data-label="4"]');
				await expect(label).toHaveCSS('opacity', '1');

				const boxes = await page.evaluate(() => {
					const box = (selector: string) =>
						[...document.querySelectorAll(selector)].map((element) => {
							const { left, right, top, bottom } = element.getBoundingClientRect();
							return { left, right, top, bottom };
						});
					return {
						map: box('.hero-map')[0],
						label: box('.sky-label[data-label="4"]')[0],
						others: box('.hero-map > .hero-south [data-keys] kbd, .hero-map > .hero-scale'),
					};
				});
				expect(boxes.others).toHaveLength(6);
				expect(boxes.label.left).toBeGreaterThanOrEqual(boxes.map.left);
				expect(boxes.label.right).toBeLessThanOrEqual(boxes.map.right);
				for (const other of boxes.others) {
					const apart =
						boxes.label.right <= other.left ||
						other.right <= boxes.label.left ||
						boxes.label.bottom <= other.top ||
						other.bottom <= boxes.label.top;
					expect(apart, JSON.stringify({ label: boxes.label, other })).toBe(true);
				}
			});
		}
	});
}

test.describe('the Terminateur, without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('leaves the site in daylight, with no night and no switch', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.sky')).toBeHidden();
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(239, 238, 233)');
		await expect(page.getByRole('radio')).toHaveCount(0);
	});
});

direct.describe('the Terminateur after the Intro', () => {
	direct.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

	direct('holds the night off the hero while the Intro plays, then lets it fall', async ({ page }) => {
		// Time flows from 23:00: the Intro's own clock must run.
		await page.clock.install({ time: at('23:00') });
		await page.goto('/');
		await expect(root(page)).toHaveClass(/\bintro\b/);
		await expect(root(page)).toHaveAttribute('data-sky', 'night');
		const held = await page.locator('.sky').evaluate((el) => el.getBoundingClientRect().left);
		const map = await page.locator('.hero-map').evaluate((el) => el.getBoundingClientRect().right);
		expect(held).toBeGreaterThanOrEqual(map);

		// A click passes the Intro: the same end as its last frame.
		await page.mouse.click(10, 10);
		await expect(root(page)).not.toHaveClass(/\bintro\b/);
		await expect
			.poll(() => page.locator('.sky').evaluate((el) => el.getBoundingClientRect().left), { timeout: 5_000 })
			.toBeLessThan(0);
	});
});
