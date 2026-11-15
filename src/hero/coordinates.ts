/**
 * Besançon's coordinates, as the hero's mark prints them (E2 · Établi): degrees, minutes and seconds,
 * hemispheres in the language's letters. Worked out at build time.
 */
import { person } from '../data/profile';
import { dictionary, type Lang } from '../i18n';

/** Degrees, minutes and seconds: 47°14′16″. */
function sexagesimal(value: number) {
	const seconds = Math.round(Math.abs(value) * 3600);
	return `${Math.floor(seconds / 3600)}°${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}′${String(seconds % 60).padStart(2, '0')}″`;
}

export function coordinates(lang: Lang) {
	const { north, south, east, west } = dictionary(lang).geo;
	return {
		latitude: `${sexagesimal(person.latitude)} ${person.latitude < 0 ? south : north}`,
		longitude: `${sexagesimal(person.longitude)} ${person.longitude < 0 ? west : east}`,
	};
}
