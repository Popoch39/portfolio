// :checkhealth (#61) : les Core Web Vitals de la visite, présentés comme le :checkhealth de Neovim, une
// section par mesure et une puce par verdict. La Lunette n'est importée qu'à la première commande : ce
// qui précède se lit dans le tampon du navigateur (`buffered`), et l'observation continue ensuite, tant
// que la page vit.
import { formats, type Locale, type Localized } from '../lib/i18n.ts';

/** Absente de lib.dom : l'API Layout Instability n'est qu'un brouillon du WICG. */
interface LayoutShift extends PerformanceEntry {
	value: number;
	hadRecentInput: boolean;
}

const isShift = (entry: PerformanceEntry): entry is LayoutShift => 'hadRecentInput' in entry;
const isEvent = (entry: PerformanceEntry): entry is PerformanceEventTiming => 'interactionId' in entry;
const isPaint = (entry: PerformanceEntry): entry is PerformanceEntry => entry.entryType === 'largest-contentful-paint';

const supports = (type: string) => PerformanceObserver.supportedEntryTypes?.includes(type) ?? false;

/** Ce que le navigateur a remis depuis le chargement de la page ; `flush` y verse ce qu'il garde encore. */
const flushes: (() => void)[] = [];

function watch<T extends PerformanceEntry>(type: string, keep: (entry: PerformanceEntry) => entry is T): T[] {
	const store: T[] = [];
	if (!supports(type)) return store;
	const add = (entries: PerformanceEntryList) => store.push(...entries.filter(keep));
	const observer = new PerformanceObserver((list) => add(list.getEntries()));
	// Le tampon garde la première interaction, et les suivantes à partir de 104 ms ; dès l'import de la
	// Lunette, le seuil descend au minimum permis, 16 ms. `durationThreshold` manque à lib.dom.
	const init: PerformanceObserverInit & { durationThreshold: number } = { type, buffered: true, durationThreshold: 16 };
	observer.observe(init);
	flushes.push(() => add(observer.takeRecords()));
	return store;
}

const paints = watch('largest-contentful-paint', isPaint);
const shifts = watch('layout-shift', isShift);
const inputs = watch('first-input', isEvent);
const events = watch('event', isEvent);

/**
 * Les moments où la Lunette était demandée ou ouverte : la touche qui l'ouvre, la frappe et Entrée sont
 * les siennes, pas celles de la page, que :checkhealth mesure. La première ouverture commence au
 * téléchargement de ce morceau, que la touche lance ; les suivantes à l'appel d'`opened`, pendant
 * elle. `lead` couvre le début de la touche : la Maj ou le Ctrl enfoncé avant, le pointerdown d'un clic.
 */
const periods: { start: number; end: number }[] = [];
const requested = performance.getEntriesByName(import.meta.url)[0]?.startTime;
const lead = 500;

export function opened() {
	const now = performance.now();
	periods.push({ start: periods.length ? now : Math.min(requested ?? now, now), end: Infinity });
}

export function closed() {
	const period = periods.at(-1);
	if (period) period.end = performance.now();
}

const ofLunette = ({ startTime, duration }: PerformanceEntry) =>
	periods.some(({ start, end }) => startTime <= end && startTime + duration >= start - lead);

type Verdict = 'good' | 'improve' | 'poor';

interface Metric {
	name: string;
	/** Les seuils de Google : bon jusqu'au premier, mauvais au-delà du second. */
	limits: [number, number];
	format: (value: number, locale: Locale) => string;
	/** La valeur de la visite, ou la raison de son absence. */
	measure: () => number | Localized<string>;
}

const number = (value: number, locale: Locale, digits: [number, number]) =>
	new Intl.NumberFormat(formats[locale].intl, { minimumFractionDigits: digits[0], maximumFractionDigits: digits[1] }).format(value);

