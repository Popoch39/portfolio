import { expect, test, type Locator, type Page } from './fixtures';
import {
	content,
	header,
	scrollPosition,
	scrollWithWheel,
	topInPage,
	topOnceStill,
	verticalTranslation,
} from './helpers';
import {
	friseBand as band,
	friseLegend as legend,
	friseSection as section,
	headOnScreen,
	PIN_HEIGHTS,
	recordLayoutShifts,
	scrollToScene,
} from './frise-helpers';

/** Every commit of the career, oldest first: studies, jobs, then the current missions up to HEAD. */
const COMMITS_IN_ORDER = [
	/Baccalauréat/,
	/Langues étrangères appliquées/,
	/Développeur web/,
	/Jordel Média/,
	/CDOS/,
	/Concepteur & développeur d’applications/,
	/Da Viking Code/,
	/Cartographie énergie/,
	/Back-office santé/,
	/Terrain hors-ligne/,
	/Micro-services Rust/,
	/Monorepos & CI\/CD/,
	/HEAD.*aujourd’hui|aujourd’hui.*HEAD/,
];

// Without JavaScript and under reduced motion alike, the Frise stays at its final state.
const FINAL_STATE_CONTEXTS = [
	{ name: 'without JavaScript', use: { javaScriptEnabled: false } },
	{ name: 'reduced motion', use: { reducedMotion: 'reduce' as const } },
];

for (const { name, use } of FINAL_STATE_CONTEXTS) {
	test.describe(`Frise, final state, ${name}`, () => {
		test.use(use);

		test('every commit is listed, in chronological order', async ({ page }) => {
			await page.goto('/');

			await expect(band(page).getByRole('listitem')).toHaveText(COMMITS_IN_ORDER);
			for (const commit of await band(page).getByRole('listitem').all()) {
				await expect(commit).toBeVisible();
				await expect(commit).toHaveCSS('opacity', '1');
			}
		});

		test('the graph is fully built: every dot but the merges filled, every pole raised', async ({ page }) => {
			await page.goto('/');

			const fills = page.locator('[data-frise-fill]');
			await expect(fills).toHaveCount(await page.locator('.frise-graph circle:not([data-kind="merge"])').count());
			for (const fill of await fills.all()) await expect(fill).toHaveCSS('opacity', '1');
			for (const pole of await band(page).locator('.commit-pole').all()) await expect(pole).toHaveCSS('transform', 'none');
		});

		test('the section keeps its single heading, with the branches as its aside and the years of experience', async ({
			page,
		}) => {
			await page.goto('/');

			await expect(section(page).getByRole('heading')).toHaveCount(1);
			await expect(section(page).getByRole('heading', { level: 2, name: 'Parcours' })).toBeVisible();
			await expect(section(page).getByText('main ← lea, access-code, cda', { exact: true })).toBeVisible();
			await expect(section(page).getByText(/~\d+ ans d’expérience/)).toBeVisible();
		});

		test('focused, the strip scrolls horizontally with the keyboard', async ({ page }) => {
			await page.goto('/');
			const strip = band(page);
			await strip.scrollIntoViewIfNeeded();
			const scrollLeft = () => strip.evaluate((el) => el.scrollLeft);
			expect(await scrollLeft()).toBe(0);

			await strip.focus();
			await expect(strip).toBeFocused();
			for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');

			await expect.poll(scrollLeft).toBeGreaterThan(0);
		});

		test('the section scrolls with the page, without pinning nor an active commit legend', async ({ page }) => {
			await page.goto('/');
			await section(page).scrollIntoViewIfNeeded();
			const top = () => section(page).evaluate((el) => el.getBoundingClientRect().top);
			const before = await top();

			await page.evaluate(() => scrollBy(0, 300));

			await expect.poll(top).toBeCloseTo(before - 300, 0);
			await expect(page.locator('[data-frise-legend]')).toBeHidden();
		});

		test('assistive technologies get the list of commits, not the drawing', async ({ page }) => {
			await page.goto('/');

			// The strip holds the list and nothing else: the graph and the grid stay out of the tree.
			await expect(band(page)).toMatchAriaSnapshot(`
				- region "Frise du parcours":
				  - /children: equal
				  - list
			`);
			const first = band(page).getByRole('listitem').first();
			await expect(first.getByRole('time')).toHaveText('2018');
			await expect(first).toContainText('Baccalauréat économique et social');
			await expect(first).toContainText('Lycée Carnot, Dijon');
			await expect(first).toContainText('main');
		});

		test('the older jobs give their role and missions in the list, beyond their compact label', async ({ page }) => {
			await page.goto('/');
			const commits = band(page).getByRole('listitem');

			const cdos = commits.filter({ hasText: 'CDOS' });
			await expect(cdos).toContainText('Concepteur & développeur d’applications');
			await expect(cdos).toContainText('Application web sous Symfony');
			await expect(cdos).toContainText('API back-end en Node.js / TypeScript (Express)');

			const internship = commits.filter({ hasText: 'Jordel Média' });
			await expect(internship).toContainText('Stage — développeur web');
			await expect(internship).toContainText('Nouvelles fonctionnalités sur le CMS interne de l’entreprise');
		});

		test('Tab stops on the strip, then goes on to the Stack', async ({ page }) => {
			await page.goto('/');
			await linkBeforeFrise(page).focus();

			await page.keyboard.press('Tab');
			await expect(band(page)).toBeFocused();
			await page.keyboard.press('Tab');
			await expect(stackLink(page)).toBeFocused();
		});
	});
}

