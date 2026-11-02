import { expect, type Page } from '@playwright/test';
import { topInPage, topOnceStill } from './helpers';

export const friseSection = (page: Page) => page.getByRole('region', { name: 'Parcours', exact: true });
// A region at the final state only: the scene takes its role away with its tab stop.
export const friseBand = (page: Page) => friseSection(page).locator('.frise-band');
// Hidden from assistive technologies: targeted by its attribute.
export const friseLegend = (page: Page) => page.locator('[data-frise-legend]');

/** The scene stays pinned for four window heights (400svh). */
export const PIN_HEIGHTS = 4;

/** Where the scene starts in the page, taken before the pinning moves the section. */
export const sceneStart = (page: Page) => topInPage(friseSection(page));

/** Scrolls to a point of the scene, 0 at the start of the pinning and 1 at its end, and waits until still. */
export async function scrollToScene(page: Page, start: number, progress: number) {
	await page.evaluate(([top, at, heights]) => scrollTo(0, top + at * heights * innerHeight), [start, progress, PIN_HEIGHTS]);
	await topOnceStill(friseSection(page));
}

/** Where the HEAD commit stands on screen, horizontally: it comes closer from the right as HEAD moves forward. */
export async function headOnScreen(page: Page) {
	const box = await friseBand(page).getByRole('listitem').last().boundingBox();
	if (!box) throw new Error('HEAD commit missing');
	return box.x;
}

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * What the visitor sees of the Frise: the boxes of the heading block, the legend and each commit
 * card, and for each card the smallest text size on screen, perspective included.
 */
export function friseFraming(page: Page) {
	return page.evaluate(() => {
		const boxOf = (el: Element | null): Box | null => {
			const box = el?.getBoundingClientRect();
			return box && box.width > 0 ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null;
		};
		// The rendered size: the font size times how much the 3D transforms shrink or magnify the line.
		const textOnScreen = (el: HTMLElement) =>
			(Number.parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height) / el.offsetHeight;
		const section = document.querySelector('#parcours');
		const band = section?.querySelector('.frise-band');
		const commits = [...(band?.querySelectorAll('.commit') ?? [])].map((commit) => {
			const card = commit.querySelector('.commit-card');
			const lines = [...(card?.querySelectorAll<HTMLElement>('.commit-meta, .commit-title, .commit-place') ?? [])];
			return {
				title: card?.querySelector('.commit-title')?.textContent ?? '',
				box: boxOf(card),
				text: Math.min(...lines.map(textOnScreen)),
			};
		});
		return {
			viewport: { width: innerWidth, height: innerHeight },
			horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
			heading: boxOf(section?.querySelector('.frise-head') ?? null),
			legend: boxOf(section?.querySelector('[data-frise-legend]') ?? null),
			band: boxOf(band ?? null),
			statuslineTop: document.querySelector('#statusline')?.getBoundingClientRect().top ?? innerHeight,
			commits,
		};
	});
}

export type Framing = Awaited<ReturnType<typeof friseFraming>>;

const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The card is fully inside the band, between its edges, below the heading block (the band runs
 * behind it, for the grid) and above the statusline.
 */
export const inFrame = (framing: Framing, box: Box | null) =>
	!!box &&
	!!framing.band &&
	box.left >= 0 &&
	box.right <= framing.viewport.width &&
	box.top >= Math.max(framing.band.top, framing.heading?.bottom ?? framing.band.top) &&
	box.bottom <= Math.min(framing.band.bottom, framing.statuslineTop);

/** The smallest text that passes for readable on the accent band (AA is checked on the colours). */
export const READABLE_TEXT = 11;

/** No horizontal scroll, and the legend clear of the heading block and of the statusline. */
export function expectFramed(framing: Framing) {
	expect(framing.horizontalOverflow).toBeLessThanOrEqual(0);
	if (!framing.legend || !framing.heading) return;
	expect(overlap(framing.legend, framing.heading), 'the legend overlaps the heading').toBe(false);
	expect(framing.legend.left).toBeGreaterThanOrEqual(0);
	expect(framing.legend.right).toBeLessThanOrEqual(framing.viewport.width);
	expect(framing.legend.bottom).toBeLessThanOrEqual(framing.statuslineTop);
}

/** The commit's card stands fully in the frame, its text at least 11px on screen. */
export function expectReadable(framing: Framing, title: RegExp) {
	const commit = framing.commits.find((candidate) => title.test(candidate.title));
	expect(commit, `no commit titled ${title}`).toBeTruthy();
	expect(inFrame(framing, commit?.box ?? null), `${title} sticks out of the frame`).toBe(true);
	expect(commit?.text).toBeGreaterThanOrEqual(READABLE_TEXT);
}