const words = {
	intro: {
		fr: 'Les Core Web Vitals de cette visite, mesurés par votre navigateur.',
		en: 'The Core Web Vitals of this visit, as measured by your browser.',
	},
	threshold: { fr: 'seuil', en: 'threshold' },
	good: { fr: 'ok', en: 'ok' },
	improve: { fr: 'à améliorer', en: 'needs improvement' },
	poor: { fr: 'mauvais', en: 'poor' },
	unsupported: { fr: 'indisponible : ce navigateur ne la mesure pas', en: 'unavailable: this browser does not measure it' },
	noPaint: { fr: 'indisponible : aucun affichage mesuré', en: 'unavailable: no paint measured' },
	noInteraction: { fr: 'indisponible : aucune interaction', en: 'unavailable: no interaction' },
} satisfies Record<string, Localized<string>>;

/**
 * Les sessions de décalages, comme le CLS de Chrome : des décalages à moins d'une seconde les uns des
 * autres, sur cinq secondes au plus ; le CLS est la pire. Un décalage qui suit une saisie ne compte pas.
 */
function cls(): number {
	let worst = 0;
	let session = 0;
	let first = -Infinity;
	let last = -Infinity;
	for (const { startTime, value, hadRecentInput } of shifts) {
		if (hadRecentInput) continue;
		if (startTime - last < 1000 && startTime - first < 5000) session += value;
		else [session, first] = [value, startTime];
		last = startTime;
		worst = Math.max(worst, session);
	}
	return worst;
}

/**
 * La plus longue interaction de la page, hors de la Lunette : l'INP tant qu'il y en a moins de
 * cinquante. Les entrées sans `interactionId` (survols) ne sont pas des interactions.
 */
function inp(): number | undefined {
	const durations = [...inputs, ...events].filter((e) => (e.interactionId > 0 || e.entryType === 'first-input') && !ofLunette(e)).map((e) => e.duration);
	return durations.length ? Math.max(...durations) : undefined;
}

const metrics: Metric[] = [
	{
		name: 'Largest Contentful Paint (LCP)',
		limits: [2500, 4000],
		format: (ms, locale) => `${number(ms / 1000, locale, [1, 2])} s`,
		measure: () => (supports('largest-contentful-paint') ? (paints.at(-1)?.startTime ?? words.noPaint) : words.unsupported),
	},
	{
		name: 'Cumulative Layout Shift (CLS)',
		limits: [0.1, 0.25],
		format: (value, locale) => number(value, locale, [2, 3]),
		// Aucun décalage est une vraie mesure : zéro.
		measure: () => (supports('layout-shift') ? cls() : words.unsupported),
	},
	{
		name: 'Interaction to Next Paint (INP)',
		limits: [200, 500],
		format: (ms, locale) => `${number(ms, locale, [0, 0])} ms`,
		measure: () => (supports('event') ? (inp() ?? words.noInteraction) : words.unsupported),
	},
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]) {
	const node = document.createElement(tag);
	node.className = className;
	node.append(...children);
	return node;
}

/** La sortie de :checkhealth pour le Volet, mesurée à l'instant. */
export function health(locale: Locale): Node[] {
	for (const flush of flushes) flush();
	return [
		el('p', 'intro', words.intro[locale]),
		...metrics.flatMap(({ name, limits: [good, poor], format, measure }) => {
			const value = measure();
			let line: Node;
			if (typeof value === 'number') {
				const verdict: Verdict = value <= good ? 'good' : value <= poor ? 'improve' : 'poor';
				const badge = el('b', 'verdict', words[verdict][locale]);
				badge.dataset.verdict = verdict;
				line = el('li', '', badge, ` ${format(value, locale)} · ${words.threshold[locale]} ${format(good, locale)}`);
			} else line = el('li', 'unavailable', value[locale]);
			// Les sections de Neovim : un titre fini par « ~ », puis ses puces.
			return [el('h3', '', `${name} ~`), el('ul', '', line)];
		}),
	];
}
