import type { APIRoute, GetStaticPaths } from 'astro';
import { projects, type Project } from '../../data/profile';
import { anatomyOf } from '../../anatomies/registry';
import { restSvg } from '../../anatomies/figure';

// La figure au repos de chaque projet, en SVG autonome (styles embarqués).
export const getStaticPaths = (() => projects.map((project) => ({ params: { slug: project.slug }, props: { project } }))) satisfies GetStaticPaths;

export const GET = (({ props }) =>
	new Response(restSvg(anatomyOf(props.project), { standalone: true }), {
		headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
	})) satisfies APIRoute<{ project: Project }>;
