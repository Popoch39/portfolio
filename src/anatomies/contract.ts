// Contrat des anatomies : le seul tronc commun aux figures. Chaque anatomie vit dans
// `src/anatomies/<slug>/` (slug du projet dans `src/data/profile.ts`) et le registre la
// découvre seul. Un module complet expose :
// - `index.ts` : `export const anatomy: Anatomy` (contenu et géométrie au repos) ;
// - `motion.ts` : `export default` un `MountMotion`, chargé à la demande dans un morceau séparé ;
// - `concept.md` : la fiche de concept, qui relie chaque chiffre au code.
// Tout ce qui est propre à une figure (modèle, géométrie, textes, mouvement) reste dans son
// dossier : ajouter ou refaire une anatomie ne touche aucun fichier commun.
//
// Les modules s'importent avec leur extension (`./geometry.ts`) : la géométrie tourne aussi
// sous Node, en TypeScript natif, pour l'audit du kit.

/** Plage de lignes d'un fichier du dépôt, au commit lu (`AnatomyContent.sha`). */
export interface CodeRef {
	/** Chemin depuis la racine du dépôt (`apps/server/src/duel.ts`). */
	path: string;
	/** Première et dernière ligne, incluses. */
	lines: readonly [number, number];
}

/** Élément nommé de la machine, lié à un élément du code. Vis, pieds et graduations n'en sont pas. */
export interface Piece {
	/**
	 * Identifiant, égal au crochet de pièce du SVG (`data-piece`, posé par `pieceSvg`). Un même
	 * identifiant peut figurer sur plusieurs groupes quand l'ordre de peinture les sépare.
	 */
	id: string;
	name: string;
	/** Une phrase : ce que la pièce fait dans la machine, donc dans le code. */
	role: string;
	code: CodeRef;
	/** La pièce maîtresse, seule en bleu au repos : une seule par anatomie. */
	master?: true;
}

/** Accroche du héros de la fiche, avec un seul mot en emphase. */
export interface Lede {
	before: string;
	emphasis: string;
	after: string;
}

export interface AnatomyContent {
	/** Slug du projet, égal au nom du dossier du module. */
	slug: string;
	/** Commit lu, en entier (40 caractères hexadécimaux) : tous les liens vers le code y sont figés. */
	sha: string;
	/** Nom de la machine (« Banc de duel »). */
	machine: string;
	lede: Lede;
	/** Titre de la figure, en haut de sa carte. */
	title: string;
	/** Consigne d'interaction, pour un pointeur qui survole et pour le toucher. */
	consignes: { pointer: string; touch: string };
	/** Relevé au repos, tiré du modèle de la figure. */
	releve: string;
	/** Légende vraie, sous la carte : ce que la machine explique, en une phrase. */
	caption: string;
	/** Libellé accessible de la figure : ce qu'est la machine et ce qu'elle montre. */
	label: string;
	/** 5 à 8 pièces, dans l'ordre de la nomenclature. */
	pieces: Piece[];
	seo: { title: string; description: string };
	/**
	 * Recadrage sur téléphone : une figure très large, que sa largeur rend petite, y grandit de 10 %
	 * et la carte coupe ses bords : environ 3 % de sa largeur à gauche, 6 % à droite. Ce qui compte
	 * doit rester hors de ces bandes.
	 */
	phoneCrop?: true;
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
	/** Calcule la géométrie au repos : appelé au build, jamais dans le navigateur. */
	renderRest: () => RestFigure;
}

/** Ce que le chargeur confie au mouvement d'une figure. */
export interface Stage {
	/** La scène focalisable qui contient la figure : seule cible des écouteurs clavier. */
	scene: HTMLElement;
	svg: SVGSVGElement;
	/** Le relevé de la carte, que le mouvement réécrit. */
	releve: HTMLElement;
}

/**
 * Monte le mouvement d'une figure sur sa scène et son relevé, et renvoie de quoi tout arrêter
 * (boucle, écouteurs, observateurs) et rendre la figure au repos. Le chargeur a déjà rendu la scène
 * focalisable ; le mouvement y pose son rôle et le libellé qui explique ses touches, et n'écoute
 * le clavier que sur elle. Il s'appuie sur les outils de `live.ts` et ne touche jamais aux
 * attributs de mise en avant des pièces (`data-piece`, `data-master`, `data-on`).
 */
export type MountMotion = (stage: Stage) => () => void;
