// Le Glissé (ADR 0013) : un cran de molette lance un glissé amorti d'une seconde environ au lieu de
// faire sauter la page. Le défilement natif avance d'un cran en un éclair puis s'arrête net, et la
// Plongée, qui suit exactement le défilement, avancerait par à-coups ; le défilement lisse du navigateur
// n'a pas d'élan d'un cran à l'autre. Le glissé est donc écrit image par image, ce que permet Projets
// épinglé par la CSS (ADR 0009) : le navigateur applique l'épingle dans la même image que le défilement
// écrit par le script, quand une translation qui le compenserait arrive parfois une image en retard au
// compositeur (Brave sous Wayland).

// En `TAU` millisecondes, la page fait 63 % du chemin vers sa cible : un dixième par image à 60 Hz, et un
// cran arrive en neuf dixièmes de seconde. Amorti sur le temps écoulé, l'élan dure pareil à tout taux
// de rafraîchissement.
const TAU = 160;

// La cible du glissé en cours ; aucune avant le premier cran.
let target = NaN;
// La page telle que la boucle l'a écrite, au pixel près : le navigateur peut l'arrondir.
let shown = 0;
// La page telle que le navigateur l'a posée après cette écriture, arrondie ou non.
let seen = 0;
let last = 0;
let frame = 0;

// Un défilement venu d'ailleurs (clavier, ancre, Lunette, barre de défilement) a bougé la page depuis
// que la boucle l'a posée. Le moindre écart compte : le défilement lisse du navigateur ne la mène parfois
// que d'une fraction de pixel avant l'image suivante, que la boucle réécrirait par-dessus.
const moved = () => scrollY != seen;

const step = (now: number) => {
	frame = 0;
	if (moved()) return;
	shown = target + (shown - target) * Math.exp(-Math.max(0, now - last) / TAU);
	last = now;
	if (Math.abs(target - shown) < 0.5) shown = target;
	// `instant` : un `scroll-behavior: smooth` rendrait chaque image au défilement lisse du navigateur.
	scrollTo({ top: shown, behavior: 'instant' });
	seen = scrollY;
	if (shown != target) frame = requestAnimationFrame(step);
};

// Un cran de molette se reconnaît à `wheelDeltaY`, qui compte 120 par cran dans tous les navigateurs ;
// un pavé tactile y met une fraction de cran, ou, sur Mac, trois fois son delta.
// Propriété héritée, absente des types du DOM.
const notch = (event: WheelEvent) => {
	const ticks = (event as WheelEvent & { wheelDeltaY: number }).wheelDeltaY;
	return ticks != 0 && ticks % 120 == 0 && ticks != -3 * event.deltaY;
};

// Sous le pointeur, ce qui défile encore en propre dans le sens du cran (la liste de la Lunette) ou
// retient le défilement de la page (son voile, en `overscroll-behavior: contain`) garde la molette ; en
// bout de course, la liste passerait le cran à la page, qui sauterait.
const held = (event: WheelEvent) =>
	event.composedPath().some((node) => {
		if ((node as Node).nodeType != 1) return false;
		const element = node as Element;
		const { overflowY, overscrollBehaviorY } = getComputedStyle(element);
		const room = event.deltaY > 0 ? element.scrollHeight - element.clientHeight - element.scrollTop : element.scrollTop;
		return overscrollBehaviorY != 'auto' || (/auto|scroll/.test(overflowY) && room > 0);
	});

// Suivi plutôt que lu une fois : le réglage peut changer, page ouverte.
const reduced = matchMedia('(prefers-reduced-motion)');

addEventListener(
	'wheel',
	(event) => {
		// Le zoom, le défilement horizontal et ce qu'un autre écouteur a déjà pris restent au navigateur.
		if (
			event.defaultPrevented ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
			reduced.matches ||
			!notch(event) ||
			held(event)
		)
			return;
		event.preventDefault();
		// Les crans enchaînés s'ajoutent à la cible du glissé en cours et prolongent son élan ; en changeant
		// de sens, ou après un autre défilement, le cran repart de la page.
		const gliding = frame && !moved();
		const from = gliding && (target - shown) * event.deltaY > 0 ? target : scrollY;
		if (!gliding) {
			shown = seen = scrollY;
			last = event.timeStamp;
		}
		target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, from + event.deltaY));
		frame ||= requestAnimationFrame(step);
	},
	{ passive: false },
);

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
