import type { APIRoute } from 'astro';
import { projects } from '../data/profile';
import { defaultLocale, fiche, home, pathOf } from '../lib/i18n';

// L'accueil et les fiches : pas besoin de l'intégration @astrojs/sitemap.
export const GET = (({ site }) => {
	if (!site) throw new Error('`site` doit être défini dans astro.config.mjs : le sitemap en dérive.');
	const paths = [home, ...projects.map((project) => fiche(project.slug))].map((page) => pathOf(page, defaultLocale));
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`),
		'</urlset>',
		'',
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}) satisfies APIRoute;
