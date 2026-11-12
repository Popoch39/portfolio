/**
 * The sky over Besançon (06 · Terminateur, ADR 0008): where the sun is, and what the page makes of it.
 *
 * `paintSky` is written into the `<head>` as an inline script (`SkyTrigger.astro`), so that the theme
 * and the night on the hero are right from the first paint; the bundled module calls it again as time
 * passes and as the visitor picks a paper in the Nuancier. Hence one self-contained function: no import,
 * nothing from the module's scope, all it needs comes in as arguments. It writes on the root only:
 *
 * - `data-theme`: `dark` from sunset to sunrise in `auto`, or as the Nuancier (`data-bg`) forces it,
 *   whichever paper it is;
 * - `data-sun`: `up` or `down` at Besançon, whatever the paper;
 * - `data-sky`: how much of the hero's map the night covers, `day`, `dusk` or `night`;
 * - custom properties for the hero's terminator: its shift, its curve, the twilights' hatching, the labels.
 *
 * The time-dependent part is a single shift: the curve of the day is fixed, and the hour only slides
 * it across the map (a `translate`, composited). The shift goes on `line`, the hero's terminator once
 * the page is parsed: a minute's slide then restyles that subtree, not the page.
 * Returns the milliseconds until the next sunrise or sunset.
 */
import { person } from '../data/profile';
import { meridianShares } from '../hero/map';

export interface SkyPlace {
	latitude: number;
	longitude: number;
	/** Where the marker stands across the map, wide and narrow compositions (`src/hero/map.ts`). */
	shares: readonly [wide: number, narrow: number];
}

/**
 * The Nuancier's papers, in the fan's order, light and dark in turn so that each strip's edge shows on the
 * next (ADR 0009); `paintSky` reads them from `data-bg` on its own
 * (it may name nothing outside itself). Under every forced paper but the night, the hero keeps no night, as by day.
 */
export const skyModes = ['light', 'dark', 'kraft', 'cyan', 'tracing', 'phosphor', 'sanguine', 'auto'] as const;
export type SkyMode = (typeof skyModes)[number];

/**
 * Where the visit's paper is kept, in `sessionStorage`: drawn by lot as the visit begins
 * (`SkyTrigger.astro`), or picked in the Nuancier, it lasts until the next visit draws again.
 */
export const BG_KEY = 'bg';

export const skyPlace: SkyPlace = {
	latitude: person.latitude,
	longitude: person.longitude,
	shares: meridianShares,
};

