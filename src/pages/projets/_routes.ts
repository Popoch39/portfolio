// Les routes des fiches, une par projet, communes aux deux langues : la page anglaise reprend celles
// de la française, comme la figure au repos (`en/figures/[slug].svg.ts`). Astro ne traduit pas un
// segment d'URL : chaque langue garde son fichier de page, réduit à ce qui l'aiguille vers la fiche.
import type { GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { projects } from '../../data/profile';

export const getStaticPaths = (() => projects.map((project) => ({ params: { slug: project.slug }, props: { project } }))) satisfies GetStaticPaths;

/** Importé sous ce nom, il type `Astro.props` de la page. */
export type Props = InferGetStaticPropsType<typeof getStaticPaths>;
