// Instantané des contributions GitHub publiques de Popoch39, relevé le 25 octobre 2026.
// Isolé du reste des données : un fetch au build pourra le remplacer en produisant la même
// forme, sans toucher au rendu.

export interface ContributionSnapshot {
	/** Premier jour couvert, en UTC (`AAAA-MM-JJ`) : un dimanche, comme les colonnes du calendrier GitHub. */
	start: string;
	/** Contributions par jour, à partir de `start`, un jour après l'autre. */
	counts: number[];
}

export const githubSnapshot: ContributionSnapshot = {
	start: '2025-10-26',
	// Une semaine (dimanche → samedi) par ligne.
	counts: [
		0, 3, 0, 3, 3, 4, 1,
		1, 3, 3, 0, 5, 5, 1,
		0, 1, 4, 5, 5, 1, 3,
		1, 3, 1, 3, 3, 1, 4,
		3, 5, 0, 2, 7, 6, 1,
		0, 1, 5, 3, 5, 0, 0,
		0, 7, 3, 3, 6, 5, 0,
		0, 11, 6, 7, 4, 2, 0,
		2, 2, 2, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0,
		0, 10, 7, 7, 3, 6, 0,
		0, 7, 4, 7, 6, 2, 0,
		0, 2, 5, 3, 2, 0, 0,
		0, 2, 3, 2, 1, 2, 0,
		3, 1, 8, 8, 8, 0, 1,
		0, 6, 0, 6, 1, 3, 0,
		0, 6, 2, 5, 7, 1, 4,
		0, 13, 8, 10, 1, 4, 0,
		0, 3, 4, 1, 3, 0, 0,
		0, 23, 5, 2, 15, 3, 7,
		11, 13, 6, 2, 2, 1, 0,
		0, 6, 5, 6, 6, 6, 0,
		0, 10, 2, 6, 3, 0, 0,
		0, 0, 6, 4, 2, 0, 0,
		0, 5, 1, 0, 4, 0, 0,
		0, 8, 6, 0, 0, 3, 0,
		0, 0, 0, 0, 6, 0, 0,
		3, 8, 2, 0, 6, 0, 0,
		0, 19, 6, 13, 0, 0, 0,
		0, 11, 6, 6, 15, 6, 0,
		5, 14, 8, 6, 3, 0, 1,
		1, 5, 4, 2, 10, 6, 0,
		0, 8, 4, 1, 0, 4, 0,
		0, 4, 7, 3, 6, 0, 0,
		2, 0, 0, 0, 5, 1, 0,
		0, 0, 18, 2, 5, 0, 0,
		0, 0, 9, 1, 10, 8, 2,
		0, 0, 0, 10, 1, 1, 0,
		0, 0, 47, 17, 6, 3, 0,
		11, 19, 14, 17, 44, 5, 0,
		0, 0, 0, 0, 0, 0, 0,
		17, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 10, 4,
		1, 12, 20, 10, 17, 14, 0,
		0, 20, 9, 10, 16, 19, 0,
		0, 13, 13, 18, 12, 10, 0,
		0, 5, 31, 24, 13, 26, 0,
		0, 28, 62, 81, 82, 82, 53,
		40, 78, 104, 101, 51, 34, 10,
		0, 76, 13, 123, 44, 17, 0,
		87, 11, 50, 41, 7, 3, 0,
		0, 4, 30, 15, 0, 3, 4,
		1,
	],
};
