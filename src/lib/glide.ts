// Le Glissé (ADR 0010) : un cran de molette fait glisser la page au lieu de la faire sauter. Le
// défilement natif avance d'un cran en un éclair puis s'arrête net, et la Plongée, qui suit exactement
// le défilement, avançait par à-coups. Le glissé lui-même est un défilement lisse que le navigateur
// anime sur le compositeur, comme celui de la molette : écrit image par image depuis le script, il
// arrivait parfois au compositeur une image après la scène, et Projets, tenu par une translation qui
// compense le défilement, tremblait (Brave sous Wayland).

// La cible du glissé en cours ; aucune avant le premier cran.
let target = NaN;

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
		// Les crans enchaînés s'ajoutent à la cible tant que la page n'y est pas ; en changeant de sens, ou
		// mené au-delà par un autre défilement (une ancre, la Lunette), le cran repart de la page.
		const from = (target - scrollY) * event.deltaY > 0 ? target : scrollY;
		target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, from + event.deltaY));
		scrollTo({ top: target, behavior: 'smooth' });
	},
	{ passive: false },
);

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
