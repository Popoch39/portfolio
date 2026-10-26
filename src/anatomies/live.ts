// Outils de mouvement des figures, en vanilla : boucle d'animation, arrêt hors écran, image fixe
// en mouvement réduit, suivi amorti et ressort (transposés du `live.tsx` du kit `anatomy`). Ils
// ne fixent aucun rythme : durées, raideurs et amortissements sont choisis par chaque figure.

const STILLNESS = '(prefers-reduced-motion: reduce)';
/** Un onglet en arrière-plan ne doit pas faire sauter la figure à son retour. */
const LONGEST_FRAME = 1 / 30;

/** Vrai quand le visiteur demande moins de mouvement : la figure saute alors à ses cibles. */
export const asksForStillness = () => matchMedia(STILLNESS).matches;

export interface Loop {
	/** Relance la boucle (après une interaction) si la scène est à l'écran. */
	kick: () => void;
	/** Arrête la boucle et débranche les observateurs. */
	stop: () => void;
}

/**
 * Une boucle d'animation par figure. `tick(dt, calm)` avance le modèle de `dt` secondes et écrit le
 * DOM ; il renvoie `true` tant que quelque chose bouge encore. `calm` vaut `true` en mouvement
 * réduit : la figure doit alors sauter à ses cibles et renvoyer `false`, ce qui donne une image
 * fixe. La boucle s'arrête dès que tout est arrivé ou que la scène quitte l'écran, et repart au
 * retour de la scène, sur `kick()` ou quand la préférence de mouvement change.
 */
export function loop(scene: Element, tick: (dt: number, calm: boolean) => boolean, { margin = '120px 0px' } = {}): Loop {
	const stillness = matchMedia(STILLNESS);
	let frame = 0;
	let last = 0;
	let visible = false;

	const step = (now: number) => {
		const dt = last ? Math.min((now - last) / 1000, LONGEST_FRAME) : 1 / 60;
		last = now;
		const moving = tick(dt, stillness.matches);
		frame = visible && moving ? requestAnimationFrame(step) : 0;
	};
	const kick = () => {
		if (frame || !visible) return;
		last = 0;
		frame = requestAnimationFrame(step);
	};
	const halt = () => {
		cancelAnimationFrame(frame);
		frame = 0;
	};

	// La dernière entrée fait foi : quand la scène sort et revient entre deux rappels, un seul
	// rappel livre les deux entrées, la plus ancienne d'abord.
	const observer = new IntersectionObserver(
		(entries) => {
			visible = entries[entries.length - 1].isIntersecting;
			if (visible) kick();
			else halt();
		},
		{ rootMargin: margin },
	);
	observer.observe(scene);
	stillness.addEventListener('change', kick);

	return {
		kick,
		stop: () => {
			halt();
			visible = false;
			observer.disconnect();
			stillness.removeEventListener('change', kick);
		},
	};
}

/** Suivi amorti exponentiel : `seconds` est la constante de temps ; saute à la cible en mouvement réduit. */
export function follow(current: number, target: number, dt: number, seconds: number, calm = false) {
	if (calm) return target;
	const next = current + (target - current) * (1 - Math.exp(-dt / seconds));
	return Math.abs(target - next) < 1e-3 ? target : next;
}

export interface Spring {
	at: number;
	rate: number;
}

/**
 * Ressort amorti, sous-échantillonné vers 240 Hz pour rester stable. Il s'accroche à la cible sous
 * 5e-4 d'écart et de vitesse, et y saute en mouvement réduit. Renvoie `true` une fois arrivé.
 */
export function spring(state: Spring, target: number, dt: number, stiffness: number, damping: number, calm = false) {
	if (calm) {
		state.at = target;
		state.rate = 0;
		return true;
	}
	const steps = Math.max(Math.ceil(dt * 240), 1);
	const slice = dt / steps;
	for (let i = 0; i < steps; i++) {
		state.rate += ((target - state.at) * stiffness - state.rate * damping) * slice;
		state.at += state.rate * slice;
	}
	if (Math.abs(target - state.at) < 5e-4 && Math.abs(state.rate) < 5e-4) {
		state.at = target;
		state.rate = 0;
	}
	return state.at === target && state.rate === 0;
}
