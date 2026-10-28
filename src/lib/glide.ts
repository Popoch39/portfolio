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
	return ticks && ticks % 120 == 0 && ticks != -3 * event.deltaY;
};

// Sous le pointeur, ce qui défile en propre (la liste de la Lunette) ou retient le défilement de la page
// (son voile, en `overscroll-behavior: contain`) garde la molette.
const held = (event: WheelEvent) =>
	event.composedPath().some((node) => {
		if ((node as Node).nodeType != 1) return false;
		const element = node as Element;
		const { overflowY, overscrollBehaviorY } = getComputedStyle(element);
		return overscrollBehaviorY != 'auto' || (/auto|scroll/.test(overflowY) && element.scrollHeight > element.clientHeight);
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

// Ailleurs que là où le glissé l'a posée (clavier, barre de défilement, ancre, Lunette), la page est à
// qui l'a déplacée : le glissé s'arrête au lieu de la ramener vers sa cible.
addEventListener(
	'scroll',
	() => {
		if (frame && Math.abs(scrollY - position) > 1) {
			cancelAnimationFrame(frame);
			frame = 0;
		}
	},
	{ passive: true },
);

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
