// Le repli des scènes (ADR 0009), importé par le module de l'accueil dans les navigateurs sans
// animations pilotées par le défilement (Firefox aujourd'hui). Il ne rejoue aucune chorégraphie : il
// rend à ces navigateurs la CSS des scènes, puis règle chacune de leurs animations d'après la
// progression de sa scène, une fois par image. Il n'en nomme aucune : la CSS reste la seule source des
// chorégraphies, pour Chrome comme pour lui, et chaque scène se déclare sur sa piste (`data-timeline`,
// sa ligne de temps ; `data-prefix`, celui de ses animations).

// La piste de chaque scène : un repère haut de la scène et d'un écran, dont la plage `contain` est le
// temps où la scène reste collée. Elle est posée dans l'enveloppe de la scène, son parent, qui tient
// aussi ce que la scène épingle avec elle (Projets, sous la Plongée), mais hors de l'épingle : une
// ligne de temps sous une épingle s'allongerait de sa course.
const scenes = [...document.querySelectorAll<HTMLElement>('[data-timeline]')].map((track) => ({
	track,
	prefix: track.dataset.prefix!,
	top: 0,
	length: 1,
}));
type Scene = (typeof scenes)[number];

// La place du lecteur, relevée avant que les scènes ne prennent la leur dans la page : la dernière
// qu'il a déjà passée (ancre, restauration du défilement), c'est-à-dire dont la scène, qui porte la
// classe de son préfixe (`dive-scene`), est au-dessus de l'écran, même s'il est encore dans ce qu'elle
// épingle avec elle ; et le bas de son enveloppe. Lui seul ne bouge qu'avec les scènes : ce qui est
// épinglé se décale selon le défilement.
const passed = scenes
	.filter(({ track, prefix }) => track.parentElement!.querySelector(`.${prefix}scene`)!.getBoundingClientRect().bottom < 1)
	.pop()?.track.parentElement;
const bottom = passed?.getBoundingClientRect().bottom;

// La CSS des scènes, et elle seule (chaque `@supports` qui nomme la ligne de temps d'une scène), est
// celle de Chrome lue autrement : la ligne de temps, inconnue, devient une pause ; la plage et la portée
// deviennent des propriétés personnalisées, ce qui ouvre le `@supports` et garde la plage de chaque
// animation lisible dans le style calculé ; la durée `auto`, inconnue aussi, qui rendrait tout le
// raccourci invalide, devient une seconde. Chaque bloc n'est lu qu'une fois, même s'il nomme deux scènes.
const scope = RegExp(`@supports[^{]*(${scenes.map(({ track }) => track.dataset.timeline).join('|')})(?![\\w-])`);
for (const style of document.querySelectorAll('style')) {
	let css = style.textContent!;
	// La recherche reprend derrière le dernier bloc réécrit ; une balise sans bloc reste intacte, sans
	// que le navigateur relise sa CSS.
	let from = 0;
	for (let start; (start = css.slice(from).search(scope)) >= 0; ) {
		start += from;
		let end = css.indexOf('{', start);
		for (let depth = 1; depth; ) depth += css[++end] == '{' ? 1 : css[end] == '}' ? -1 : 0;
		const block = css
			.slice(start, ++end)
			.replace(/animation:[^;}]+/g, (shorthand) => shorthand.replace(/\bauto\b/g, '1s'))
			.replace(/animation-timeline:\s*[\w-]+(\(\))?/g, 'animation-play-state:paused')
			.replace(/animation-range|timeline-scope/g, '--$&');
		css = css.slice(0, start) + block + css.slice(end);
		from = start + block.length;
	}
	if (from) style.textContent = css;
}
// Déjà sous une scène : celles qui prennent leur place au-dessus ne doivent pas ramener la page en
// arrière. Le bas de la dernière passée revient à sa place à l'écran, ce qui fait défiler la page de
// tout ce que les scènes au-dessus du lecteur ont grandi ; mesuré à l'écran, il ne dépend pas de ce que
// l'ancrage du défilement aurait déjà compensé.
if (passed) scrollTo(0, passed.getBoundingClientRect().bottom + scrollY - bottom!);

// Les animations réglées et leur scène, gardées ici plutôt que relues à chaque image : une animation
// sans remplissage passée sa plage sort de `getAnimations()`, et il faut pouvoir la reprendre en remontant.
const animations = new Map<CSSAnimation, Scene>();
let frame = 0;

// Une borne de plage `contain`, en part de la scène. Le navigateur calcule l'expression, `calc()`
// compris, le pourcentage valant la longueur de la scène ; `scroll-margin-top` ne prend que des
// longueurs et ne change rien au repère.
const shareOf = ({ track, length }: Scene, bound: string) => {
	track.style.scrollMarginTop = `calc(${bound.replace(/%/g, `*${length / 100}px`)})`;
	return parseFloat(getComputedStyle(track).scrollMarginTop) / length;
};

// La plage d'une animation, lue dans la liste de son élément, devient son délai et sa durée : une
// seconde vaut sa scène, et la régler revient à régler son avancement.
const retime = (scene: Scene, animation: CSSAnimation) => {
	const effect = animation.effect as KeyframeEffect;
	const style = getComputedStyle(effect.target!, effect.pseudoElement);
	const ranges = style.getPropertyValue('--animation-range').split(/,(?![^(]*\))/);
	// Plus courte que la liste des noms, la liste des plages se répète, comme en CSS.
	const range = ranges[style.animationName.split(', ').indexOf(animation.animationName) % ranges.length] ?? '';
	// Le minifieur écrit `contain contain 40%` pour 0–40 %, et `contain 88%` pour 88–100 %.
	const [, first, last] = range.split(/\s*contain\s*/);
	const delay = shareOf(scene, first || '0%');
	effect.updateTiming({ delay: delay * 1000, duration: (shareOf(scene, last || '100%') - delay) * 1000 });
};

// Chacune à la progression de sa scène, une seconde valant toute la scène.
const seek = () => {
	frame = 0;
	animations.forEach(({ top, length }, animation) => {
		// Annulée par la CSS (mouvement réduit en cours de route) : la régler la ferait revivre.
		if (animation.playState == 'idle') animations.delete(animation);
		else animation.currentTime = ((scrollY - top) / length) * 1000;
	});
};

// Une fois par image au plus, avant qu'elle soit peinte.
const request = () => {
	frame ||= requestAnimationFrame(seek);
};

// Les animations des scènes, reconnues au préfixe de chacune, prises une fois, puis à chaque naissance
// (à la fin du Lancement).
const collect = () => {
	for (const animation of document.getAnimations())
		if (animation instanceof CSSAnimation && !animations.has(animation)) {
			const scene = scenes.find(({ prefix }) => animation.animationName.startsWith(prefix));
			if (scene) {
				animations.set(animation, scene);
				retime(scene, animation);
			}
		}
	request();
};

const measure = () => {
	for (const scene of scenes) {
		scene.top = scene.track.getBoundingClientRect().top + scrollY;
		scene.length = scene.track.offsetHeight - document.documentElement.clientHeight;
	}
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
