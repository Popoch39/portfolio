// Calculs purs sur l'instantané des contributions GitHub, portés du `renderVals()` de la
// maquette D1. Tout est calculé en UTC : le jour d'une contribution ne dépend pas du
// fuseau de la machine de build.
import type { ContributionSnapshot } from '../data/github-snapshot';

const DAY_MS = 86_400_000;

const numberFormat = new Intl.NumberFormat('fr-FR');
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonthYearFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortMonthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

/** « 2 688 », avec l'espace fine insécable du français. */
export const formatNumber = (n: number) => numberFormat.format(n);

/** « 7 octobre 2026 ». */
export const formatDay = (date: Date) => dayFormat.format(date);

/** « octobre 2025 ». */
const formatMonth = (date: Date) => monthFormat.format(date);

/** « jour », « jours » : en français, 0 et 1 restent au singulier. */
const plural = (count: number, word: string) => `${word}${count > 1 ? 's' : ''}`;

/** « aucune contribution », « 1 contribution », « 2 688 contributions ». */
function contributions(count: number): string {
	if (count === 0) return 'aucune contribution';
	return `${formatNumber(count)} ${plural(count, 'contribution')}`;
}

/** « d’octobre », « de mars » : élision devant une voyelle. */
const ofMonth = (month: string) => (/^[aeiouyéè]/.test(month) ? `d’${month}` : `de ${month}`);

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

export function monthlyTotals(snapshot: ContributionSnapshot): MonthlyTotals {
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
			const days = partials.length === 0 ? `${g.days} ${plural(g.days, 'jour')}` : String(g.days);
			partials.push(`${days} en ${shortMonthYearFormat.format(firstDay)}`);
		}
		return {
			label: `${shortMonthFormat.format(firstDay)}${partial ? '*' : ''}`,
			name: `${formatMonth(firstDay)}${partial ? ' (incomplet)' : ''}`,
			title: `${formatMonth(firstDay)} · ${contributions(g.value)}`,
			value: g.value,
			height: max === 0 ? BAR_MIN_HEIGHT : Math.max(BAR_MIN_HEIGHT, Math.round((g.value / max) * BAR_MAX_HEIGHT)),
			showValue: g.value === max || i === groups.length - 1,
		};
	});

	return {
		months,
		partialNote: `* mois incomplets : ${partials.join(', ')}`,
		ariaLabel: `Contributions par mois : ${months.map((m) => `${m.name} ${formatNumber(m.value)}`).join(', ')}.`,
	};
}

/** Bornes basses des paliers 1 à 4 de la rampe ; le palier 0 est « aucune contribution ». */
const LEVEL_THRESHOLDS = [1, 5, 15, 50];

/** Palier de couleur (0 à 4) d'un compteur journalier. */
const levelOf = (count: number) => LEVEL_THRESHOLDS.filter((t) => count >= t).length;

/** Les 5 paliers de la légende : « 0 », « 1–4 », « 5–14 », « 15–49 », « 50 et plus ». */
export const heatmapLegend = [0, ...LEVEL_THRESHOLDS].map((low, level) => {
	if (level === 0) return { level, label: '0' };
	const next = LEVEL_THRESHOLDS[level];
	return { level, label: next === undefined ? `${low} et plus` : `${low}–${next - 1}` };
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

export function heatmap(snapshot: ContributionSnapshot, { total, record }: ActivityStats): Heatmap {
	const { counts } = snapshot;
	const weeks = Math.ceil(counts.length / 7);
	const first = dayOf(snapshot, 0);
	const last = dayOf(snapshot, counts.length - 1);

	const monthLabels: MonthLabel[] = [];
	let previousMonth = first.getUTCMonth();
	for (let week = 1; week < weeks; week++) {
		const sunday = dayOf(snapshot, week * 7);
		if (sunday.getUTCMonth() !== previousMonth) {
			monthLabels.push({ label: shortMonthFormat.format(sunday), column: week + 1 });
		}
		previousMonth = sunday.getUTCMonth();
	}

	return {
		weeks,
		cells: counts.map((count, i) => ({
			level: levelOf(count),
			title: `${formatDay(dayOf(snapshot, i))} · ${contributions(count)}`,
		})),
		monthLabels,
		period: `${shortMonthYearFormat.format(first)} → ${shortMonthYearFormat.format(last)}`,
		ariaLabel:
			`Calendrier des contributions GitHub, ${ofMonth(formatMonth(first))} à ${formatMonth(last)} : ` +
			`${contributions(total)}, record de ${formatNumber(record.count)} le ${formatDay(record.date)}.`,
	};
}
