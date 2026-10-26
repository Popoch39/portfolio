// Registre des anatomies : découvre seul les modules `src/anatomies/<slug>/index.ts`, sans
// fichier commun à modifier. Chaque projet mis en avant doit avoir le sien, complet : sans figure
// ni mouvement, sa fiche n'aurait rien à montrer, donc le build échoue.
import { githubRepoUrl, type Project } from '../data/profile';
import type { Anatomy, AnatomyContent, Piece } from './contract.ts';

const modules = import.meta.glob<Anatomy>('./*/index.ts', { eager: true, import: 'anatomy' });
const folderOf = (path: string) => path.split('/')[1];

const bySlug = new Map(Object.entries(modules).map(([path, anatomy]) => [folderOf(path), anatomy] as const));

/** Les dossiers qui ont un module de mouvement : le chargeur les découvre par le même motif. */
const motions = new Set(Object.keys(import.meta.glob('./*/motion.ts')).map(folderOf));

export interface ProjectAnatomy extends Anatomy {
	/** Permalien GitHub de la pièce, figé sur le commit lu, avec sa plage de lignes. */
	codeUrl: (piece: Piece) => string;
	/** Le dossier du module de mouvement, que la scène confie au chargeur (`data-motion`). */
	motion: string;
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
	return { ...anatomy, codeUrl: permalink(project.repo, anatomy.content.sha), motion: project.slug };
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
	if (/\s/.test(content.lede.emphasis.trim())) fail('l’accroche ne met qu’un seul mot en emphase');}
