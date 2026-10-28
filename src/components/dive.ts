// Le repli de la Plongée (ADR 0009), importé par le module de l'accueil dans les navigateurs sans
// animations pilotées par le défilement (Firefox aujourd'hui). Il ne rejoue pas la chorégraphie : il
// rend à ces navigateurs la CSS de la scène, puis règle chacune de ses animations `dive-` d'après la
// progression du défilement, une fois par image. Il n'en nomme aucune : la CSS reste la seule source
// de la chorégraphie, pour Chrome comme pour lui.

// La place du lecteur, relevée avant que la scène ne prenne la sienne dans la page.
const projects = document.querySelector<HTMLElement>('.dive-next')!;
const scrolled = scrollY;
const flowTop = projects.offsetTop;
const reached = projects.getBoundingClientRect().top < 1;

// La CSS de la scène, et elle seule (son `@supports`, qui l'enferme), est celle de Chrome lue
// autrement : la ligne de temps, inconnue, devient une pause ; la plage et la portée deviennent des
// propriétés personnalisées, ce qui ouvre le `@supports` et garde la plage de chaque animation lisible
// dans le style calculé ; la durée `auto`, inconnue aussi, qui rendrait tout le raccourci invalide,
// devient une seconde.
for (const style of document.querySelectorAll('style')) {
	const css = style.textContent!;
	const start = css.search(/@supports[^{]*--dive/);
	if (start < 0) continue;
	let end = css.indexOf('{', start);
	for (let depth = 1; depth; ) depth += css[++end] == '{' ? 1 : css[end] == '}' ? -1 : 0;
	style.textContent =
		css.slice(0, start) +
		css
			.slice(start, ++end)
			.replace(/animation:[^;}]+/g, (shorthand) => shorthand.replace(/\bauto\b/g, '1s'))
			.replace(/animation-timeline:[\w-]+(\(\))?/g, 'animation-play-state:paused')
			.replace(/animation-range|timeline-scope/g, '--$&') +
		css.slice(end);
}
// Déjà dans Projets ou plus bas (ancre, restauration du défilement) : la scène, qui prend sa place
// au-dessus, ne doit pas ramener la page en pleine Plongée. Compté depuis la position d'avant, au cas
// où l'ancrage du défilement aurait déjà compensé.
if (reached) scrollTo(0, scrolled + projects.offsetTop - flowTop);

// Le repère de la scène, haut d'un écran de plus qu'elle : sa plage `contain` est le temps où elle
// reste collée.
const track = document.querySelector<HTMLElement>('.dive-track')!;
// Les animations réglées, gardées ici plutôt que relues à chaque image : une animation sans
// remplissage passée sa plage sort de `getAnimations()`, et il faut pouvoir la reprendre en remontant.
const animations = new Set<CSSAnimation>();
let sceneTop = 0;
let sceneLength = 1;
let frame = 0;

// Une borne de plage `contain`, en part de la scène. Le navigateur calcule l'expression, `calc()`
// compris, le pourcentage valant la longueur de la scène ; `scroll-margin-top` ne prend que des
// longueurs et ne change rien au repère.
const shareOf = (bound: string) => {
	track.style.scrollMarginTop = `calc(${bound.replace(/%/g, `*${sceneLength / 100}px`)})`;
	return parseFloat(getComputedStyle(track).scrollMarginTop) / sceneLength;
};

// La plage d'une animation, lue dans la liste de son élément, devient son délai et sa durée : une
// seconde vaut la scène, et la régler revient à régler son avancement.
const retime = (animation: CSSAnimation) => {
	const effect = animation.effect as KeyframeEffect;
	const style = getComputedStyle(effect.target!, effect.pseudoElement);
	const ranges = style.getPropertyValue('--animation-range').split(/,(?![^(]*\))/);
	// Plus courte que la liste des noms, la liste des plages se répète, comme en CSS.
	const range = ranges[style.animationName.split(', ').indexOf(animation.animationName) % ranges.length] ?? '';
	// Le minifieur écrit `contain contain 40%` pour 0–40 %, et `contain 88%` pour 88–100 %.
	const [, first, last] = range.split(/\s*contain\s*/);
	const delay = shareOf(first || '0%');
	effect.updateTiming({ delay: delay * 1000, duration: (shareOf(last || '100%') - delay) * 1000 });
};

// Le même instant pour toutes : la progression de la scène, une seconde valant toute la scène.
const seek = () => {
	frame = 0;
	const time = ((scrollY - sceneTop) / sceneLength) * 1000;
	for (const animation of animations)
		// Annulée par la CSS (mouvement réduit en cours de route) : la régler la ferait revivre.
		if (animation.playState == 'idle') animations.delete(animation);
		else animation.currentTime = time;
};

// Une fois par image au plus, avant qu'elle soit peinte.
const request = () => {
	frame ||= requestAnimationFrame(seek);
};

// Les animations `dive-` de la page, prises une fois, puis à chaque naissance (à la fin du Lancement).
const collect = () => {
	for (const animation of document.getAnimations())
		if (animation instanceof CSSAnimation && animation.animationName.startsWith('dive-') && !animations.has(animation)) {
			animations.add(animation);
			retime(animation);
		}
	request();
};

const measure = () => {
	sceneTop = track.getBoundingClientRect().top + scrollY;
	sceneLength = track.offsetHeight - document.documentElement.clientHeight;
	animations.forEach(retime);
	request();
};

addEventListener('scroll', request);
addEventListener('resize', measure);
addEventListener('animationstart', collect);
measure();
collect();

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
