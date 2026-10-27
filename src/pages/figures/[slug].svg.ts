import type { APIRoute, GetStaticPaths } from 'astro';
import { projects, type Project } from '../../data/profile';
import { localeOf } from '../../lib/i18n';
import { anatomyOf } from '../../anatomies/registry';
import { restSvg } from '../../anatomies/figure';

// La figure au repos de chaque projet, en SVG autonome (styles embarqués), dans la langue de son
// URL : son libellé est un texte de l'anatomie. `src/pages/en/figures/[slug].svg.ts` sert l'anglais.
export const getStaticPaths = (() => projects.map((project) => ({ params: { slug: project.slug }, props: { project } }))) satisfies GetStaticPaths;

export const GET = (({ props, currentLocale }) =>
	new Response(restSvg(anatomyOf(props.project, localeOf(currentLocale)), { standalone: true }), {
		headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
	})) satisfies APIRoute<{ project: Project }>;
