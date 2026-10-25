// Registre des anatomies : découvre seul les modules `src/anatomies/<slug>/index.ts`, sans
// fichier commun à modifier. Un dossier qui n'a encore que sa fiche de concept n'a pas
// d'`index.ts` : il est ignoré, et le projet garde la figure témoin.
import { githubRepoUrl, type Project } from '../data/profile';
import type { Anatomy, AnatomyContent, Piece } from './contract.ts';
import { REPO as WITNESS_REPO, witnessFor } from './_temoin/witness.ts';

const modules = import.meta.glob<Anatomy>('./*/index.ts', { eager: true, import: 'anatomy' });

const bySlug = new Map(
	Object.entries(modules).map(([path, anatomy]) => [path.split('/')[1], anatomy] as const),
);

export interface ProjectAnatomy extends Anatomy {
	/** Permalien GitHub de la pièce, figé sur le commit lu, avec sa plage de lignes. */
	codeUrl: (piece: Piece) => string;
}

const permalink = (repo: string, sha: string) => (piece: Piece) =>
	`${githubRepoUrl(repo)}/blob/${sha}/${piece.code.path}#L${piece.code.lines[0]}-L${piece.code.lines[1]}`;

/** L'anatomie d'un projet : son module, ou la figure témoin tant qu'il n'en a pas. */
export function anatomyOf(project: Project): ProjectAnatomy {
	const anatomy = bySlug.get(project.slug);
	const resolved: ProjectAnatomy = anatomy
		? { ...anatomy, codeUrl: permalink(project.repo, anatomy.content.sha) }
		: witnessOf(project);
	assertContract(project.slug, resolved.content);
	return resolved;
}

/** Repli sur la figure témoin, dont les pièces vivent dans le dépôt du portfolio. */
function witnessOf(project: Project): ProjectAnatomy {
	const witness = witnessFor(project);
	return { ...witness, codeUrl: permalink(WITNESS_REPO, witness.content.sha) };
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
	for (const { id, code } of pieces) {
		const [first, last] = code.lines;
		if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last >= first)) {
			fail(`plage de lignes invalide pour la pièce « ${id} »`);
		}
	}
	if (/\s/.test(content.lede.emphasis.trim())) fail('l’accroche ne met qu’un seul mot en emphase');
}
