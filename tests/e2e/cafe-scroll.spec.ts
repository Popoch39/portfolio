import { expect, test, type Page } from './fixtures';
import { content, statusline, topOnceStill } from './helpers';
import { cafeCounter as counter, PIN_HEIGHTS, sceneStart, scrollToScene, cafeSection as section } from './montage-helpers';

const coffee = (page: Page) => section(page).getByRole('button', { name: 'Proposer un café', exact: true });
const form = (page: Page) => section(page).getByRole('form');
const name = (page: Page) => form(page).getByRole('textbox', { name: 'Nom', exact: true });
const message = (page: Page) => form(page).getByRole('textbox', { name: 'Message', exact: true });
const mode = (page: Page) => statusline(page).locator('.mode:visible').first();
const contactLink = (page: Page) =>
	page.locator('#contact').getByRole('link', { name: 'proposer un café', exact: true });

const CAFE_TITLE = 'Un café, à Besançon.';

/** Scroll position, in the page, where the Café's pinning lets go. */
const pinningEnd = async (page: Page, start: number) =>
	start + PIN_HEIGHTS * (await page.evaluate(() => innerHeight));

/** The page's own scroll offset as the visitor sees it: the smoothed content's, or the window's. */
const shownScroll = (page: Page) => content(page).evaluate((el) => -el.getBoundingClientRect().top);

/**
 * Records, frame by frame, how far the page has moved since the previous frame, from its first move until it has
 * stood still a while.
 */
const recordSteps = (page: Page) =>
	content(page).evaluate(
		(el) =>
			new Promise<number[]>((resolve) => {
				const steps: number[] = [];
				let previous = el.getBoundingClientRect().top;
				let still = 0;
				const measure = () => {
					const top = el.getBoundingClientRect().top;
					const step = Math.abs(top - previous);
					if (step >= 0.5 || steps.length > 0) steps.push(step);
					still = step < 0.5 ? still + 1 : 0;
					previous = top;
					// Never moving at all ends the recording too, empty, a few seconds on.
					if ((still >= 20 && steps.length > 0) || still >= 300) resolve(steps);
					else requestAnimationFrame(measure);
				};
				requestAnimationFrame(measure);
			}),
	);

/**
 * Into the middle of the scene, until it is built and plays: the visitor comes through it. Returns where it starts.
 */
async function throughScene(page: Page) {
	await page.goto('/');
	const start = await sceneStart(page);
	await scrollToScene(page, start, 0.5);
	await expect(counter(page)).not.toHaveText('6/6 · sur le feu');
	return start;
}

/** Down to the Contact, at the foot of the page, and still. */
async function scrollToContact(page: Page) {
	await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight - innerHeight));
	await topOnceStill(content(page));
	await expect(contactLink(page)).toBeInViewport();
}

/** Stacked, the actions follow the pinned screen: past its end, until they stand above the statusline. */
async function reachStackedActions(page: Page, start: number) {
	await scrollToScene(page, start, 1);
	const below = await coffee(page).evaluate((el) => el.getBoundingClientRect().bottom - (innerHeight - 60));
	if (below > 0) {
		await page.evaluate((by) => scrollBy(0, by), below);
		await topOnceStill(content(page));
	}
	await expect(coffee(page)).toBeInViewport();
}

/**
 * From the keyboard: a pointer has Playwright scroll the fixed wrapper under it, which the smoother puts back, and
 * the click can land on the pinned screen over the actions.
 */
async function openFromKeyboard(page: Page) {
	await coffee(page).focus();
	await page.keyboard.press('Enter');
}

/** Counts the CSS transitions that start in the Café from now on. */
const countTransitions = (page: Page) =>
	section(page).evaluate((el) => {
		const recorded = { count: 0 };
		el.addEventListener('transitionrun', () => (recorded.count += 1));
		(window as unknown as { testCafeTransitions: typeof recorded }).testCafeTransitions = recorded;
	});
const transitionsSince = (page: Page) =>
	page.evaluate(() => (window as unknown as { testCafeTransitions: { count: number } }).testCafeTransitions.count);