export function paintSky(root: HTMLElement, now: Date, place: SkyPlace, line: HTMLElement = root): number {
	const RAD = Math.PI / 180;
	/** Minutes of sun time across the map's width: the twilights take about half of it in November. */
	const SPAN = 180;
	/** A shift past which the curve, twilights included, is off the map whatever the composition. */
	const FAR = 2;
	/** How far the polygons reach either side of the curve, in map widths: past any shift. */
	const REACH = 4;
	const STEPS = 24;
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
	// declination, and when it crosses −0.833° (sunrise and sunset, refraction included), −6°, −12° and −18°.
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
	const crossing = (altitude: number, side: number) => {
		const cosW = (Math.sin(altitude * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
		return cosW < -1 || cosW > 1 ? null : atJulian(transit + (side * Math.acos(cosW)) / (2 * Math.PI));
	};
	const ALTITUDES = [-0.833, -6, -12, -18];
	const noon = atJulian(transit);
	// Besançon always has a sunrise and a sunset; only the deepest twilights may be missing (none there, but kept honest).
	const [set, ...dusks] = ALTITUDES.map((a) => crossing(a, 1)) as [number, ...(number | null)[]];
	const [rise, ...dawns] = ALTITUDES.map((a) => crossing(a, -1)) as [number, ...(number | null)[]];

	const hour = minutesOf(now);
	// Each forced paper's surface, for the browser's chrome (`global.css`); `auto` is the absence of one.
	const SURFACES: Record<string, string> = {
		light: '#efeee9',
		dark: '#141412',
		cyan: '#12305a',
		kraft: '#d4b98f',
		tracing: '#e3e8ea',
		sanguine: '#f1e2d6',
		phosphor: '#0b130d',
	};
	const bg = root.dataset.bg;
	const mode = bg && Object.hasOwn(SURFACES, bg) ? bg : 'auto';
	const evening = hour >= noon;
	const sunDown = hour < rise || hour >= set;
	const theme = mode === 'auto' ? (sunDown ? 'dark' : 'light') : mode;
	// Written only when they change: a custom property or an attribute on the root restyles the whole page.
	const mark = (key: string, value: string) => {
		if (root.dataset[key] !== value) root.dataset[key] = value;
	};
	const put = (name: string, value: string, on = root) => {
		if (on.style.getPropertyValue(name) !== value) on.style.setProperty(name, value);
	};
	mark('theme', theme);
	mark('sun', sunDown ? 'down' : 'up');
	const themeColor = document.querySelector('meta[name="theme-color"]');
	const surface = SURFACES[theme];
	if (themeColor && themeColor.getAttribute('content') !== surface) themeColor.setAttribute('content', surface);

	const hhmm = (minutes: number) => {
		const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
		return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
	};
	put('--sky-rise', `"${hhmm(rise)}"`);
	put('--sky-set', `"${hhmm(set)}"`);

	// The evening's night lies east of the curve, the morning's west of it: the line moves west to bring it.
	const nightward = evening ? -1 : 1;
	const edge = evening ? set : rise;
	const shift =
		mode === 'auto' ? Math.max(-FAR, Math.min(FAR, (edge - hour) / SPAN)) : (mode === 'dark' ? nightward : -nightward) * FAR;
	put('--sky-shift', shift.toFixed(4), line);
	// Where the Intro holds the line while it plays: the night off the map, to fall once it ends.
	put('--sky-held', String(-nightward * FAR));

	// In winter the night reaches further west up north at dusk and lingers further east there at dawn;
	// the curve straightens at the equinoxes. `y` runs down the map, 0 to 1; `x` is in map widths from the line.
	const tilt = -0.22 * Math.tan(decl) * (evening ? 1 : -1);
	const bend = (yy: number) => tilt * Math.sin(Math.PI * (yy - 0.5));
	const [wide, narrow] = place.shares;
	const westmost = Math.min(wide, narrow) + shift - Math.abs(tilt);
	const eastmost = Math.max(wide, narrow) + shift + Math.abs(tilt);
	const off = evening ? { night: eastmost <= 0, day: westmost >= 1 } : { night: westmost >= 1, day: eastmost <= 0 };
	mark('sky', off.night ? 'night' : off.day ? 'day' : 'dusk');
	mark('skyHalf', evening ? 'evening' : 'morning');

	// Polygons on boxes that run REACH map widths either side of the map (`.sky-layer`), in % of them.
	const at = (x: number, pad: number) => {
		const percent = `${(((x + REACH) / (2 * REACH + 1)) * 100).toFixed(3)}%`;
		return pad ? `calc(${percent} ${pad < 0 ? '-' : '+'} ${Math.abs(pad)}px)` : percent;
	};
	const curve = (offset: number, pad: number) => {
		const points: string[] = [];
		for (let i = 0; i <= STEPS; i++) points.push(`${at(offset + bend(i / STEPS), pad)} ${((i / STEPS) * 100).toFixed(2)}%`);
		return points;
	};
	const between = (from: string[], to: string[]) => `polygon(${[...from, ...to.reverse()].join(', ')})`;
	const far = (x: number) => [`${at(x, 0)} 0%`, `${at(x, 0)} 100%`];
	// The night, and the accent's edge along it: the same outline, 2 px wider on the day's side.
	const nightSide = -nightward * REACH;
	put('--sky-night', between(curve(0, 0), far(nightSide)));
	put('--sky-sliver', between(curve(0, 2 * nightward), far(nightSide)));

	// The twilights, hatched more sparsely towards full night: civil, nautical, astronomical.
	const limits = evening ? [set, ...dusks] : [rise, ...dawns];
	const offsetOf = (time: number) => (time - edge) / SPAN;
	const names = evening
		? ['crépuscule civil', 'crépuscule nautique', 'crépuscule astronomique']
		: ['aube civile', 'aube nautique', 'aube astronomique'];
	const DEGREES = ['0 → −6°', '−6 → −12°', '−12 → −18°'];
	/** Where the labels hang down the map. */
	const LABEL_Y = 0.91;
	let deepest = 0;
	for (let k = 0; k < 3; k++) {
		const a = limits[k];
		const b = limits[k + 1];
		const band = k + 1;
		if (a == null || b == null) {
			put(`--sky-band-${band}`, 'inset(50%)');
			put(`--sky-label-${band}`, 'none');
			continue;
		}
		const [from, to] = [offsetOf(a), offsetOf(b)];
		deepest = to;
		put(`--sky-band-${band}`, between(curve(from, 0), curve(to, 0)));
		// Too thin a band for its label on a wide map leaves it out.
		const centre = (from + to) / 2 + bend(LABEL_Y);
		put(`--sky-label-${band}-at`, centre.toFixed(4));
		put(`--sky-label-${band}`, Math.abs(to - from) > 0.09 ? `"${names[k]} · ${DEGREES[k]}"` : 'none');
	}
	// Full night begins past the last twilight: its label keeps to the middle of what the map shows of it.
	put('--sky-night-edge', (deepest + bend(LABEL_Y)).toFixed(4));
	put('--sky-label-4', mode === 'dark' ? '"nuit · papier EN-02"' : '"nuit"');
	// The sun's own label rides the top of the line.
	put('--sky-chip-at', bend(0.16).toFixed(4));
	put('--sky-chip', `"0° · ${evening ? 'coucher' : 'lever'} ${hhmm(edge)}"`);

	// The next change of theme in `auto`: today's sunrise or sunset, or tomorrow's sunrise (a minute off at most).
	const next = hour < rise ? rise : hour < set ? set : rise + 1440;
	return Math.max(1000, (next - hour) * 60000);
}
