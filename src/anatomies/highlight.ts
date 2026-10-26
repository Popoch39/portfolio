// Mise en avant des pièces, commune à toutes les figures : la pièce visée porte `data-on` sur
// chacun de ses crochets (`[data-piece]`), dans la figure comme dans la nomenclature, et la CSS
// fait le reste (palette des figures, nomenclature, repère), grain compris, que ce module mesure.
// Une seule pièce est visée à la fois ; tant qu'il y en a une, la racine et ses scènes portent
// `data-aiming` et la pièce maîtresse redevient neutre. Seul ce module écrit `data-on` et
// `data-aiming` : le mouvement d'une figure n'y touche jamais.

/**
 * Le grain de la pièce visée naît à son coin haut gauche et doit couvrir sa diagonale (palette des
 * figures). Son masque se cale sur la boîte de chaque face, Chromium ignorant `view-box` sur un
 * élément SVG : chaque face reçoit donc ce coin et cette diagonale dans son propre repère.
 */
function measureGrain(hooks: Element[]) {
	const boxes = hooks.map((hook) => hook.getBoundingClientRect());
	const left = Math.min(...boxes.map((box) => box.left));
	const top = Math.min(...boxes.map((box) => box.top));
	const diagonal = Math.hypot(Math.max(...boxes.map((box) => box.right)) - left, Math.max(...boxes.map((box) => box.bottom)) - top);
	if (!(diagonal > 0)) return;
	for (const face of hooks.flatMap((hook) => [...hook.querySelectorAll<SVGGraphicsElement>('.iso-shade, .iso-top')])) {
		const toFace = face.getScreenCTM();
		if (!toFace) continue;
		const corner = new DOMPoint(left, top).matrixTransform(toFace.inverse());
		const box = face.getBBox();
		face.style.setProperty('--anatomy-grain-cx', `${corner.x - box.x}px`);
		face.style.setProperty('--anatomy-grain-cy', `${corner.y - box.y}px`);
		face.style.setProperty('--anatomy-grain-d', `${diagonal / toFace.a}px`);
	}
}

const pieceOf = (target: EventTarget | null) =>
	target instanceof Element ? (target.closest('[data-piece]')?.getAttribute('data-piece') ?? null) : null;

/**
 * Un pointeur qui quitte une pièce pour le vide la garde visée encore un instant : il traverse un
 * interstice vers la pièce voisine (la maîtresse ne clignote pas entre deux) ou vers le repère, dont
 * il peut ainsi suivre le lien.
 */
const LINGER = 250;

/**
 * Lie les crochets de pièce contenus dans `root` (la figure, et la nomenclature quand il y en a
 * une) : survol ou focus d'un crochet = sa pièce visée ; sortie = plus rien de visé, la pièce
 * maîtresse redevient la pièce bleue. Au toucher, un appui vise la pièce touchée. `onAim` apprend
 * chaque changement de pièce visée. Renvoie de quoi tout débrancher.
 */
export function linkPieces(root: Element, { onAim }: { onAim?: (id: string | null) => void } = {}): () => void {
	let aimed: string | null = null;
	let release = 0;
	const aim = (id: string | null) => {
		clearTimeout(release);
		release = 0;
		if (id === aimed) return;
		aimed = id;
		for (const stage of [root, ...root.querySelectorAll('.iso.anatomy')]) stage.toggleAttribute('data-aiming', id !== null);
		for (const hook of root.querySelectorAll('[data-piece]')) hook.toggleAttribute('data-on', hook.getAttribute('data-piece') === id);
		if (id) measureGrain([...root.querySelectorAll('svg [data-piece][data-on]')]);
		onAim?.(id);
	};
	const hover = (id: string | null) => {
		if (id || !aimed) aim(id);
		else if (!release) release = window.setTimeout(() => aim(null), LINGER);
	};

	const wiring = new AbortController();
	const on = <K extends keyof HTMLElementEventMap>(type: K, listener: (event: HTMLElementEventMap[K]) => void) =>
		root.addEventListener(type, listener as EventListener, { signal: wiring.signal });

	// Un doigt ne survole pas : le survol vient de la souris ou du stylet, l'appui du doigt.
	on('pointerover', (event) => event.pointerType !== 'touch' && hover(pieceOf(event.target)));
	on('pointerleave', (event) => event.pointerType !== 'touch' && aim(null));
	on('pointerdown', (event) => event.pointerType === 'touch' && aim(pieceOf(event.target)));
	on('focusin', (event) => aim(pieceOf(event.target)));
	on('focusout', (event) => {
		if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) aim(null);
	});

	return () => {
		wiring.abort();
		aim(null);
	};
}
