// L'historique de la Lunette aux flèches, comme la ligne de commande de Vim. Pur, sans DOM : la Lunette
// garde l'historique et la ligne rappelée, ce module ne fait que choisir où mène la flèche.

/**
 * Où mène ↑ (`step` 1) ou ↓ (`step` -1), `at` étant la ligne rappelée de `history` (la plus récente en
 * dernier) : la ligne à écrire et sa place, la ligne vide après la plus récente ; ou rien, et la flèche
 * déplace la sélection. Seul ↑ entre dans l'historique, depuis une Lunette vide : ↓ y déplace la
 * sélection, comme ↑ et ↓ dès qu'on a tapé. La plus ancienne arrête ↑.
 */
export function recall(history: string[], at: number | undefined, line: string, step: number): { line: string; at?: number } | undefined {
	if (at === undefined && (step < 0 || line || !history.length)) return undefined;
	const next = Math.max((at ?? history.length) - step, 0);
	return next < history.length ? { line: history[next], at: next } : { line: '' };
}
