// La Frise (planche D · Maquette inclinée, spec #98, ADR 0014) : sa géométrie, tirée des Commits au build.
// Le plan est en pixels de la planche (1 280 × 720) ; la scène le met à l'échelle de l'écran.
import { commits, type Commit } from '../data/profile';

/** Pixels du plan par an, et place des Branches sur le plan (au-dessus de `main`). */
const YEAR = 440;
const BRANCH = -180;
/** Les poignées des courbes de bifurcation et de retour. */
const HANDLE = 90;
/** Le retour d'une Branche commence un quart d'an avant sa fusion. */
const RETURN = 0.25;
/** La course de HEAD sur la Frise, en années : un peu avant le premier Commit, un peu après le dernier. */
const COURSE = [2018.25, 2026.5] as const;
/** Le poteau d'un Commit monte en 0,18 an après le passage de HEAD, en sortie cubique (planche D). */
const RISE = 0.18;
const EASE_OUT = 'cubic-bezier(.33,1,.68,1)';
/** La largeur de l'enveloppe qui révèle le tracé plein : tout le tracé y tient. */
export const REVEAL = 4000;

const round = (n: number) => Math.round(n * 10) / 10;
const xOf = (at: number) => round((at - 2018) * YEAR);
const yOf = (commit: Commit) => (commit.branch === 'main' ? 0 : BRANCH);

/**
 * Le tracé du git graph : `main` du premier Commit à HEAD, puis chaque Branche, qui part du Commit de
 * `main` précédant sa bifurcation, court parallèle à `main` et revient à la fusion suivante.
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
			`M${a} 0C${a + HANDLE} 0 ${b - HANDLE} ${BRANCH} ${b} ${BRANCH}H${e}C${e + HANDLE} ${BRANCH} ${m - HANDLE} 0 ${m} 0`,
		);
	});
	return paths.join('');
}

export const friseGraph = graph();

/** Le bloc où joue la Frise, le même que dans la CSS de Career.astro. */
const played = (css: string) =>
	`@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()) and (animation-range:entry) and (timeline-scope:--frise){${css}}}`;

const [start, end] = COURSE.map(xOf);

/** L'instant où HEAD est à une date, en % de la scène, borné à la scène. */
const share = (at: number) => Math.min(100, Math.max(0, ((at - COURSE[0]) / (COURSE[1] - COURSE[0])) * 100));
const percent = (n: number) => `${+n.toFixed(3)}%`;
const timeline = 'animation-timeline:--frise';
const range = (from: number, to = 100) => `animation-range:contain ${percent(from)} contain ${percent(to)}`;

/** Une courbe d'étiquette : son opacité selon HEAD, et les instants où elle change de pente ou saute. */
type Curve = (commit: Commit, next: number) => { opacity: (head: number, left?: boolean) => number; turns: number[] };

/**
 * Où en est HEAD par rapport au Commit (`reached`) et au suivant (`passed`). `left` donne l'état juste avant
 * `head`, de l'autre côté d'un saut.
 */
const phase = (commit: Commit, next: number, head: number, left: boolean) => {
	const past = (at: number) => (left ? head > at : head >= at);
	return { reached: past(commit.at), passed: past(next) };
};

const PALE = 0.4;
const NEAR = 0.35;
const FADE = 0.5;
const DIM = 0.25;
/**
 * L'opacité de l'étiquette d'un Commit selon HEAD sur un écran large (planche D) : à venir, pâle et de plus en
 * plus quand HEAD approche ; pleine de son passage à celui du Commit suivant (il est alors le Commit actif) ;
 * passée, estompée avec l'écart, jamais sous 0,25.
 */
const wide: Curve = (commit, next) => ({
	opacity(head, left = false) {
		const { reached, passed } = phase(commit, next, head, left);
		if (!reached) return Math.max(0, PALE - NEAR * (commit.at - head));
		return passed ? Math.max(DIM, 1 - FADE * (head - commit.at)) : 1;
	},
	turns: [commit.at - PALE / NEAR, commit.at, next, commit.at + (1 - DIM) / FADE],
});

/**
 * La courbe resserrée d'un écran étroit ou bas (#102) : sur le plan réduit, une étiquette à venir, posée bas
 * sur son poteau replié, croiserait celle du Commit actif. Rien n'est donc allumé avant HEAD ; l'étiquette
 * passée retombe à `DROP` au passage du suivant et s'éteint en `OUT` an, moins que l'écart le plus serré entre
 * deux Commits (0,25 an) : au plus deux étiquettes allumées, une seule pleine. Le Commit actif en grand porte la lecture.
 */
const DROP = 0.3;
const OUT = 0.15;
const tight: Curve = (commit, next) => ({
	opacity(head, left = false) {
		const { reached, passed } = phase(commit, next, head, left);
		if (!reached) return 0;
		return passed ? Math.max(0, DROP * (1 - (head - next) / OUT)) : 1;
	},
	turns: [commit.at - OUT, commit.at, next, next + OUT],
});

/**
 * La courbe d'opacité d'une étiquette en une @keyframes, sur la plage où elle change. Un saut est une
 * marche d'un millième de la plage, qui finit sur l'instant exact où HEAD passe.
 */
