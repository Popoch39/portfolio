// La Frise (planche D · Maquette inclinée, spec #98, ADR 0014) : sa géométrie, tirée des Commits au build.
// Le plan est en pixels de la planche (1 280 × 720) ; la scène le met à l'échelle de l'écran.
import { commits, type Commit } from '../data/profile';

/** Pixels du plan par an, et place du couloir des Branches (au-dessus de `main`). */
const YEAR = 440;
const LANE = -180;
/** Les poignées des courbes de bifurcation et de retour. */
const HANDLE = 90;
/** Le retour d'une Branche commence un quart d'an avant sa fusion. */
const RETURN = 0.25;
/** La course de HEAD sur la Frise, en années : un peu avant le premier Commit, un peu après le dernier. */
const COURSE = [2018.25, 2026.5] as const;
/** La largeur de l'enveloppe qui révèle le tracé plein : tout le tracé y tient. */
export const REVEAL = 4000;

const round = (n: number) => Math.round(n * 10) / 10;
const xOf = (at: number) => round((at - 2018) * YEAR);
const yOf = (commit: Commit) => (commit.branch === 'main' ? 0 : LANE);

/**
 * Le tracé du git graph : `main` du premier Commit à HEAD, puis chaque Branche, qui part du Commit de
 * `main` précédant sa bifurcation, longe le couloir et revient à la fusion suivante.
 */
function graph() {
	const head = commits[commits.length - 1];
	const paths = [`M${xOf(commits[0].at)} 0H${xOf(head.at)}`];
	commits.forEach((commit, i) => {
		if (commit.kind !== 'branch') return;
		const from = commits.slice(0, i).findLast((c) => c.branch === 'main')!;
		const merge = commits.slice(i).find((c) => c.kind === 'merge')!;
		const [a, b, e, m] = [from.at, commit.at, merge.at - RETURN, merge.at].map(xOf);
		paths.push(
			`M${a} 0C${a + HANDLE} 0 ${b - HANDLE} ${LANE} ${b} ${LANE}H${e}C${e + HANDLE} ${LANE} ${m - HANDLE} 0 ${m} 0`,
		);
	});
	return paths.join('');
}

export const friseGraph = graph();

/** Le bloc où joue la Frise, le même que dans la CSS de Career.astro. */
const played = (css: string) =>
	`@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()) and (animation-range:entry) and (timeline-scope:--frise){${css}}}`;

const [start, end] = COURSE.map(xOf);

/**
 * La place de chaque Commit sur le plan, et les trois translations de la scène. HEAD reste à l'origine du
 * plan : le rail recule de sa position. L'enveloppe du tracé plein, large de `REVEAL`, finit sur HEAD ; le
 * tracé qu'elle contient recule d'autant, et reste donc à sa place sur le rail.
 */
export const friseSheet = played(
	[
		...commits.map((commit, i) => `.frise .commit:nth-child(${i + 1}){left:${xOf(commit.at)}px;top:${yOf(commit)}px}`),
		`@keyframes frise-rail{from{translate:${-start}px}to{translate:${-end}px}}`,
		`@keyframes frise-reveal{from{translate:${start - REVEAL}px}to{translate:${end - REVEAL}px}}`,
		`@keyframes frise-built{from{translate:${REVEAL - start}px}to{translate:${REVEAL - end}px}}`,
	].join(''),
);
