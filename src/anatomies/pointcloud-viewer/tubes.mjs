// Frontière avec les tubes du kit : `fillet` et `tubePieces` typent leurs options d'après leurs
// valeurs par défaut (`null`, `[]`), si bien qu'un appel depuis un `.ts` ne se type pas. En `.mjs`,
// ces deux enveloppes gardent la géométrie du câble dans `geometry.ts`.
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubePieces } from '../../vendor/anatomy/tube.mjs';

/** Arrondit les coudes d'un tracé, en tenant compte de la vue pour ne pas pincer le tube. */
export const rounded = (points, bend, P, radius) => G.fillet(points, bend, 7, { P, tube: radius });

/** Le câble spiralé : des morceaux triables, sa spirale de fil suivant la section à chaque joint. */
export const coiled = (points, radius, P, gaps) =>
	tubePieces(points, radius, P, { maxLength: 14, gaps, rings: { pitch: 1.1, twist: 0.6, steps: 8, tone: 'lo' } });
