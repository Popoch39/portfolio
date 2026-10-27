// Les éléments que construisent la Lunette et ses Volets, sans gabarit : rien d'elle n'est dans le HTML
// des pages (ADR 0007).

/** Un élément `tag` de classe `className`, avec son contenu : du texte ou d'autres nœuds. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	node.append(...children);
	return node;
}