test.describe('Formulaire du Café and the scroll', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

	test('opening from the Café brings the page smoothly to the end of the pinning', async ({ page }) => {
		const start = await throughScene(page);
		await scrollToScene(page, start, 0.88);
		const from = await shownScroll(page);
		const end = await pinningEnd(page, start);

		const steps = recordSteps(page);
		await coffee(page).click();
		const moves = await steps;

		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);
		expect(await shownScroll(page)).toBeCloseTo(end, 0);
		// Smoothly: no frame covers more than a fifth of the way.
		expect(Math.max(...moves)).toBeLessThan((end - from) / 5);
		await expect(name(page)).toBeFocused();
		await expect(name(page)).toBeInViewport();

		// The page still follows the scroll it is given afterwards.
		await scrollToScene(page, start, 0.6);
		await expect(form(page)).toBeHidden();
	});

	test('scrolling back under the actions closes the form at once and keeps what was typed', async ({ page }) => {
		const start = await throughScene(page);
		await scrollToScene(page, start, 1);
		await coffee(page).click();
		await expect(name(page)).toBeFocused();
		await name(page).fill('Ada Lovelace');
		await message(page).fill('Une carte des moulins du Doubs.');
		await countTransitions(page);

		await scrollToScene(page, start, 0.6);

		await expect(form(page)).toBeHidden();
		expect(await transitionsSince(page)).toBe(0);
		await expect(mode(page)).toHaveText('NORMAL');
		// The scene plays again: the counter names the piece being put back.
		await expect(counter(page)).not.toHaveText('6/6 · sur le feu');

		await scrollToScene(page, start, 1);
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
		await coffee(page).click();
		await expect(name(page)).toHaveValue('Ada Lovelace');
		await expect(message(page)).toHaveValue('Une carte des moulins du Doubs.');
	});

	test('scrolling on down past the Café leaves the form open', async ({ page }) => {
		const start = await throughScene(page);
		await scrollToScene(page, start, 1);
		await coffee(page).click();
		await expect(name(page)).toBeFocused();
		await name(page).fill('Ada Lovelace');

		await scrollToContact(page);
		await expect(mode(page)).toHaveText('INSERT');

		await scrollToScene(page, start, 1);
		await expect(form(page)).toBeVisible();
		await expect(name(page)).toHaveValue('Ada Lovelace');
	});

	test('« proposer un café » in the Contact goes back to the end of the pinning, then opens the form in café mode', async ({
		page,
	}) => {
		const start = await throughScene(page);
		const end = await pinningEnd(page, start);
		await scrollToContact(page);
		await contactLink(page).focus();
		await topOnceStill(content(page));
		const from = await shownScroll(page);

		// From the keyboard: a pointer pressed at the foot of the smoothed page has Playwright scroll the fixed wrapper
		// under it, which the smoother puts back between the press and the release.
		const steps = recordSteps(page);
		await page.keyboard.press('Enter');
		const moves = await steps;

		expect(await shownScroll(page)).toBeCloseTo(end, 0);
		expect(Math.max(...moves)).toBeLessThan((from - end) / 5);
		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);
		await expect(name(page)).toBeFocused();
		await expect(name(page)).toBeInViewport();
		await expect(mode(page)).toHaveText('INSERT');

		await scrollToScene(page, start, 0.6);
		await expect(form(page)).toBeHidden();
	});
});

test.describe('Formulaire du Café and the scroll, stacked', () => {
	test.use({ reducedMotion: 'no-preference', viewport: { width: 412, height: 915 } });

	test('opened past the pinned screen, scrolling straight back under the actions closes it at once and keeps what was typed', async ({
		page,
	}) => {
		await page.goto('/');
		const start = await sceneStart(page);
		await reachStackedActions(page, start);
		await openFromKeyboard(page);
		await expect(name(page)).toBeFocused();
		await name(page).fill('Ada Lovelace');
		await countTransitions(page);

		await scrollToScene(page, start, 0.6);

		await expect(form(page)).toBeHidden();
		expect(await transitionsSince(page)).toBe(0);
		await expect(mode(page)).toHaveText('NORMAL');

		await reachStackedActions(page, start);
		await expect(counter(page)).toHaveText('6/6 · sur le feu');
		await openFromKeyboard(page);
		await expect(name(page)).toHaveValue('Ada Lovelace');
	});
});

test.describe('« proposer un café » under reduced motion', () => {
	test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

	test('the Contact’s link goes to the Café and opens the form', async ({ page }) => {
		await page.goto('/');
		await contactLink(page).scrollIntoViewIfNeeded();

		await contactLink(page).click();

		await expect(form(page)).toHaveAccessibleName(CAFE_TITLE);
		await expect(name(page)).toBeFocused();
		await expect(name(page)).toBeInViewport();
	});
});

test.describe('« proposer un café » without JavaScript', () => {
	test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });

	test('the Contact’s link is the Café’s anchor', async ({ page }) => {
		await page.goto('/');
		await expect(contactLink(page)).toHaveAttribute('href', '#cafe');

		await contactLink(page).click();

		await expect(page).toHaveURL(/#cafe$/);
		await expect(section(page).getByRole('heading', { level: 2 })).toBeInViewport();
	});
});
