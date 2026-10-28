// Le Glissé (ADR 0010) : un cran de molette fait glisser la page avec de l'inertie au lieu de la faire
// sauter. Le défilement natif avance d'un cran en un éclair puis s'arrête net, et la Plongée, qui suit
// exactement le défilement, avançait par à-coups. Seul le défilement est lissé : les animations restent
// à la CSS et au compositeur.

// Un dixième de l'écart rattrapé par image à 60 images par seconde, quelle que soit la cadence de
// l'écran : la page est posée en une demi-seconde environ.
const RATE = -60 * Math.log(0.9);

let target = 0;
let position = 0;
let last = 0;
let frame = 0;

const step = (now: number) => {
	position += (target - position) * (1 - Math.exp((-RATE * Math.max(0, now - last)) / 1000));
	last = now;
	if (Math.abs(target - position) < 0.5) position = target;
	scrollTo(0, position);
	frame = position == target ? 0 : requestAnimationFrame(step);
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
		if (!frame) {
			target = position = scrollY;
			// L'heure du cran, sur l'horloge des images : la première compte depuis lui.
			last = event.timeStamp;
			frame = requestAnimationFrame(step);
		}
		target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, target + event.deltaY));
	},
	{ passive: false },
);

const stop = () => {
	cancelAnimationFrame(frame);
	frame = 0;
};

// Ailleurs que là où le glissé l'a posée (clavier, barre de défilement, ancre, Lunette), la page est à
// qui l'a déplacée : le glissé s'arrête au lieu de la ramener vers sa cible.
addEventListener('scroll', () => frame && Math.abs(scrollY - position) > 1 && stop(), { passive: true });
// Un défilement lisse (flèches, `j` dans la Lunette) peut n'avoir pas bougé d'un pixel à l'image
// suivante, que le glissé écraserait : la touche ou le clic qui le lance arrête le glissé avant lui.
addEventListener('keydown', stop);
addEventListener('pointerdown', stop, { passive: true });

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
