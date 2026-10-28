// Calculs purs sur l'instantané des contributions GitHub : les statistiques de la barre d'état, portées
// du `renderVals()` de la maquette D1, et le Tri de la section Activité (spec #107). Tout est calculé en
// UTC : le jour d'une contribution ne dépend pas du fuseau de la machine de build.
import type { ContributionSnapshot } from '../data/github-snapshot';
import { formats, type Locale, type Localized } from './i18n';

const DAY_MS = 86_400_000;

const formattersOf = (intl: string) => ({
	number: new Intl.NumberFormat(intl),
	decimal: new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }),
	day: new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
	shortDay: new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
	list: new Intl.ListFormat(intl, { type: 'conjunction' }),
	plural: new Intl.PluralRules(intl),
});

const formatters: Localized<ReturnType<typeof formattersOf>> = {
	fr: formattersOf(formats.fr.intl),
	en: formattersOf(formats.en.intl),
};

/** « 2 688 », avec l'espace fine insécable du français ; « 2,688 » en anglais. */
export const formatNumber = (n: number, locale: Locale) => formatters[locale].number.format(n);

/** « 7 octobre 2026 », « 7 October 2026 ». */
export const formatDay = (date: Date, locale: Locale) => formatters[locale].day.format(date);

const isOne = (count: number, locale: Locale) => formatters[locale].plural.select(count) === 'one';

/** « jour », « jours » : la règle de pluriel de la langue (en français, 0 et 1 restent au singulier). */
const plural = (count: number, word: string, locale: Locale) => `${word}${isOne(count, locale) ? '' : 's'}`;

/** Les textes composés de l'activité, nombres et dates déjà formatés. */
interface ActivityCopy {
	/** « aucune contribution », « 1 contribution », « 2 688 contributions ». */
	noContribution: string;
	/** Le mot « jour », au singulier. */
	day: string;
	noActiveDay: string;
	/** « jour actif » et « jours actifs » : en anglais, l'adjectif ne s'accorde pas. */
	activeDay: [one: string, other: string];
	/** « 232 jours actifs sur 365 ». */
	outOf: (part: string, whole: string) => string;
	/** « 51 semaines actives sur 53 ». */
	activeWeeks: (active: string, weeks: string) => string;
	/** « sem. du 6 sept. » */
	week: (day: string) => string;
	pause: (week: string) => string;
	/** Infobulle d'un nœud : « sem. du 6 sept. : 5 jours actifs, 66 contributions ». */
	nodeTitle: (week: string, activeDays: string, contributions: string) => string;
	conclusion: (activeWeeks: string, gap: string) => string;
	/** Description de la figure ; `pauses` est déjà une liste formatée, vide s'il n'y en a pas. */
	figureLabel: (from: string, to: string, activeDays: string, activeWeeks: string, mean: string, pauses: string[]) => string;
}

const copy: Localized<ActivityCopy> = {
	fr: {
		noContribution: 'aucune contribution',
		day: 'jour',
		noActiveDay: 'aucun jour actif',
		activeDay: ['jour actif', 'jours actifs'],
		outOf: (part, whole) => `${part} sur ${whole}`,
		activeWeeks: (active, weeks) => `${active} semaines actives sur ${weeks}`,
		week: (day) => `sem. du ${day}`,
		pause: (week) => `pause, ${week}`,
		nodeTitle: (week, activeDays, contributions) => `${week} : ${activeDays}, ${contributions}`,
		conclusion: (activeWeeks, gap) =>
			`Le nombre de commits importe peu. Ce qui compte : ${activeWeeks}, et jamais plus de ${gap} sans y revenir.`,
		figureLabel: (from, to, activeDays, activeWeeks, mean, pauses) =>
			`Activité GitHub semaine par semaine, du ${from} au ${to} : ${activeDays}, ${activeWeeks}, ${mean} jours actifs par semaine active en moyenne.` +
			(pauses.length === 0 ? '' : ` ${pauses.length === 1 ? 'Pause : semaine' : 'Pauses : semaines'} ${formatters.fr.list.format(pauses.map((p) => `du ${p}`))}.`),
	},
	en: {
		noContribution: 'no contributions',
		day: 'day',
		noActiveDay: 'no active days',
		activeDay: ['active day', 'active days'],
		outOf: (part, whole) => `${part} out of ${whole}`,
		activeWeeks: (active, weeks) => `${active} active weeks out of ${weeks}`,
		week: (day) => `week of ${day}`,
		pause: (week) => `pause, ${week}`,
		nodeTitle: (week, activeDays, contributions) => `${week}: ${activeDays}, ${contributions}`,
		conclusion: (activeWeeks, gap) =>
			`The number of commits hardly matters. What counts: ${activeWeeks}, and never more than ${gap} without coming back.`,
		figureLabel: (from, to, activeDays, activeWeeks, mean, pauses) =>
			`GitHub activity week by week, from ${from} to ${to}: ${activeDays}, ${activeWeeks}, ${mean} active days per active week on average.` +
			(pauses.length === 0 ? '' : ` ${pauses.length === 1 ? 'Pause: week' : 'Pauses: weeks'} of ${formatters.en.list.format(pauses)}.`),
	},
};

function contributions(count: number, locale: Locale): string {
	if (count === 0) return copy[locale].noContribution;
	return `${formatNumber(count, locale)} ${plural(count, 'contribution', locale)}`;
}