/** The last link ahead of the Frise: the hero's, the marquee between them being hidden. */
const linkBeforeFrise = (page: Page) => page.locator('.hero').getByRole('link').last();
const stackLink = (page: Page) => page.locator('#stack').getByRole('link');

/** Where the HEAD commit stands on screen once the smoothing has settled: a reading taken mid-glide would leave HEAD still moving forward. */
function headOnceStill(page: Page): Promise<number> {
	return band(page)
		.getByRole('listitem')
		.last()
		.evaluate(
			(el) =>
				new Promise<number>((resolve) => {
					let previous = Number.NaN;
					let stillFrames = 0;
					const measure = () => {
						const { x } = el.getBoundingClientRect();
						stillFrames = Math.abs(x - previous) < 0.5 ? stillFrames + 1 : 0;
						previous = x;
						if (stillFrames >= 10) resolve(x);
						else requestAnimationFrame(measure);
					};
					requestAnimationFrame(measure);
				}),
		);
}

const opacity = (element: Locator) => element.evaluate((el) => Number(getComputedStyle(el).opacity));

/**
 * The scene's floor for past labels: their muted lines (#b3b1a9) keep about 7:1 on the aplat (#1c1b19), above AA's 4.5:1.
 */
const AA_FLOOR = 0.93;

/**
 * Height of a commit's pole against its card: both stand in the same upright label, so the
 * perspective scales them alike and the ratio only tells how far the pole has risen.
 */
async function poleRatio(commit: Locator) {
	return commit.evaluate((el) => {
		const pole = el.querySelector('.commit-pole')?.getBoundingClientRect().height ?? 0;
		const card = el.querySelector('.commit-card')?.getBoundingClientRect().height ?? 1;
		return pole / card;
	});
}