function labelKeyframes(name: string, commit: Commit, next: number, curve: Curve) {
	const { opacity, turns } = curve(commit, next);
	const from = Math.max(COURSE[0], Math.min(...turns));
	const to = Math.min(COURSE[1], Math.max(...turns));
	const offset = (at: number) => ((share(at) - share(from)) / (share(to) - share(from))) * 100;
	const css = (value: number) => +value.toFixed(3);
	const steps = [from, ...turns, to]
		.filter((at, k, all) => at >= from && at <= to && all.indexOf(at) === k)
		.sort((a, b) => a - b)
		.flatMap((at) => {
			const [before, after] = [opacity(at, true), opacity(at)];
			const step = `${+offset(at).toFixed(4)}%{opacity:${css(after)}}`;
			return css(before) === css(after) || at === from ? [step] : [`${+(offset(at) - 0.001).toFixed(4)}%{opacity:${css(before)}}`, step];
		});
	return { keyframes: `@keyframes ${name}{${steps.join('')}}`, range: range(share(from), share(to)) };
}

/**
 * Par Commit, tout part de l'instant où HEAD l'atteint (le tracé plein y arrive) : le point se remplit
 * d'un coup (la fusion, elle, reste un anneau) ; le poteau monte, en sortie cubique, et soulève le texte
 * de l'étiquette. Les @keyframes communes sont dans Career.astro.
 */
const choreography = (commit: Commit, i: number) => {
	const nth = `.frise .commit:nth-child(${i + 1})`;
	const passage = share(commit.at);
	const rise = `${timeline};${range(passage, share(commit.at + RISE))}`;
	const label = labelKeyframes(`frise-label-${i + 1}`, commit, commits[i + 1]?.at ?? Infinity, wide);
	return [
		label.keyframes,
		`${nth} .label{animation:auto frise-label-${i + 1} linear both;${timeline};${label.range}}`,
		`${nth}::before,${nth}::after{animation:auto frise-on step-start forwards;${timeline};${range(passage)}}`,
		`${nth} .label::after{animation:auto frise-pole ${EASE_OUT} both;${rise}}`,
		`${nth} .caption{animation:auto frise-lift ${EASE_OUT} both;${rise}}`,
	].join('');
};

/** Le fondu d'un bloc du Commit actif, en % de la scène : plus court que l'écart le plus serré entre deux Commits. */
const SHOW = 1;

/**
 * Le bloc d'un Commit dans le Commit actif en grand : il apparaît en fondu dès que HEAD atteint son Commit,
 * et s'efface dès que HEAD atteint le suivant, pendant que celui du suivant apparaît. Le premier est là dès
 * le début de la scène, le dernier jusqu'à la fin.
 */
const activeStep = (commit: Commit, i: number) => {
	const name = `frise-active-${i + 1}`;
	const from = i === 0 ? 0 : share(commit.at);
	const next = commits[i + 1] && share(commits[i + 1].at);
	const to = next === undefined ? 100 : Math.min(100, next + SHOW);
	const offset = (at: number) => `${+Math.min(100, ((at - from) / (to - from)) * 100).toFixed(4)}%`;
	const steps = [i === 0 ? '0%{opacity:1}' : `0%{opacity:0}${offset(from + SHOW)}{opacity:1}`];
	if (next !== undefined) steps.push(`${offset(next)}{opacity:1}100%{opacity:0}`);
	return `@keyframes ${name}{${steps.join('')}}.frise-step:nth-child(${i + 1}){animation:auto ${name} linear both;${timeline};${range(from, to)}}`;
};

/**
 * La scène d'un écran étroit ou bas (#102) : la même requête que la caméra de Career.astro, qui la répète.
 * Elle reprend l'animation de chaque étiquette, plus loin dans la feuille, avec la courbe resserrée.
 */
const COMPACT = '@container frise (width<640px) or (height<560px)';
const tightLabels = () => {
	const labels = commits.map((commit, i) => labelKeyframes(`frise-tight-${i + 1}`, commit, commits[i + 1]?.at ?? Infinity, tight));
	return [
		...labels.map((label) => label.keyframes),
		`${COMPACT}{${labels.map((label, i) => `.frise .commit:nth-child(${i + 1}) .label{animation:auto frise-tight-${i + 1} linear both;${timeline};${label.range}}`).join('')}}`,
	].join('');
};

/**
 * La place de chaque Commit sur le plan, sa chorégraphie (resserrée sur un écran étroit ou bas), le Commit actif en grand, et les trois translations de la scène. HEAD reste
 * à l'origine du plan : le rail recule de sa position. L'enveloppe du tracé plein, large de `REVEAL`, finit
 * sur HEAD ; le tracé qu'elle contient recule d'autant, et reste donc à sa place sur le rail.
 */
export const friseSheet = played(
	[
		...commits.map((commit, i) => `.frise .commit:nth-child(${i + 1}){left:${xOf(commit.at)}px;top:${yOf(commit)}px}`),
		...commits.map(choreography),
		...commits.map(activeStep),
		tightLabels(),
		`@keyframes frise-rail{from{translate:${-start}px}to{translate:${-end}px}}`,
		`@keyframes frise-reveal{from{translate:${start - REVEAL}px}to{translate:${end - REVEAL}px}}`,
		`@keyframes frise-built{from{translate:${REVEAL - start}px}to{translate:${REVEAL - end}px}}`,
	].join(''),
);
