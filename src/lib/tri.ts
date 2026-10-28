// La scène du Tri (spec #107, ADR 0015) : sa géométrie et ses plages, tirées de l'instantané au build. La
// vue est en pixels de la planche H2 (le calendrier à 20 px par case) ; la scène la met à l'échelle.
import type { Tri } from './activity';

/** Pas du calendrier : une case de 16 px et 4 px de gouttière. */
export const PITCH = 20;
/** Le bord gauche du calendrier dans la vue, comme sur la planche. */
const LEFT = 110;

/** Le bloc où joue le Tri, le même que dans la CSS d'Activity.astro. */
const played = (css: string) =>
	`@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()) and (animation-range:entry) and (timeline-scope:--tri){${css}}}`;

const percent = (n: number) => `${+n.toFixed(3)}%`;

/**
 * Le tassement occupe 28–56 % de la scène (planche H2). Chaque semaine s'y tasse sur `SPAN` du temps, la
 * première au début, la dernière à la fin : la vague parcourt l'année de la gauche vers la droite.
 */
const PACK = [28, 56] as const;
const SPAN = 1 / 1.6;
const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';

/**
 * La place des mois au-dessus de leur semaine, et la plage du tassement de chaque semaine, en pourcentages
 * littéraux de la scène (ADR 0014) : le repli des scènes les lit dans le style calculé.
 */
export function triSheet({ weeks, months }: Tri) {
	const length = PACK[1] - PACK[0];
	const wave = (week: number) => PACK[0] + length * (1 - SPAN) * (week / weeks.length);
	return played(
		[
			...months.map(({ week }, i) => `.tri-months>:nth-child(${i + 1}){left:${LEFT + week * PITCH}px}`),
			// Seules les cases qui changent de rang, celles qui portent le rang tassé (`k…`), sont animées : chaque
			// animation coûte au compositeur et au style à chaque image (ADR 0015).
			`.tri-move>span>[class*=" k"]{animation:auto tri-pack ${EASE_IN_OUT} both;animation-timeline:--tri}`,
			...weeks.map((_, i) => `.tri-move>:nth-child(${i + 1})>i{animation-range:contain ${percent(wave(i))} contain ${percent(wave(i) + length * SPAN)}}`),
		].join(''),
	);
}
