/**
 * The sky over Besançon (ADR 0008): where the sun is, and what the page makes of it.
 *
 * `paintSky` is written into the `<head>` as an inline script (`SkyTrigger.astro`), so that the theme
 * is right from the first paint; the bundled module calls it again as time passes and as the visitor
 * picks a paper in the Nuancier. Hence one self-contained function: no import, nothing from the
 * module's scope, all it needs comes in as arguments. It writes on the root only:
 *
 * - `data-theme`: `dark` from sunset to sunrise in `auto`, or as the Nuancier (`data-bg`) forces it,
 *   whichever paper it is;
 * - `data-sun`: `up` or `down` at Besançon, whatever the paper;
 * - `data-sky`: `day` or `night` at Besançon, the sign that the sky has been painted;
 * - `--sky-rise` and `--sky-set`: today's sunrise and sunset, as the statusline prints them.
 *
 * Returns the milliseconds until the next sunrise or sunset.
 */
import { person } from '../data/profile';

export interface SkyPlace {
	latitude: number;
	longitude: number;
}

/**
 * The Nuancier's papers, in the fan's order, light and dark in turn so that each strip's edge shows on the
 * next (ADR 0009); `paintSky` reads them from `data-bg` on its own (it may name nothing outside itself).
 */
export const skyModes = [
	'light',
	'dark',
	'solarized-light',
	'nord',
	'gruvbox-light',
	'catppuccin-mocha',
	'tokyo-night',
	'auto',
] as const;
export type SkyMode = (typeof skyModes)[number];

/**
 * Where the visit's paper is kept, in `sessionStorage`: drawn by lot as the visit begins
 * (`SkyTrigger.astro`), or picked in the Nuancier, it lasts until the next visit draws again.
 */
export const BG_KEY = 'bg';

export const skyPlace: SkyPlace = {
	latitude: person.latitude,
	longitude: person.longitude,
};

export function paintSky(root: HTMLElement, now: Date, place: SkyPlace): number {
	const RAD = Math.PI / 180;
	const ZONE = 'Europe/Paris';

	// Minutes since midnight on the Paris clock: the time Besançon keeps.
	const clock = new Intl.DateTimeFormat('en-GB', {
		timeZone: ZONE,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	});
	const minutesOf = (date: Date) => {
		const parts = clock.formatToParts(date);
		const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
		return part('hour') * 60 + part('minute') + part('second') / 60;
	};

	// The sunrise equation (NOAA's simplification) for today's date at Besançon: solar noon, the sun's
	// declination, and when it crosses −0.833° (refraction included).
	const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
	const [y, m, d] = ymd.format(now).split('-').map(Number);
	const n = Math.round(Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5 - 2451545);
	const jStar = n - place.longitude / 360;
	const M = (357.5291 + 0.98560028 * jStar) % 360;
	const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
	const lambda = (M + C + 180 + 102.9372) % 360;
	const transit = 2451545 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
	const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
	const lat = place.latitude * RAD;
	const atJulian = (jd: number) => minutesOf(new Date((jd - 2440587.5) * 86400000));
	// Besançon always has a sunrise and a sunset.
	const crossing = (side: number) => {
		const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
		return atJulian(transit + (side * Math.acos(cosW)) / (2 * Math.PI));
	};
	const set = crossing(1);
	const rise = crossing(-1);

	const hour = minutesOf(now);
	// Each forced paper's surface, for the browser's chrome (`global.css`); `auto` is the absence of one.
	const SURFACES: Record<string, string> = {
		light: '#efeee9',
		dark: '#141412',
		'solarized-light': '#fdf6e3',
		nord: '#2e3440',
		'gruvbox-light': '#fbf1c7',
		'catppuccin-mocha': '#1e1e2e',
		'tokyo-night': '#1a1b26',
	};
	const bg = root.dataset.bg;
	const mode = bg && Object.hasOwn(SURFACES, bg) ? bg : 'auto';
	const sunDown = hour < rise || hour >= set;
	const theme = mode === 'auto' ? (sunDown ? 'dark' : 'light') : mode;
	// Written only when they change: a custom property or an attribute on the root restyles the whole page.
	const mark = (key: string, value: string) => {
		if (root.dataset[key] !== value) root.dataset[key] = value;
	};
	const put = (name: string, value: string) => {
		if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
	};
	mark('theme', theme);
	mark('sun', sunDown ? 'down' : 'up');
	mark('sky', sunDown ? 'night' : 'day');
	const themeColor = document.querySelector('meta[name="theme-color"]');
	const surface = SURFACES[theme];
	if (themeColor && themeColor.getAttribute('content') !== surface) themeColor.setAttribute('content', surface);

	const hhmm = (minutes: number) => {
		const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
		return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
	};
	put('--sky-rise', `"${hhmm(rise)}"`);
	put('--sky-set', `"${hhmm(set)}"`);

	// The next change of theme in `auto`: today's sunrise or sunset, or tomorrow's sunrise (a minute off at most).
	const next = hour < rise ? rise : hour < set ? set : rise + 1440;
	return Math.max(1000, (next - hour) * 60000);
}
