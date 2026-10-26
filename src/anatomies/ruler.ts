// Positions sur la règle de temps (`Regle.astro`), communes à son rendu au build et au mouvement
// qui la fait vivre : tout y est placé en pourcentage de sa largeur.

/** Abscisse du temps `t` sur une règle qui va de 0 à `last`. */
export const rulerX = (t: number, last: number) => `${Number(((Math.max(0, Math.min(last, t)) / last) * 100).toFixed(3))}%`;

/** Près d'un bord, le temps lu s'aligne sur le curseur au lieu de déborder de la règle. */
export const readingAnchor = (t: number, last: number) => (t / last < 0.08 ? 'start' : t / last > 0.92 ? 'end' : 'middle');
