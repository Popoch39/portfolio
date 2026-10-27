// Registre des anatomies : découvre seul les modules `src/anatomies/<slug>/index.ts`, sans
// fichier commun à modifier. Chaque projet mis en avant doit avoir le sien, complet : sans figure
// ni mouvement, sa fiche n'aurait rien à montrer, donc le build échoue.
import { githubRepoUrl, type Project } from '../data/profile';
import type { Anatomy, AnatomyContent, Piece, Signature } from './contract.ts';
import type { Anchors } from './anchors.ts';

const modules = import.meta.glob<Anatomy>('./*/index.ts', { eager: true, import: 'anatomy' });
const folderOf = (path: string) => path.split('/')[1];

const bySlug = new Map(Object.entries(modules).map(([path, anatomy]) => [folderOf(path), anatomy] as const));

type Signatures = Record<string, Signature>;
const signatures = new Map(
	Object.entries(import.meta.glob<Signatures>('./*/signatures.json', { eager: true, import: 'default' })).map(
		([path, byPiece]) => [folderOf(path), byPiece] as const,
	),
);

const anchorsBySlug = new Map(
	Object.entries(import.meta.glob<Anchors>('./*/anchors.json', { eager: true, import: 'default' })).map(([path, anchors]) => [folderOf(path), anchors] as const),
);

/** Les dossiers qui ont un module de mouvement : le chargeur les découvre par le même motif. */
const motions = new Set(Object.keys(import.meta.glob('./*/motion.ts')).map(folderOf));

export interface ProjectAnatomy extends Anatomy {
	/** Permalien GitHub de la pièce, figé sur le commit lu, avec sa plage de lignes. */
	codeUrl: (piece: Piece) => string;
	/** La signature du code de la pièce, relevée au commit lu. */
	signatureOf: (piece: Piece) => Signature;
	/** Le dossier du module de mouvement, que la scène confie au chargeur (`data-motion`). */
	motion: string;
	/** Où les notes touchent les pièces, relevé par `pnpm ancres` (`annotate` vérifie qu'il est à jour). */
	anchors?: Anchors;
}

const permalink = (repo: string, sha: string) => (piece: Piece) =>
	`${githubRepoUrl(repo)}/blob/${sha}/${piece.code.path}#L${piece.code.lines[0]}-L${piece.code.lines[1]}`;

/** L'anatomie d'un projet, tirée de son module. */
export function anatomyOf(project: Project): ProjectAnatomy {
	const anatomy = bySlug.get(project.slug);
	if (!anatomy) {
		throw new Error(`Anatomie « ${project.slug} » : module manquant (src/anatomies/${project.slug}/index.ts)`);
	}
	assertContract(project.slug, anatomy.content);
	if (!motions.has(project.slug)) {
		throw new Error(`Anatomie « ${project.slug} » : module de mouvement absent (src/anatomies/${project.slug}/motion.ts)`);
	}
	const byPiece = signatures.get(project.slug) ?? {};
	assertSignatures(project.slug, anatomy.content.pieces, byPiece);
	return {
		...anatomy,
		codeUrl: permalink(project.repo, anatomy.content.sha),
		signatureOf: (piece) => byPiece[piece.id],
		motion: project.slug,
		anchors: anchorsBySlug.get(project.slug),
	};
}

/** Chaque pièce a sa signature, relevée dans sa plage de lignes : sinon, relancer `pnpm signatures`. */
function assertSignatures(slug: string, pieces: Piece[], byPiece: Signatures) {
	for (const { id, code } of pieces) {
		const lines = byPiece[id]?.map(([line]) => line) ?? [];
		const [first, last] = code.lines;
		const inRange = lines.every((line, i) => line >= first && line <= last && (i === 0 || line > lines[i - 1]));
		if (lines.length < 1 || lines.length > 4 || !inRange) {
			throw new Error(`Anatomie « ${slug} » : signature absente ou hors des lignes ${first}–${last} pour la pièce « ${id} » (pnpm signatures)`);
		}
	}
}

/** Le contrat que les tests vérifient sur la sortie, vérifié dès le build pour nommer le module fautif. */
function assertContract(slug: string, content: AnatomyContent) {
	const fail = (message: string) => {
		throw new Error(`Anatomie « ${slug} » : ${message}`);
	};
	if (content.slug !== slug) fail(`le slug du contenu (« ${content.slug} ») diffère du dossier`);
	if (!/^[0-9a-f]{40}$/.test(content.sha)) fail('le commit lu doit être un SHA complet (40 caractères hexadécimaux)');
	const { pieces } = content;
	if (pieces.length < 5 || pieces.length > 8) fail(`${pieces.length} pièces, il en faut 5 à 8`);
	if (new Set(pieces.map((piece) => piece.id)).size !== pieces.length) fail('deux pièces ont le même identifiant');
	if (pieces.filter((piece) => piece.master).length !== 1) fail('il faut exactement une pièce maîtresse');
	for (const { id, code, note } of pieces) {
		const [first, last] = code.lines;
		if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last >= first)) {
			fail(`plage de lignes invalide pour la pièce « ${id} »`);
		}
		// Les notes tiennent dans leur gabarit autour de la figure (contrat : `Note`).
		const limits = { title: 28, text: 90, clue: 18, symbol: 26 } as const;
		for (const [field, max] of Object.entries(limits) as [keyof typeof limits, number][]) {
			if (!note[field].trim() || note[field].length > max) fail(`note de la pièce « ${id} » : ${field} vide ou de plus de ${max} caractères`);
		}
		if (note.tech.length < 1 || note.tech.length > 2) fail(`note de la pièce « ${id} » : une ou deux technologies`);
	}
	if (/\s/.test(content.lede.emphasis.trim())) fail('l’accroche ne met qu’un seul mot en emphase');}
