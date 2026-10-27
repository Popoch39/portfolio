// Le repli de la Plongée (ADR 0009), importé par le module de l'accueil dans les navigateurs sans
// animations pilotées par le défilement (Firefox aujourd'hui). Il ne rejoue pas la chorégraphie : il
// rend à ces navigateurs la CSS de la scène, puis règle chacune de ses animations `dive-` d'après la
// progression du défilement, une fois par image. Aucune n'est nommée ici : celles qu'ajoute un ticket
// suivent d'elles-mêmes.

// La place du lecteur, relevée avant que la scène ne prenne la sienne dans la page.
const next = document.querySelector<HTMLElement>('.dive-next')!;
const scrolled = scrollY;
const from = next.offsetTop;
const reached = next.getBoundingClientRect().top < 1;

// La CSS est celle de Chrome, lue autrement : ses propriétés inconnues deviennent des propriétés
// personnalisées, ce qui ouvre son `@supports` et garde lisible la plage de chaque animation ; la durée
// `auto`, inconnue aussi, qui rendrait tout le raccourci invalide, devient une seconde ; à la place de
// la ligne de temps, l'animation est mise en pause.
for (const style of document.querySelectorAll('style')) {
	const css = style.textContent ?? '';
	if (css.includes('--dive'))
		style.textContent = css
			.replace(/animation:[^;}]+/g, (shorthand) => shorthand.replace(/\bauto\b/g, '1s'))
			.replace(/([;{])animation-timeline:/g, '$1animation-play-state:paused;--t:')
			.replace(/animation-range|animation-timeline|timeline-scope/g, '--$&');
}
// Déjà dans Projets ou plus bas (ancre, restauration du défilement) : la scène, qui prend sa place
// au-dessus, ne doit pas ramener la page en pleine Plongée. Compté depuis la position d'avant, au cas
// où l'ancrage du défilement aurait déjà compensé.
if (reached) scrollTo(0, scrolled + next.offsetTop - from);

// Seul l'accueil, qui porte la scène, importe ce module.
const track = document.querySelector<HTMLElement>('.dive-track')!;
// Les animations réglées, gardées ici : une animation sans remplissage passée sa plage sort de
// `getAnimations()`, et il faut pouvoir la reprendre en remontant.
const known = new Set<CSSAnimation>();
let top = 0;
let length = 1;
let frame = 0;

// Une borne de plage `contain`, en part de la scène. Le navigateur calcule l'expression, `calc()`
// compris, le pourcentage valant la longueur de la scène ; `scroll-margin-top` ne prend que des
// longueurs et ne change rien au repère.
const at = (offset: string) => {
	track.style.scrollMarginTop = `calc(${offset.replace(/%/g, `*${length / 100}px`)})`;
	return parseFloat(getComputedStyle(track).scrollMarginTop) / length;
};

// La plage d'une animation, lue dans la liste de son élément, devient son délai et sa durée : une
// seconde vaut la scène, et la régler revient à régler son avancement.
const time = (animation: CSSAnimation) => {
	const effect = animation.effect as KeyframeEffect;
	const style = getComputedStyle(effect.target!, effect.pseudoElement);
	const index = style.animationName.split(', ').indexOf(animation.animationName);
	const ranges = style.getPropertyValue('--animation-range').split(/,(?![^(]*\))/);
	// Plus courte que la liste des noms, la liste des plages se répète, comme en CSS.
	const range = ranges[index % ranges.length] ?? '';
	// Le minifieur écrit `contain contain 40%` pour 0–40 %, et `contain 88%` pour 88–100 %.
	const [, start, end] = range.split(/\s*contain\s*/);
	const from = at(start || '0%');
	effect.updateTiming({ delay: from * 1000, duration: (at(end || '100%') - from) * 1000 });
};

const update = () => {
	frame = 0;
	for (const animation of document.getAnimations())
		if (animation instanceof CSSAnimation && animation.animationName.startsWith('dive-') && !known.has(animation)) {
			known.add(animation);
			time(animation);
		}
	const progress = ((scrollY - top) / length) * 1000;
	for (const animation of known) {
		// Annulée par la CSS (mouvement réduit en cours de route) : la régler la ferait revivre.
		if (animation.playState === 'idle') known.delete(animation);
		else animation.currentTime = progress;
	}
};

// Le repère est haut d'un écran de plus que la scène : sa plage `contain` est le temps où elle reste collée.
const measure = () => {
	top = track.getBoundingClientRect().top + scrollY;
	length = track.offsetHeight - document.documentElement.clientHeight;
	known.forEach(time);
};

const request = () => {
	frame ||= requestAnimationFrame(update);
};

addEventListener('scroll', request, { passive: true });
addEventListener('resize', () => {
	measure();
	request();
});
// Les animations qui naissent après coup, à la fin du Lancement, sont réglées sans attendre le défilement.
addEventListener('animationstart', request);
measure();
update();

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