/** « 15 jours », « 15 days ». */
export const days = (count: number, locale: Locale) =>
	`${formatNumber(count, locale)} ${plural(count, copy[locale].day, locale)}`;

/** « 5 jours actifs », « aucun jour actif ». */
function activeDays(count: number, locale: Locale): string {
	if (count === 0) return copy[locale].noActiveDay;
	const [one, other] = copy[locale].activeDay;
	return `${formatNumber(count, locale)} ${isOne(count, locale) ? one : other}`;
}

/** Date (UTC, minuit) du `index`-ième jour de l'instantané ; `start` sans heure est lu en UTC. */
function dayOf(snapshot: ContributionSnapshot, index: number): Date {
	return new Date(Date.parse(snapshot.start) + index * DAY_MS);
}

export interface ActivityStats {
	total: number;
	/** Jours avec au moins une contribution. */
	activeDays: number;
	/** Plus longue suite de jours actifs consécutifs. */
	longestStreak: number;
	/** Plus forte journée ; la première en cas d'égalité. */
	record: { count: number; date: Date };
}

export function activityStats(snapshot: ContributionSnapshot): ActivityStats {
	let total = 0;
	let activeDays = 0;
	let longestStreak = 0;
	let streak = 0;
	let recordCount = 0;
	let recordIndex = 0;
	snapshot.counts.forEach((count, i) => {
		total += count;
		if (count > 0) {
			activeDays++;
			streak++;
			longestStreak = Math.max(longestStreak, streak);
		} else {
			streak = 0;
		}
		if (count > recordCount) {
			recordCount = count;
			recordIndex = i;
		}
	});
	return { total, activeDays, longestStreak, record: { count: recordCount, date: dayOf(snapshot, recordIndex) } };
}

/** Une semaine du Tri : une colonne de 7 jours du calendrier, du dimanche au samedi. */
export interface TriWeek {
	/** Jours actifs de la semaine, de 0 à 7 : la taille de son nœud sur `main`. */
	activeDays: number;
	contributions: number;
	/** Premier jour, en toutes lettres, pour le tableau : « 6 septembre 2026 ». */
	date: string;
	/** Infobulle du nœud : « sem. du 6 sept. : 5 jours actifs, 66 contributions ». */
	title: string;
	/** Étiquette d'une semaine sans Jour actif : « pause, sem. du 28 déc. ». */
	pause?: string;
	/**
	 * Le trait qui la relie à la semaine précédente : plein entre deux Semaines actives, pointillé
	 * autour d'une pause. Absent pour la première.
	 */
	link?: 'solid' | 'dotted';
}

export interface Tri {
	weeks: TriWeek[];
	/** Jours de l'instantané, et Jours actifs parmi eux. */
	days: number;
	activeDays: number;
	/** Semaines avec au moins un Jour actif. */
	activeWeeks: number;
	/** Plus longue suite de jours consécutifs sans contribution. */
	longestGap: number;
	/** Jours actifs par Semaine active, en moyenne. */
	meanActiveDays: number;
	/** « 51 semaines actives sur 53 ». */
	count: string;
	/** « Le nombre de commits importe peu. Ce qui compte : … » */
	conclusion: string;
	/** Description de la figure : période, Jours actifs, Semaines actives, moyenne et pauses. */
	figureLabel: string;
}

export function tri(snapshot: ContributionSnapshot, locale: Locale): Tri {
	const text = copy[locale];
	const format = formatters[locale];
	const { counts } = snapshot;

	const weeks: TriWeek[] = [];
	for (let first = 0; first < counts.length; first += 7) {
		const week = counts.slice(first, first + 7);
		const start = dayOf(snapshot, first);
		const active = week.filter((count) => count > 0).length;
		const total = week.reduce((sum, count) => sum + count, 0);
		const label = text.week(format.shortDay.format(start));
		const previous = weeks.at(-1);
		weeks.push({
			activeDays: active,
			contributions: total,
			date: formatDay(start, locale),
			title: text.nodeTitle(label, activeDays(active, locale), contributions(total, locale)),
			pause: active === 0 ? text.pause(label) : undefined,
			link: previous && (previous.activeDays > 0 && active > 0 ? 'solid' : 'dotted'),
		});
	}

	let longestGap = 0;
	let gap = 0;
	for (const count of counts) {
		gap = count > 0 ? 0 : gap + 1;
		longestGap = Math.max(longestGap, gap);
	}

	const activeDayCount = counts.filter((count) => count > 0).length;
	const activeWeeks = weeks.filter((week) => week.activeDays > 0).length;
	const meanActiveDays = activeWeeks === 0 ? 0 : activeDayCount / activeWeeks;
	const count = text.activeWeeks(formatNumber(activeWeeks, locale), formatNumber(weeks.length, locale));

	return {
		weeks,
		days: counts.length,
		activeDays: activeDayCount,
		activeWeeks,
		longestGap,
		meanActiveDays,
		count,
		conclusion: text.conclusion(count, days(longestGap, locale)),
		figureLabel: text.figureLabel(
			formatDay(dayOf(snapshot, 0), locale),
			formatDay(dayOf(snapshot, counts.length - 1), locale),
			text.outOf(activeDays(activeDayCount, locale), formatNumber(counts.length, locale)),
			count,
			format.decimal.format(meanActiveDays),
			weeks.filter((week) => week.activeDays === 0).map((week) => week.date),
		),
	};
}
