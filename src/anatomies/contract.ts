// Contrat des anatomies : le seul tronc commun aux figures. Chaque anatomie vit dans
// `src/anatomies/<slug>/` (slug du projet dans `src/data/profile.ts`) et le registre la
// découvre seul. Un module complet expose :
// - `index.ts` : `export const anatomy: Anatomy` (contenu et géométrie au repos) ;
// - `motion.ts` : `export default` un `MountMotion`, chargé à la demande dans un morceau séparé ;
// - `concept.md` : la fiche de concept, qui relie chaque chiffre au code ;
// - `signatures.json` : la `Signature` de chaque pièce, relevée par `pnpm signatures`.
// Tout ce qui est propre à une figure (modèle, géométrie, textes, mouvement) reste dans son
// dossier : ajouter ou refaire une anatomie ne touche aucun fichier commun.
//
// Les modules s'importent avec leur extension (`./geometry.ts`) : la géométrie tourne aussi
// sous Node, en TypeScript natif, pour l'audit du kit.
//
// Deux langues (spec #31). Chaque anatomie porte ses textes dans les deux langues, dans son propre
// dossier, pour que la traduire ne touche aucun fichier commun :
// - au build, chaque texte du contenu est un `Text` : `{ fr, en }`, ou une chaîne seule, le français
//   d'une anatomie pas encore traduite (forme temporaire, retirée une fois les six traduites). Le
//   registre (`anatomyOf`) est le seul à choisir la langue : les composants ne voient que des
//   chaînes (`'page'`), et la version anglaise montre le français faute de traduction ;
// - `renderRest(locale)` et `Timeline.reading(t, locale)` reçoivent la langue de la page, pour les
//   textes dessinés dans la figure ou lus au-dessus de la règle ;
// - dans le navigateur, le mouvement reçoit `Stage.locale`, la langue du document : ses textes
//   (relevés, libellés, aide au clavier, bouton du tour) vivent dans son module en `{ fr, en }`.
//   Un seul morceau par figure sert les deux versions.
import type { Locale, Localized } from '../lib/i18n.ts';

/**
 * Où en est un texte d'anatomie : tel qu'écrit dans son module (`'module'`), ou résolu dans la
 * langue de la page (`'page'`), seule forme que reçoivent les composants.
 */
export type Side = 'module' | 'page';

/** Un texte d'anatomie : dans son module, les deux langues ou, faute de traduction, le français seul. */
export type Text<S extends Side = 'module'> = S extends 'module' ? string | Localized<string> : string;

/** Une consigne d'interaction, pour un pointeur qui survole et pour le toucher. */
export interface Consignes<S extends Side = 'module'> {
	pointer: Text<S>;
	touch: Text<S>;
}

/** Plage de lignes d'un fichier du dépôt, au commit lu (`AnatomyContent.sha`). */
export interface CodeRef {
	/** Chemin depuis la racine du dépôt (`apps/server/src/duel.ts`). */
	path: string;
	/** Première et dernière ligne, incluses. */
	lines: readonly [number, number];
}

/** Élément nommé de la machine, lié à un élément du code. Vis, pieds et graduations n'en sont pas. */
export interface Piece<S extends Side = 'module'> {
	/**
	 * Identifiant, égal au crochet de pièce du SVG (`data-piece`, posé par `pieceSvg`). Un même
	 * identifiant peut figurer sur plusieurs groupes quand l'ordre de peinture les sépare.
	 */
	id: string;
	name: Text<S>;
	/** Une phrase : ce que la pièce fait dans la machine, donc dans le code. */
	role: Text<S>;
	code: CodeRef;
	/** La pièce maîtresse, seule en bleu au repos : une seule par anatomie. */
	master?: true;
}

/**
 * Signature du code d'une pièce : ses premières lignes de code (1 à 4), hors lignes vides et
 * commentaires, avec leur numéro dans le fichier. Le repère de la fiche l'affiche.
 */
export type Signature = readonly (readonly [line: number, text: string])[];

/**
 * Règle de temps d'une figure qui a un temps : graduée sous la figure, ses événements marqués, avec
 * le bouton du tour. Le temps va de 0 à `last`, dans l'unité de la figure.
 */
