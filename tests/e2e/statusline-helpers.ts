import { expect, type Page } from '@playwright/test';
import { statusline, topOnceStill } from './helpers';

/** What the statusline answers to the visitor (spec #93): shared by the pointer, keyboard and finger specs. */

export const ADDRESS = 'pocheron.louis@gmail.com';
export const YANKED = '"+y · 24 caractères copiés';
export const SECOND_CLICK = ' · un second clic ouvre le mail';

export const address = (page: Page) => page.getByRole('link', { name: ADDRESS });
/** The city under the Contact's links: plain text a visitor can select. */
export const city = (page: Page) => page.locator('#contact').getByText('Besançon, France');
/** The mode the row shows: the statusline's own, or the one a detail holds over it. */
export const shownMode = (page: Page) => statusline(page).locator('.mode:visible').first();
export const branch = (page: Page) => statusline(page).locator('.branch');

/**
 * Opens the home page at its end, where the Contact is, and waits for the address to say it will be
 * copied: the details are listening. Scrolled by hand: smoothed, the page is not the browser's to scroll.
 */
export async function visitContact(page: Page) {
	await page.goto('/');
	await expect(address(page)).toHaveCSS('cursor', 'copy');
	await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	await expect(address(page)).toBeInViewport({ ratio: 1 });
	await topOnceStill(address(page));
}

/** What the clipboard holds, pasted the way a visitor would: no browser lets a test read it in both projects. */
export async function pasted(page: Page) {
	const field = page.locator('[data-test-paste]');
	await page.evaluate(() => {
		const area = document.createElement('textarea');
		area.dataset.testPaste = '';
		document.body.append(area);
	});
	await field.focus();
	await page.keyboard.press('ControlOrMeta+V');
	const value = await field.inputValue();
	await field.evaluate((area) => area.remove());
	return value;
}

/**
 * Counts the clicks on the address that the browser is left to follow, to the mail client (which a
 * test does not have: none is followed for good). Returns the way to read the count.
 */
export async function countFollowed(page: Page) {
	await address(page).evaluate((link) => {
		const counter = window as Window & { followed?: number };
		counter.followed = 0;
		// On the document: after the link's own listeners have had their say.
		document.addEventListener('click', (event) => {
			if (!(event.target instanceof Node) || !link.contains(event.target)) return;
			if (!event.defaultPrevented) counter.followed = (counter.followed ?? 0) + 1;
			event.preventDefault();
		});
	});
	return () => page.evaluate(() => (window as Window & { followed?: number }).followed);
}

/** The blink of the `yank` over the address: how it is timed while it plays, nothing once it is over. */
export function blink(page: Page) {
	return address(page).evaluate((link) => {
		const playing = link
			.getAnimations({ subtree: true })
			.find((animation) => animation.effect instanceof KeyframeEffect && animation.effect.pseudoElement === '::after');
		return playing ? getComputedStyle(link, '::after').animationTimingFunction : null;
	});
}
