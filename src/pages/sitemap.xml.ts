import type { APIRoute } from 'astro';
import { fichePath, projects } from '../data/profile';

// L'accueil et les fiches : pas besoin de l'intégration @astrojs/sitemap.
export const GET = (({ site }) => {
	if (!site) throw new Error('`site` doit être défini dans astro.config.mjs : le sitemap en dérive.');
	const paths = ['/', ...projects.map(fichePath)];
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`),
		'</urlset>',
		'',
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}) satisfies APIRoute;
