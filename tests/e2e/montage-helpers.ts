import type { Page } from '@playwright/test';
import { content, topInPage, topOnceStill } from './helpers';

export const cafeSection = (page: Page) =>
	page.getByRole('region', { name: 'Parlons de votre projet autour d’un café.', exact: true });

/** The moka on its stove, announced as a single image. */
export const montageFigure = (page: Page) => cafeSection(page).getByRole('img', { name: /Moka Express/ });

/** The counter under the title, naming the step in progress. */
export const cafeCounter = (page: Page) => cafeSection(page).getByText(/^\d\/6 · /);

/** The scene stays pinned for 2.9 window heights (290svh). */
export const PIN_HEIGHTS = 2.9;

/** Where the scene starts in the page, taken before the pinning moves the section. */
export const sceneStart = (page: Page) => topInPage(cafeSection(page));

/**
 * Scrolls to a point of the scene, 0 at the start of the pinning and 1 at its end, and waits until the smoothing
 * has settled: the pinned section stands still while the scene still plays, the page's content does not.
 */
export async function scrollToScene(page: Page, start: number, progress: number) {
	await page.evaluate(([top, at, heights]) => scrollTo(0, top + at * heights * innerHeight), [start, progress, PIN_HEIGHTS]);
	await topOnceStill(content(page));
}
