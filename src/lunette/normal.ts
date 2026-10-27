// Le mode normal hors de la Lunette (ADR 0007) : la machine à séquences de l'écouteur et les
// déplacements qu'elle joue. Partie de l'écouteur, donc chargé avec la page : aucune de ces touches ne
// télécharge la Lunette. Le DOM n'est lu qu'à la frappe, pour que les tests l'importent sous Node.

/** Les séquences du mode normal et ce qu'elles font, touche après touche (`gg`, `]]`, `:`). */
export type Sequences = Record<string, () => void>;

/**
 * La machine à séquences : une séquence entière agit, un début de séquence attend la suite dans le
 * showcmd (`show`), toute autre touche l'interrompt. Une séquence s'ajoute à la table, sans toucher à la
 * machine. Rend la fonction de frappe, vraie si la touche est du mode normal.
 */
export function normalMode(sequences: Sequences, show: (keys: string) => void) {
	let pending = '';
	let timer: ReturnType<typeof setTimeout> | undefined;
	const wait = (keys: string) => {
		clearTimeout(timer);
		show((pending = keys));
		// Le `timeoutlen` de Vim : une séquence laissée en plan s'efface.
		if (keys) timer = setTimeout(wait, 1000, '');
	};
	return (key: string) => {
		const keys = pending + key;
		const run = sequences[keys];
		const begins = !run && Object.keys(sequences).some((sequence) => sequence.startsWith(keys));
		wait(begins ? keys : '');
		run?.();
		return !!run || begins;
	};
}

/**
 * Une frappe que son modificateur laisse au navigateur. Sur un clavier AZERTY, `]` et `[` demandent AltGr
 * (Ctrl+Alt sous Windows) ou Option (Alt sur Mac) : Ctrl et Alt passent pour elles, que le navigateur
 * n'emploie pas ; Cmd jamais (Cmd+[ recule dans l'historique).
 */
export const modified = (event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) =>
	event.metaKey || ((event.ctrlKey || event.altKey) && !'[]'.includes(event.key));

/** Défile jusqu'à `top`, en douceur, sauf en mouvement réduit (la forme courte de la requête le teste). */
const scroll = (top: number) => scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion)').matches ? 'instant' : 'smooth' });

/**
 * La section suivante (`]]`) ou précédente (`[[`), dans l'ordre de la navigation : ses liens d'ancre
 * n'existent que sur l'accueil. La précédente compte celle dont le début est passé au-dessus de la
 * fenêtre ; le pixel de marge absorbe l'arrondi du défilement précédent.
 */
function section(next: boolean) {
	const tops = [...document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]')].map(
		(link) => document.querySelector(link.hash)?.getBoundingClientRect().top ?? NaN,
	);
	const top = next ? tops.find((top) => top > 1) : tops.findLast((top) => top < -1);
	if (top !== undefined) scroll(scrollY + top);
}

/** Les déplacements du mode normal, comme dans Vim. */
export const motions: Sequences = {
	gg: () => scroll(0),
	G: () => scroll(document.documentElement.scrollHeight),
	']]': () => section(true),
	'[[': () => section(false),
};
