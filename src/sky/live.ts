/**
 * The sky as time passes and as the visitor picks a paper (ADR 0008, ADR 0009). The inline script in
 * the `<head>` has painted it once (`SkyTrigger.astro`); this module keeps it true.
 *
 * - The page's theme turns at sunrise and sunset: one timer to the next of them, set again on every paint,
 *   and a paint whenever the tab comes back (a hidden tab's timers run late).
 * - A paper picked in the Nuancier is applied here (`applyBg`); its reveal is `nuancier.ts`'s.
 */
import { BG_KEY, paintSky, skyPlace } from './sky';

const root = document.documentElement;

let turn: ReturnType<typeof setTimeout> | undefined;
function paint() {
	clearTimeout(turn);
	turn = setTimeout(paint, paintSky(root, new Date(), skyPlace));
}
paint();
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) paint();
});
addEventListener('pageshow', (event) => {
	if (event.persisted) paint();
});

/**
 * Puts the page on the paper the visitor picked in the Nuancier, for the rest of the visit: the next
 * one draws its own (`SkyTrigger.astro`).
 */
export function applyBg(bg: string) {
	remember(bg);
	if (bg === 'auto') delete root.dataset.bg;
	else root.dataset.bg = bg;
	paint();
}

/**
 * Keeps the choice from page to page; tells whether it could. `auto` is kept too, so that the next
 * draw does not land on it again. Storage throws when the browser blocks site data: the choice then
 * lasts for this page only.
 */
function remember(bg: string) {
	try {
		sessionStorage.setItem(BG_KEY, bg);
		return true;
	} catch {
		return false;
	}
}
