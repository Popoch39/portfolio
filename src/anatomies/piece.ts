import { groupSvg } from '../vendor/anatomy/iso-kit.ts';
import type { Piece } from './contract.ts';

/**
 * Groupe SVG d'une pièce : pose son crochet (`data-piece`) et, sur la pièce maîtresse,
 * `data-master`, que la palette des figures peint en bleu. Appelable plusieurs fois pour une
 * même pièce quand l'ordre de peinture la coupe en morceaux.
 */
export const pieceSvg = (piece: Piece, children: string | string[]) =>
	groupSvg(children, { 'data-piece': piece.id, 'data-master': piece.master ? '' : undefined });