test.describe('Frise, scene', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the section stays pinned for 400svh, then the page scrolls on', async ({ page }) => {
		await page.goto('/');
		const start = await topInPage(section(page));

		for (const progress of [0, 0.5, 0.95]) {
			await scrollToScene(page, start, progress);
			expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		}

		await page.evaluate(([top, heights]) => scrollTo(0, top + heights * innerHeight + 300), [start, PIN_HEIGHTS]);
		await expect.poll(() => topOnceStill(section(page))).toBeCloseTo(-300, -1);
	});

	test('HEAD moves forward with the wheel and back when scrolling up: the graph slides under the camera', async ({
		page,
	}) => {
		await page.goto('/');
		await scrollToScene(page, await topInPage(section(page)), 0.1);
		const before = await headOnScreen(page);

		await scrollWithWheel(page, 600);
		await expect.poll(() => headOnScreen(page)).toBeLessThan(before - 50);
		const forward = await headOnceStill(page);

		await scrollWithWheel(page, -300);
		await expect.poll(() => headOnScreen(page)).toBeGreaterThan(forward + 25);
	});

	test('HEAD moves forward and back with the keyboard scrolling keys', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await topInPage(section(page)), 0.1);
		const before = await headOnScreen(page);

		await page.keyboard.press('PageDown');
		await expect.poll(() => headOnScreen(page)).toBeLessThan(before - 50);
		const forward = await headOnceStill(page);

		await page.keyboard.press('PageUp');
		await expect.poll(() => headOnScreen(page)).toBeGreaterThan(forward + 25);
	});

	test('the legend names the active commit: the diploma at the start, the CDA halfway, HEAD at the end', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await topInPage(section(page));
		await expect(legend(page)).toHaveAttribute('aria-hidden', 'true');

		await scrollToScene(page, start, 0);
		await expect(legend(page)).toBeVisible();
		await expect(legend(page)).toContainText('2018 · main');
		await expect(legend(page)).toContainText('Baccalauréat économique et social');
		await expect(legend(page)).toContainText('Lycée Carnot, Dijon');

		// Halfway between the diploma (2018) and today: in 2022, during the CDA training.
		await scrollToScene(page, start, 0.5);
		await expect(legend(page)).toContainText('2022 → 2023 · cda');
		await expect(legend(page)).toContainText('Concepteur & développeur d’applications');
		await expect(legend(page)).toContainText('Access Code School, Besançon');

		await scrollToScene(page, start, 1);
		await expect(legend(page)).toContainText('aujourd’hui · main');
		await expect(legend(page)).toContainText('HEAD');
	});

	test('the legend shifts no layout when the active commit changes, however its lines wrap', async ({
		page,
		browserName,
	}) => {
		test.skip(browserName === 'firefox', 'Firefox does not implement the Layout Instability API');
		await page.goto('/');
		const start = await topInPage(section(page));
		await scrollToScene(page, start, 0);
		const shifts = await recordLayoutShifts(page);

		for (const progress of [0.25, 0.5, 0.75, 1]) await scrollToScene(page, start, progress);
		await expect(legend(page)).toContainText('HEAD');

		const recorded = await shifts();
		expect(recorded.filter(({ sources }) => sources.some(({ inLegend }) => inLegend))).toEqual([]);
	});

	test('the legend text only changes when HEAD reaches another commit, never on every frame', async ({ page }) => {
		await page.goto('/');
		const start = await topInPage(section(page));
		await scrollToScene(page, start, 0);
		// The count lands in an attribute, which the observer does not watch.
		await legend(page).evaluate((el) => {
			el.dataset.testChanges = '0';
			new MutationObserver((records) => {
				el.dataset.testChanges = String(Number(el.dataset.testChanges) + records.length);
			}).observe(el, { subtree: true, childList: true, characterData: true });
		});

		// The smoothing eases this jump over about a second: dozens of frames.
		await scrollToScene(page, start, 1);
		await expect(legend(page)).toContainText('HEAD');

		// Twelve commits after the diploma, three lines each.
		const changes = Number(await legend(page).getAttribute('data-test-changes'));
		expect(changes).toBeGreaterThan(0);
		expect(changes).toBeLessThanOrEqual(12 * 3);
	});

	test('the commit HEAD has reached stands raised and lit, those ahead stay low and discreet, those behind dim but stay readable', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await topInPage(section(page));
		const commits = band(page).getByRole('listitem');
		const diploma = commits.first();
		const head = commits.last();

		await scrollToScene(page, start, 0);
		await expect(diploma).toHaveCSS('opacity', '1');
		await expect.poll(() => opacity(head)).toBeLessThan(0.5);
		const lowered = await poleRatio(head);
		expect(await poleRatio(diploma)).toBeGreaterThan(2 * lowered);

		await scrollToScene(page, start, 1);
		await expect(head).toHaveCSS('opacity', '1');
		expect(await poleRatio(head)).toBeGreaterThan(2 * lowered);
		await expect.poll(() => opacity(diploma)).toBeLessThan(1);
		expect(await opacity(diploma)).toBeGreaterThanOrEqual(AA_FLOOR);
	});

	test('a commit far ahead stays discreet but never invisible', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await topInPage(section(page)), 0);
		const commits = band(page).getByRole('listitem');
		const active = await opacity(commits.first());

		// Several commits ahead of HEAD, far from lighting up.
		const ahead = await opacity(commits.nth(3));
		expect(ahead).toBeGreaterThan(0);
		expect(ahead).toBeLessThan(active);
	});

	test('the strip is no tab stop while the scene runs: Tab goes on to the Stack', async ({ page }) => {
		await page.goto('/');
		await linkBeforeFrise(page).focus();

		await page.keyboard.press('Tab');
		await expect(stackLink(page)).toBeFocused();
	});

	test('a dot fills once HEAD reaches it, a merge stays hollow', async ({ page }) => {
		await page.goto('/');
		const start = await topInPage(section(page));
		const fills = page.locator('[data-frise-fill]');
		// One filled dot over every hollow one, merges aside.
		await expect(fills).toHaveCount(await page.locator('.frise-graph circle:not([data-kind="merge"])').count());

		await scrollToScene(page, start, 0);
		await expect(fills.first()).toHaveCSS('opacity', '1');
		await expect(fills.last()).toHaveCSS('opacity', '0');

		await scrollToScene(page, start, 1);
		await expect(fills.last()).toHaveCSS('opacity', '1');
	});

	test('the grid is a layer the size of the frame, not of the graph', async ({ page }) => {
		await page.goto('/');
		await scrollToScene(page, await topInPage(section(page)), 0.5);

		const { grid, frame } = await page.locator('.frise-grid').evaluate((el) => ({
			grid: (el as HTMLElement).offsetWidth,
			frame: el.closest('[data-frise-band]')?.clientWidth ?? 0,
		}));
		expect(grid).toBeLessThanOrEqual(2.1 * frame);
	});

	test('at the end, the page scrolls on to the Stack without a jump', async ({ page }) => {
		await page.goto('/');
		const start = await topInPage(section(page));
		await scrollToScene(page, start, 1);
		const end = await scrollPosition(page);

		for (const extra of [100, 200, 300]) {
			await page.evaluate((y) => scrollTo(0, y), end + extra);
			await expect.poll(() => topOnceStill(section(page))).toBeCloseTo(-extra, -1);
		}
		await page.evaluate((y) => scrollTo(0, y + innerHeight), end);
		await expect(page.getByRole('heading', { name: 'Stack' })).toBeInViewport();
	});

	test('flipping the preference during the visit switches between the scene and the final state', async ({
		page,
	}) => {
		await page.goto('/');
		await scrollToScene(page, await topInPage(section(page)), 0.5);
		await expect(legend(page)).toBeVisible();

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(legend(page)).toBeHidden();
		await expect.poll(() => verticalTranslation(content(page))).toBe(0);
		await band(page).focus();
		for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
		await expect.poll(() => band(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(legend(page)).toBeVisible();
		await expect.poll(() => band(page).evaluate((el) => el.scrollLeft)).toBe(0);
		await scrollToScene(page, await topInPage(section(page)), 0.5);
		expect(Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		await expect(legend(page)).toContainText('Concepteur & développeur d’applications');
	});

	test('the /#parcours link leads to the start of the Frise', async ({ page }) => {
		await page.goto('/');

		await header(page).getByRole('link', { name: 'Parcours' }).click();

		await expect.poll(async () => Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		await expect(legend(page)).toContainText('Baccalauréat économique et social');
	});

	test('the page loaded with /#parcours opens on the start of the Frise', async ({ page }) => {
		await page.goto('/#parcours');

		await expect.poll(async () => Math.abs(await topOnceStill(section(page)))).toBeLessThanOrEqual(1);
		await expect(legend(page)).toContainText('Baccalauréat économique et social');
	});
});

test.describe('Frise data elsewhere on the page', () => {
	test.use({ javaScriptEnabled: false });

	test('the JSON-LD still names the current job and every school', async ({ page }) => {
		await page.goto('/');

		const person = await page
			.locator('script[type="application/ld+json"]')
			.evaluate((script) => JSON.parse(script.textContent ?? '').mainEntity);
		expect(person.worksFor).toMatchObject({ name: 'Da Viking Code', address: { addressLocality: 'Dijon' } });
		expect(person.alumniOf.map((school: { name: string }) => school.name)).toEqual([
			'Access Code School',
			'UFR SLHS',
			'Lycée Carnot',
		]);
	});
});
