// Chargeur des figures, commun aux fiches et à l'aperçu de l'accueil : il découvre seul le module
// de mouvement de chaque figure (`src/anatomies/<dossier>/motion.ts`), sans fichier commun à
// modifier, et le charge à la demande. Vite fait de chaque module un morceau séparé.
import { defaultLocale, locales, type Locale } from '../lib/i18n.ts';
import type { MountMotion, Stage } from './contract.ts';

/** La langue du document : ses codes `lang` sont les langues elles-mêmes (`formats` du module i18n). */
const documentLocale = (): Locale => locales.find((locale) => locale === document.documentElement.lang) ?? defaultLocale;

const motions = new Map(
	Object.entries(import.meta.glob<MountMotion>('./*/motion.ts', { import: 'default' })).map(
		([path, load]) => [path.split('/')[1], load] as const,
	),
);

const loaderOf = (motion: string) => {
	const load = motions.get(motion);
	if (!load) throw new Error(`Figure : aucun module de mouvement « ${motion} »`);
	return load;
};

/** Télécharge le mouvement d'une figure sans le monter (par exemple quand le navigateur est inactif). */
export const preloadMotion = async (motion: string) => {
	await loaderOf(motion)();
};

/**
 * Charge le mouvement `motion` (le dossier du module, porté par `data-motion` sur la scène), rend
 * la scène focalisable et le monte, dans la langue du document. Renvoie de quoi tout arrêter et rendre la scène inerte. Si
 * `signal` est annulé pendant le chargement (l'aperçu a changé de projet), rien n'est monté. Une
 * règle de temps prend la place de la scène au clavier : un seul arrêt de tabulation par temps.
 */
export async function mountFigure(stage: Omit<Stage, 'locale'>, motion: string, { signal }: { signal?: AbortSignal } = {}) {
	const mount = await loaderOf(motion)();
	if (signal?.aborted) return () => {};
	if (!stage.timeline) stage.scene.tabIndex = 0;
	const stop = mount({ ...stage, locale: documentLocale() });
	return () => {
		stop();
		stage.scene.removeAttribute('tabindex');
	};
}
