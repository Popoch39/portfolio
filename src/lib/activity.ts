// Calculs purs sur l'instantané des contributions GitHub, portés du `renderVals()` de la
// maquette D1. Tout est calculé en UTC : le jour d'une contribution ne dépend pas du
// fuseau de la machine de build.
import type { ContributionSnapshot } from '../data/github-snapshot';
import { formats, type Locale, type Localized } from './i18n';

const DAY_MS = 86_400_000;

const formattersOf = (intl: string) => ({
	number: new Intl.NumberFormat(intl),
	day: new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
	month: new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
	shortMonthYear: new Intl.DateTimeFormat(intl, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
	shortMonth: new Intl.DateTimeFormat(intl, { month: 'short', timeZone: 'UTC' }),
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

/** « octobre 2025 », « October 2025 ». */
const formatMonth = (date: Date, locale: Locale) => formatters[locale].month.format(date);

/** « jour », « jours » : la règle de pluriel de la langue (en français, 0 et 1 restent au singulier). */
const plural = (count: number, word: string, locale: Locale) =>
	`${word}${formatters[locale].plural.select(count) === 'one' ? '' : 's'}`;

/** « d’octobre », « de mars » : élision devant une voyelle. */
const ofMonth = (month: string) => (/^[aeiouyéè]/.test(month) ? `d’${month}` : `de ${month}`);

/** Les textes composés de l'activité, nombres et dates déjà formatés. */
interface ActivityCopy {
	/** « aucune contribution », « 1 contribution », « 2 688 contributions ». */
	noContribution: string;
	/** Le mot « jour », au singulier. */
	day: string;
	/** Jours d'un mois incomplet : « 6 jours en oct. 2025 », puis « 25 en oct. 2026 ». */
	partialDays: (days: string, month: string) => string;
	incomplete: string;
	partialNote: (months: string) => string;
	monthlyAria: (months: string) => string;
	andOver: (low: number) => string;
	heatmapAria: (from: string, to: string, total: string, record: string, recordDay: string) => string;
}

const copy: Localized<ActivityCopy> = {
	fr: {
		noContribution: 'aucune contribution',
		day: 'jour',
		partialDays: (days, month) => `${days} en ${month}`,
		incomplete: ' (incomplet)',
		partialNote: (months) => `* mois incomplets : ${months}`,
		monthlyAria: (months) => `Contributions par mois : ${months}.`,
		andOver: (low) => `${low} et plus`,
		heatmapAria: (from, to, total, record, recordDay) =>
			`Calendrier des contributions GitHub, ${ofMonth(from)} à ${to} : ${total}, record de ${record} le ${recordDay}.`,
	},
	en: {
		noContribution: 'no contributions',
		day: 'day',
		partialDays: (days, month) => `${days} in ${month}`,
		incomplete: ' (partial)',
		partialNote: (months) => `* partial months: ${months}`,
		monthlyAria: (months) => `Contributions per month: ${months}.`,
		andOver: (low) => `${low} and over`,
		heatmapAria: (from, to, total, record, recordDay) =>
			`GitHub contribution calendar, ${from} to ${to}: ${total}, best day ${record} on ${recordDay}.`,
	},
};

function contributions(count: number, locale: Locale): string {
	if (count === 0) return copy[locale].noContribution;
	return `${formatNumber(count, locale)} ${plural(count, 'contribution', locale)}`;
}

/** « 15 jours », « 15 days ». */
export const days = (count: number, locale: Locale) =>
	`${formatNumber(count, locale)} ${plural(count, copy[locale].day, locale)}`;

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

/** Hauteur de la barre du mois record, en px. */
const BAR_MAX_HEIGHT = 190;
/** Un mois sans contribution garde une barre visible. */
const BAR_MIN_HEIGHT = 2;

export interface MonthBar {
	/** Étiquette sous la barre : « oct.* » pour un mois incomplet. */
	label: string;
	/** Ligne du tableau : « octobre 2025 (incomplet) ». */
	name: string;
	/** Infobulle : « octobre 2025 · 13 contributions ». */
	title: string;
	value: number;
	/** Hauteur de la barre en px : valeur / max × 190, 2 px au minimum. */
	height: number;
	/** Valeur écrite au-dessus de la barre : seulement pour le mois record et le dernier mois. */
	showValue: boolean;
}

export interface MonthlyTotals {
	months: MonthBar[];
	/** « * mois incomplets : 6 jours en oct. 2025, 25 en oct. 2026 ». */
	partialNote: string;
	ariaLabel: string;
}

export function monthlyTotals(snapshot: ContributionSnapshot, locale: Locale): MonthlyTotals {
	const format = formatters[locale];
	const text = copy[locale];
	const groups: { firstDay: Date; days: number; value: number }[] = [];
	snapshot.counts.forEach((count, i) => {
		const day = dayOf(snapshot, i);
		const current = groups.at(-1);
		if (current && current.firstDay.getUTCMonth() === day.getUTCMonth() && current.firstDay.getUTCFullYear() === day.getUTCFullYear()) {
			current.days++;
			current.value += count;
		} else {
			groups.push({ firstDay: day, days: 1, value: count });
		}
	});

	const max = Math.max(...groups.map((g) => g.value));
	const partials: string[] = [];
	const months = groups.map((g, i) => {
		const { firstDay } = g;
		// Règle de la maquette : l'instantané couvre 365 jours glissants, donc ses mois extrêmes
		// sont tronqués, même si l'un d'eux tombe pile sur un mois entier.
		const partial = i === 0 || i === groups.length - 1;
		if (partial) {
			const count = partials.length === 0 ? days(g.days, locale) : formatNumber(g.days, locale);
			partials.push(text.partialDays(count, format.shortMonthYear.format(firstDay)));
		}
		return {
			label: `${format.shortMonth.format(firstDay)}${partial ? '*' : ''}`,
			name: `${formatMonth(firstDay, locale)}${partial ? text.incomplete : ''}`,
			title: `${formatMonth(firstDay, locale)} · ${contributions(g.value, locale)}`,
			value: g.value,
			height: max === 0 ? BAR_MIN_HEIGHT : Math.max(BAR_MIN_HEIGHT, Math.round((g.value / max) * BAR_MAX_HEIGHT)),
			showValue: g.value === max || i === groups.length - 1,
		};
	});

	return {
		months,
		partialNote: text.partialNote(partials.join(', ')),
		ariaLabel: text.monthlyAria(months.map((m) => `${m.name} ${formatNumber(m.value, locale)}`).join(', ')),
	};
}

/** Bornes basses des paliers 1 à 4 de la rampe ; le palier 0 est « aucune contribution ». */
const LEVEL_THRESHOLDS = [1, 5, 15, 50];

/** Palier de couleur (0 à 4) d'un compteur journalier. */
const levelOf = (count: number) => LEVEL_THRESHOLDS.filter((t) => count >= t).length;

/** Les 5 paliers de la légende : « 0 », « 1–4 », « 5–14 », « 15–49 », « 50 et plus ». */
export const heatmapLegend = (locale: Locale) =>
	[0, ...LEVEL_THRESHOLDS].map((low, level) => {
		if (level === 0) return { level, label: '0' };
		const next = LEVEL_THRESHOLDS[level];
		return { level, label: next === undefined ? copy[locale].andOver(low) : `${low}–${next - 1}` };
	});

export interface HeatmapCell {
	/** Palier de la rampe, de 0 (aucune contribution) à 4. */
	level: number;
	/** Infobulle : « 3 mars 2026 · 5 contributions ». */
	title: string;
}

export interface MonthLabel {
	/** « janv. » */
	label: string;
	/** Colonne (semaine) de la grille, à partir de 1. */
	column: number;
}

export interface Heatmap {
	/** Nombre de colonnes : une semaine (dimanche → samedi) par colonne. */
	weeks: number;
	/** Une case par jour, dans l'ordre : la grille se remplit colonne par colonne. */
	cells: HeatmapCell[];
	/** Une étiquette sur la première semaine dont le dimanche tombe dans un nouveau mois. */
	monthLabels: MonthLabel[];
	/** « oct. 2025 → oct. 2026 » */
	period: string;
	/** Résumé lu à la place de la grille par les lecteurs d'écran. */
	ariaLabel: string;
}

export function heatmap(snapshot: ContributionSnapshot, { total, record }: ActivityStats, locale: Locale): Heatmap {
	const format = formatters[locale];
	const { counts } = snapshot;
	const weeks = Math.ceil(counts.length / 7);
	const first = dayOf(snapshot, 0);
	const last = dayOf(snapshot, counts.length - 1);

	const monthLabels: MonthLabel[] = [];
	let previousMonth = first.getUTCMonth();
	for (let week = 1; week < weeks; week++) {
		const sunday = dayOf(snapshot, week * 7);
		if (sunday.getUTCMonth() !== previousMonth) {
			monthLabels.push({ label: format.shortMonth.format(sunday), column: week + 1 });
		}
		previousMonth = sunday.getUTCMonth();
	}

	return {
		weeks,
		cells: counts.map((count, i) => ({
			level: levelOf(count),
			title: `${formatDay(dayOf(snapshot, i), locale)} · ${contributions(count, locale)}`,
		})),
		monthLabels,
		period: `${format.shortMonthYear.format(first)} → ${format.shortMonthYear.format(last)}`,
		ariaLabel: copy[locale].heatmapAria(
			formatMonth(first, locale),
			formatMonth(last, locale),
			contributions(total, locale),
			formatNumber(record.count, locale),
			formatDay(record.date, locale),
		),
	};
}
