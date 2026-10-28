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
 * Le tassement occupe 28–56 % de la scène, `main` 62–84 % (planche H2). Chaque semaine y joue sur `SPAN`
 * du temps, la première au début, la dernière à la fin : la vague parcourt l'année de la gauche vers la
 * droite.
 */
const PACK = [28, 56] as const;
const MAIN = [62, 84] as const;
const SPAN = 1 / 1.6;
const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';

/** Une animation de la scène, sur sa ligne de temps ; sa plage vient d'une autre règle. */
const play = (selector: string, keyframes: string, easing = EASE_IN_OUT) => `${selector}{animation:auto ${keyframes} ${easing} both;animation-timeline:--tri}`;

/**
 * La place des mois au-dessus de leur semaine, et la plage de chaque semaine dans le tassement et dans
 * `main`, en pourcentages littéraux de la scène (ADR 0014) : le repli des scènes les lit dans le style
 * calculé. Les animations sont posées ici, avant leurs plages : le raccourci `animation` remet la plage à
 * zéro, et ces plages doivent passer après lui.
 */
export function triSheet({ weeks, months }: Tri) {
	const range = ([from, to]: readonly [number, number], week: number) => {
		const start = from + (to - from) * (1 - SPAN) * (week / weeks.length);
		return `animation-range:contain ${percent(start)} contain ${percent(start + (to - from) * SPAN)}`;
	};
	// Le trait d'une semaine se trace à mi-course de sa plage, dans le pas qui la sépare de la précédente :
	// les segments se suivent bout à bout et le trait avance d'un seul tenant, au lieu de pousser partout à
	// la fois comme les nœuds.
	const step = (1 - SPAN) / weeks.length / SPAN;
	const draw = `@keyframes tri-draw{0%,${percent((0.5 - step) * 100)}{scale:0 1}50%{scale:1}}`;
	return played(
		[
			...months.map(({ week }, i) => `.tri-months>:nth-child(${i + 1}){left:${LEFT + week * PITCH}px}`),
			// Seules les cases qui changent de rang, celles qui portent le rang tassé (`k…`), sont animées : chaque
			// animation coûte au compositeur et au style à chaque image (ADR 0015).
			play('.tri-move>span>[class*=" k"]', 'tri-pack'),
			...weeks.map((_, i) => `.tri-move>:nth-child(${i + 1})>i{${range(PACK, i)}}`),
			// `main` : une animation par colonne de cases plutôt que par case. Les Jours actifs rejoignent le nœud
			// de leur semaine avec leur colonne, qui rétrécit vers lui.
			play('.tri-flat>span', 'tri-gather'),
			play('.tri-empty>span', 'tri-hide'),
			play('.tri-node', 'tri-grow'),
			draw,
			play('.tri-week[data-link]::before', 'tri-draw', 'linear'),
			play('.tri-pause', 'tri-show', 'linear'),
			...weeks.map((_, i) => `.tri-move>:nth-child(${i + 1}),.tri-week:nth-child(${i + 1})>*,.tri-week:nth-child(${i + 1})::before{${range(MAIN, i)}}`),
		].join(''),
	);
}
