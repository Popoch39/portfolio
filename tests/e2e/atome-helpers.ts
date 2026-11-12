import { expect, type Page } from '@playwright/test';
import { content, sceneOnceStill, topInPage, topOnceStill } from './helpers';

/** What the Atome's specs share: the section, and the way to stand at a point of its pinned scene. */

export const atomeSection = (page: Page) => page.locator('section:has([data-atome])');

/**
 * Where the pinned scene runs in the page: from the top of its spacer, over the spacer's extra height.
 * Read from the spacer, which stays in the flow while the section is pinned.
 */
export async function pinRange(page: Page) {
	const spacer = atomeSection(page).locator('xpath=..');
	// The scenes are built once the page has settled.
	await expect(spacer).toHaveClass(/pin-spacer/, { timeout: 15_000 });
	const top = await topInPage(spacer);
	const length = await spacer.evaluate((el: HTMLElement) => el.offsetHeight - (el.firstElementChild as HTMLElement).offsetHeight);
	return { top, length };
}

/** Scrolls to a share of the pinned scene (0 at its start, 1 at its end) and waits until it has caught up. */
export async function scrollToShare(page: Page, share: number) {
	const { top, length } = await pinRange(page);
	await page.evaluate((y) => scrollTo(0, y), Math.round(top + share * length));
	await topOnceStill(content(page));
	await sceneOnceStill(atomeSection(page));
}
