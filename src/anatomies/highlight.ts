// Mise en avant des pièces, commune à toutes les figures : la pièce visée porte `data-on` sur
// chacun de ses crochets (`[data-piece]`), dans la figure comme dans la nomenclature, et la CSS
// fait le reste (palette des figures, nomenclature). Une seule pièce est visée à la fois ; tant
// qu'il y en a une, la pièce maîtresse redevient neutre. Seul ce module écrit `data-on` : le
// mouvement d'une figure n'y touche jamais.

const pieceOf = (target: EventTarget | null) =>
	target instanceof Element ? (target.closest('[data-piece]')?.getAttribute('data-piece') ?? null) : null;

/**
 * Lie les crochets de pièce contenus dans `root` (la figure, et la nomenclature quand il y en a
 * une) : survol ou focus d'un crochet = sa pièce visée ; sortie = plus rien de visé, la pièce
 * maîtresse redevient la pièce bleue. Au toucher, un appui vise la pièce touchée. Renvoie de quoi
 * tout débrancher.
 */
export function linkPieces(root: Element): () => void {
	let aimed: string | null = null;
	const aim = (id: string | null) => {
		if (id === aimed) return;
		aimed = id;
		for (const hook of root.querySelectorAll('[data-piece]')) hook.toggleAttribute('data-on', hook.getAttribute('data-piece') === id);
	};

	const wiring = new AbortController();
	const on = <K extends keyof HTMLElementEventMap>(type: K, listener: (event: HTMLElementEventMap[K]) => void) =>
		root.addEventListener(type, listener as EventListener, { signal: wiring.signal });

	// Un doigt ne survole pas : le survol vient de la souris ou du stylet, l'appui du doigt.
	on('pointerover', (event) => event.pointerType !== 'touch' && aim(pieceOf(event.target)));
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
