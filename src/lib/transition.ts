// La view transition entre l'accueil et une fiche, lettre à lettre (ADR 0004) : les valeurs que
// partagent le gabarit, l'accueil et la fiche.
import { projects } from '../data/profile';

/** Écart entre les départs de deux lettres voisines, celui de la maquette. */
const letterGap = 28;

/**
 * Le délai de chaque lettre, par son rang (`letter-<i>`, posé par le script de la transition), jusqu'au
 * curseur qui suit le nom le plus long. Les pseudo-éléments de la transition ne lisent aucune variable
 * de l'élément nommé : chaque rang a sa règle.
 */
export const letterDelays = Array.from(
	{ length: Math.max(...projects.map((p) => p.repo.length)) + 1 },
	(_, i) => `::view-transition-group(letter-${i}){animation-delay:${i * letterGap}ms}`,
).join('');

/**
 * L'aperçu des projets de l'accueil, qui suit leur liste. L'accueil n'est pas rendu avant son analyse :
 * au retour d'une fiche, la ligne qui reçoit les lettres existe déjà.
 */
export const projectsPreviewId = 'projects-preview';
