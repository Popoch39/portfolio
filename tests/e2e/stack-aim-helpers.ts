import { expect, type Page } from '@playwright/test';
import { atomeSection, scrollToShare } from './atome-helpers';
import { statusline } from './helpers';
import { branch } from './statusline-helpers';

/** What the tower's answer to an aim shows (spec #93, details 07 and 08): shared by the pointer, keyboard and finger specs. */

/** The bagues from the base of the tower up, as the stack lists them. */
export const LANGAGES = 0;
export const BACK_END = 1;
export const SIG = 3;
export const OUTILS = 6;
export const LANGAGES_ANSWER = 'stack=TypeScript,Rust,PHP,SQL,Go,Lua · Langages';
export const BACK_END_ANSWER = 'stack=NestJS,Laravel,Axum,Elysia,Node,GraphQL,REST · Back-end';

export const label = (page: Page, rank: number) => page.locator('.atome-label').nth(rank);
export const category = (page: Page, rank: number) => label(page, rank).locator('.atome-category');
export const tool = (page: Page, name: string) => page.locator('.atome-tools').getByText(name, { exact: true });
export const message = (page: Page) => statusline(page).locator('.message');
export const inkOf = (page: Page, rank: number) => category(page, rank).evaluate((el) => getComputedStyle(el).color);

/** Opens the home page on the finished tower: just past the end of its pinned scene. */
export async function visitTower(page: Page) {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	await scrollToShare(page, 1.02);
	await expect(label(page, OUTILS)).toBeInViewport();
}

/** Opens the home page on the tower where no scene plays (reduced motion): it stands in the flow. */
export async function visitStillTower(page: Page) {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	const tower = atomeSection(page).locator('.atome-tower');
	// In the middle of the window: at its bottom, the statusline would cover the base of the tower.
	await tower.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await expect(tower).toBeInViewport({ ratio: 1 });
}

/** What each bague shows, from the base up: how high its band stands on screen, how much accent it carries. */
export function towerLook(page: Page) {
	return page.locator('.bague').evaluateAll((bagues) =>
		bagues.map((bague) => {
			const accent = bague.querySelector('.bague-top .bague-aim');
			return {
				top: Math.round(bague.querySelector('.bague-top .bague-band')?.getBoundingClientRect().top ?? Number.NaN),
				accent: accent ? Number(getComputedStyle(accent).opacity) : 0,
			};
		}),
	);
}

export type Look = Awaited<ReturnType<typeof towerLook>>;

/** The bague stands lit and lifted against how the tower looked at rest; the others have not moved. */
export async function expectAimed(page: Page, rank: number, atRest: Look) {
	await expect.poll(async () => (await towerLook(page))[rank].accent, { message: 'the accent' }).toBe(1);
	await expect
		.poll(async () => atRest[rank].top - (await towerLook(page))[rank].top, { message: 'the lift' })
		.toBeGreaterThanOrEqual(5);
	const look = await towerLook(page);
	expect(look.filter((_, other) => other !== rank)).toEqual(atRest.filter((_, other) => other !== rank));
}

/** The tower as it stood, and no answer in the statusline. */
export async function expectAtRest(page: Page, atRest: Look) {
	await expect.poll(() => towerLook(page)).toEqual(atRest);
	await expect(statusline(page)).not.toContainText('stack=');
}

/** The statusline's row given back: no message, the branch in its place. */
export async function expectRowGivenBack(page: Page) {
	await expect(message(page)).toBeHidden();
	await expect(branch(page)).toBeVisible();
}

/** A point of the bague's band on screen: its near side, in the middle of the stroke. */
export function bandPoint(page: Page, rank: number) {
	return page
		.locator('.bague')
		.nth(rank)
		.locator('.bague-top .bague-band')
		.evaluate((band) => {
			const { left, width, bottom } = band.getBoundingClientRect();
			return { x: left + width / 2, y: bottom };
		});
}

/** The middle of a bague's first pastille on screen. */
export function pastillePoint(page: Page, rank: number) {
	return page
		.locator('.bague')
		.nth(rank)
		.locator('.pastille-logo')
		.first()
		.evaluate((logo) => {
			const { left, top, width, height } = logo.getBoundingClientRect();
			return { x: left + width / 2, y: top + height / 2 };
		});
}

/** The labels a visitor can read, by rank: neither faded out nor hidden. */
export function shownLabels(page: Page) {
	return page.locator('.atome-label').evaluateAll((labels) =>
		labels.flatMap((label, rank) => {
			const style = getComputedStyle(label);
			return Number(style.opacity) > 0.5 && style.visibility === 'visible' ? [rank] : [];
		}),
	);
}
