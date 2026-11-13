/**
 * The hero's map (03 · Méridien): the graticule round Besançon, at a fixed scale whatever the
 * window, so that its minutes, its 1 km bar and the marker stay true. Worked out at build time:
 * the page receives lengths in px, measured from the marker.
 */
import { person } from '../data/profile';
import { dictionary, type Lang } from '../i18n';

/** One minute of latitude, px: the scale of the map. */
const LAT_MINUTE = 120;
/** A minute of longitude narrows with the cosine of the latitude. */
const LON_MINUTE = LAT_MINUTE * Math.cos((person.latitude * Math.PI) / 180);
/** One minute of latitude, m. */
const NAUTICAL_MILE = 1852;

/** Where the marker stands across the map: 64 % of its width on desktop, 76 % on narrow screens. */
export const meridianShares = [0.64, 0.76] as const;

/** Which compositions show a tick: the desktop one (`desk`, more ticks as the map widens) or the narrow one. */
type Shown = 'desk' | 'desk-wide' | 'desk-wider' | 'narrow';

/** A whole minute of arc, and the compositions that show its tick. */
type Tick = [degrees: number, minutes: number, shown: Shown[]];

/**
 * Picked so that every tick a composition shows fits inside the map at its narrowest, clear of the
 * latitudes down the right edge: the marker stands at 64 % of the map's width on desktop (more ticks
 * from 960 px and 1290 px wide), at 76 % on narrow screens.
 */
const LON_TICKS: Tick[] = [
	[5, 52, ['desk-wider']],
	[5, 54, ['desk-wide']],
	[5, 56, ['desk']],
	[5, 58, ['desk']],
	[5, 59, ['narrow']],
	[6, 0, ['desk', 'narrow']],
	[6, 1, ['narrow']],
	[6, 2, ['desk']],
	[6, 4, ['desk-wide']],
	[6, 6, ['desk-wider']],
];
/** 47°17′ would run into the longitudes along the top; the narrow map keeps clear of the Besançon label. */
const LAT_TICKS: Tick[] = [
	[47, 16, ['desk', 'narrow']],
	[47, 15, ['desk']],
	[47, 14, ['desk']],
	[47, 13, ['desk', 'narrow']],
	[47, 12, ['desk', 'narrow']],
];

const markerLon = person.longitude * 60;
const markerLat = person.latitude * 60;
/** px east of the marker. */
const east = (minutes: number) => (minutes - markerLon) * LON_MINUTE;
/** px south of the marker. */
const south = (minutes: number) => (markerLat - minutes) * LAT_MINUTE;
const modulo = (value: number, by: number) => ((value % by) + by) % by;
const px = (value: number) => Math.round(value * 10) / 10;
const angle = (degrees: number, minutes: number) => `${degrees}°${String(minutes).padStart(2, '0')}′`;

/** Degrees, minutes and seconds: 47°14′16″. */
function sexagesimal(value: number) {
	const seconds = Math.round(Math.abs(value) * 3600);
	return `${Math.floor(seconds / 3600)}°${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}′${String(seconds % 60).padStart(2, '0')}″`;
}

/** Besançon's coordinates, as the map's label prints them, hemispheres in the language's letters. */
export function coordinates(lang: Lang) {
	const { north, south, east, west } = dictionary(lang).geo;
	return {
		latitude: `${sexagesimal(person.latitude)} ${person.latitude < 0 ? south : north}`,
		longitude: `${sexagesimal(person.longitude)} ${person.longitude < 0 ? west : east}`,
	};
}

/** The lines' spacing, and where the first one falls east and south of the marker, px. */
export const graticule = {
	pitchX: px(LON_MINUTE),
	pitchY: LAT_MINUTE,
	phaseX: px(modulo(east(0), LON_MINUTE)),
	phaseY: px(modulo(south(0), LAT_MINUTE)),
};

/** The longitudes along the top edge: `x`, px east of the marker, is the meridian's. */
export const lonTicks = LON_TICKS.map(([degrees, minutes, shown]) => ({
	text: angle(degrees, minutes),
	x: px(east(degrees * 60 + minutes)),
	shown: shown.join(' '),
}));

/** The latitudes along the right edge: `y`, px south of the marker, is the parallel's. */
export const latTicks = LAT_TICKS.map(([degrees, minutes, shown]) => ({
	text: angle(degrees, minutes),
	y: px(south(degrees * 60 + minutes)),
	shown: shown.join(' '),
}));

/** One kilometre on the map, px. */
export const kilometre = px((LAT_MINUTE / NAUTICAL_MILE) * 1000);