export interface Timeline<S extends Side = 'module'> {
	last: number;
	/** Le temps au repos, où le curseur est posé. */
	rest: number;
	/** Les instants où il se passe quelque chose : un triangle chacun. */
	events: readonly number[];
	/** Pas des petites graduations. */
	tick: number;
	/** Grandes graduations, légendées. */
	marks: readonly { at: number; text: Text<S> }[];
	/**
	 * Le temps lu au-dessus du curseur (« minute 12 »), dans la langue de la page. Dans le module, une
	 * lecture qui ignore `locale` est française (forme temporaire, comme une chaîne seule).
	 */
	reading: S extends 'module' ? (t: number, locale?: Locale) => string : (t: number) => string;
	/** Les consignes de la fiche, qui désignent la règle : l'aperçu, sans règle, garde les siennes. */
	consignes: Consignes<S>;
}

/** Accroche du héros de la fiche, avec un seul mot en emphase. */
export interface Lede<S extends Side = 'module'> {
	before: Text<S>;
	emphasis: Text<S>;
	after: Text<S>;
}

export interface AnatomyContent<S extends Side = 'module'> {
	/** Slug du projet, égal au nom du dossier du module. */
	slug: string;
	/** Commit lu, en entier (40 caractères hexadécimaux) : tous les liens vers le code y sont figés. */
	sha: string;
	/** Nom de la machine (« Banc de duel »). */
	machine: Text<S>;
	lede: Lede<S>;
	/** Titre de la figure, en haut de sa carte. */
	title: Text<S>;
	/** Consigne d'interaction, pour un pointeur qui survole et pour le toucher. */
	consignes: Consignes<S>;
	/** Relevé au repos, tiré du modèle de la figure. */
	releve: Text<S>;
	/** Légende vraie, sous la carte : ce que la machine explique, en une phrase. */
	caption: Text<S>;
	/** Libellé accessible de la figure : ce qu'est la machine et ce qu'elle montre. */
	label: Text<S>;
	/** 5 à 8 pièces, dans l'ordre de la nomenclature. */
	pieces: Piece<S>[];
	seo: { title: Text<S>; description: Text<S> };
	/**
	 * Recadrage sur téléphone : une figure très large, que sa largeur rend petite, y grandit de 10 %
	 * et la carte coupe ses bords : environ 3 % de sa largeur à gauche, 6 % à droite. Ce qui compte
	 * doit rester hors de ces bandes.
	 */
	phoneCrop?: true;
	/** La règle de temps de la fiche, pour une figure qui a un temps. */
	timeline?: Timeline<S>;
}

/**
 * La figure au repos, dans son propre format : le contenu d'un `<svg viewBox="0 0 width height">`.
 * Le site l'habille en SVG intégré à la page ou en SVG autonome (styles embarqués).
 */
export interface RestFigure {
	width: number;
	height: number;
	body: string;
}

export interface Anatomy {
	content: AnatomyContent;
	/**
	 * Calcule la géométrie au repos dans la langue de la page : appelé au build, jamais dans le
	 * navigateur. Une figure qui ne dessine aucun texte à traduire ignore `locale`.
	 */
	renderRest: (locale: Locale) => RestFigure;
}

/** Ce que le chargeur confie au mouvement d'une figure. */
export interface Stage {
	/** La langue du document (`<html lang>`) : celle de tout ce que le mouvement écrit ou annonce. */
	locale: Locale;
	/** La scène qui contient la figure : seule cible des écouteurs clavier, sauf règle de temps. */
	scene: HTMLElement;
	svg: SVGSVGElement;
	/** Le relevé de la carte, que le mouvement réécrit. */
	releve: HTMLElement;
	/**
	 * La règle de temps (`AnatomyContent.timeline`) et son bouton de tour, sur la fiche seulement :
	 * l'aperçu de l'accueil n'en a pas.
	 */
	timeline?: { ruler: HTMLElement; tour: HTMLButtonElement };
}

/**
 * Monte le mouvement d'une figure sur sa scène et son relevé, et renvoie de quoi tout arrêter
 * (boucle, écouteurs, observateurs) et rendre la figure au repos. Le chargeur a déjà rendu la scène
 * focalisable ; le mouvement y pose son rôle et le libellé qui explique ses touches, et n'écoute
 * le clavier que sur elle. Avec une règle de temps, c'est la règle qui est focalisable et le
 * mouvement qui la rend vivante : rôle de curseur, touches, bouton du tour. Il s'appuie sur les
 * outils de `live.ts` et ne touche jamais aux attributs de mise en avant des pièces (`data-piece`,
 * `data-master`, `data-on`, `data-aiming`).
 */
export type MountMotion = (stage: Stage) => () => void;
