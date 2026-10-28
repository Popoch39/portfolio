// La Visite de l'Atome (planche 34 · Atome, visite guidée, ADR 0011) : la part de sa CSS qui dépend de chaque
// famille, tirée de `stack`. Le reste de la chorégraphie est écrit dans Atom.astro et Stack.astro.
import { stack } from '../data/profile';

/** Le bloc où joue la Visite, le même que dans la CSS des composants. */
const played = (css: string) =>
	`@media (prefers-reduced-motion:no-preference) and (min-height:500px) and ((min-width:900px) or (min-height:640px)){@supports (animation-timeline:view()) and (animation-range:entry) and (timeline-scope:--visit){${css}}}`;

// Les plages de la planche, en part de la piste : toutes les familles s'estompent (62–65 %) puis se
// rallument (94–97 %) ; entre les deux, chacune s'allume à son tour sur 4 %, à pleine opacité de 22 à 78 %
// de sa plage. Sa légende apparaît sur les 8 % qui précèdent son repère.
const DIM = [62, 65] as const;
const UNDIM = [94, 97] as const;
const LIT = 64;
const LIT_LENGTH = 4;
const PEAK = [0.22, 0.78] as const;
const SHOW = 8;

/** Une opacité `[a, b]` : a + b × `--lo`, l'opacité estompée (celle de l'Atome ou de la légende). */
type Fade = readonly [number, number];

/**
 * L'opacité d'une famille à l'instant `t` (en % de la piste), telle que la planche la compose : l'allumage
 * l'emporte sur l'estompe pendant sa plage. `before` : juste avant `t`, là où l'allumage commence.
 */
function fadeAt(t: number, lit: number, before = false): Fade {
	if (t >= lit && t <= lit + LIT_LENGTH && !(before && t === lit)) {
		const p = (t - lit) / LIT_LENGTH;
		const on = p < PEAK[0] ? p / PEAK[0] : p > PEAK[1] ? (1 - p) / (1 - PEAK[1]) : 1;
		return [on, 1 - on];
	}
	const dim = Math.min(1, Math.max(0, (t - DIM[0]) / (DIM[1] - DIM[0])));
	const undim = Math.min(1, Math.max(0, (t - UNDIM[0]) / (UNDIM[1] - UNDIM[0])));
	const f = dim - undim;
	return [1 - f, f];
}

const round = (n: number, digits: number) => String(+n.toFixed(digits));
const css = (fade: Fade) => {
	const [a, b] = fade.map((n) => round(n, 4));
	return b === '0' ? a : a === '0' ? 'var(--lo)' : `calc(${a} + ${b}*var(--lo))`;
};

/**
 * L'estompe et l'allumage d'une famille en une seule animation d'opacité, de 62 à 97 % : deux animations
 * de la même propriété sur un élément ne seraient plus jouées par le compositeur. Les étapes sont celles
 * de la planche ; la première famille, allumée avant la fin de l'estompe, y saute d'une opacité à l'autre.
 */
function fadeKeyframes(name: string, offset: number) {
	const lit = LIT + offset;
	const times = [DIM[0], DIM[1], lit, lit + PEAK[0] * LIT_LENGTH, lit + PEAK[1] * LIT_LENGTH, lit + LIT_LENGTH, UNDIM[0], UNDIM[1]];
	const at = (t: number) => ((t - DIM[0]) / (UNDIM[1] - DIM[0])) * 100;
	const steps = new Map<string, string[]>();
	const add = (offset: number, fade: Fade) => {
		const value = css(fade);
		steps.set(value, [...(steps.get(value) ?? []), `${round(offset, 2)}%`]);
	};
	for (const t of [...new Set(times)].sort((x, y) => x - y)) {
		const left = fadeAt(t, lit, true);
		const right = fadeAt(t, lit);
		if (css(left) !== css(right)) add(at(t) - 0.01, left);
		add(at(t), right);
	}
	return `@keyframes ${name}{${[...steps].map(([value, offsets]) => `${offsets.join(',')}{opacity:${value}}`).join('')}}`;
}

const timeline = 'animation-timeline:--visit';
const fade = `animation-range:contain ${DIM[0]}% contain ${UNDIM[1]}%`;

/**
 * Par famille : son estompe et son allumage, sur sa Bague (calques, avec leur échelle pendant le montage ;
 * Pastilles grossies et avancées) et sur sa ligne de la légende (texte, trait bleu) ; l'apparition de sa
 * ligne. La géométrie de sa Bague au départ et à mi-course est dans celle de l'Atome.
 */
export const visitSheet = played(
	stack
		.map(({ ring }, k) => {
			const fadeName = `visit-o${k}`;
			const lit = `contain ${LIT + ring.offset}% contain ${LIT + ring.offset + LIT_LENGTH}%`;
			return [
				fadeKeyframes(fadeName, ring.offset),
				`.atom .ring-${k} .layer{animation:auto ${fadeName} linear both,auto visit-band cubic-bezier(.5,0,.25,1) both;${timeline};${fade},contain var(--g0) contain var(--g1)}`,
				`.stack .line-${k}>*{animation:auto ${fadeName} linear both;${timeline};${fade}}`,
				`.atom .ring-${k} .chip{animation:auto ${fadeName} linear both,auto visit-lit linear;${timeline};${fade},${lit}}`,
				`.stack .line-${k}{animation:auto visit-show cubic-bezier(.2,.7,.2,1) both;${timeline};animation-range:contain ${ring.legend - SHOW}% contain ${ring.legend}%}`,
				`.stack .line-${k}::after{animation:auto visit-bar linear;${timeline};animation-range:${lit}}`,
			].join('');
		})
		.join(''),
);
