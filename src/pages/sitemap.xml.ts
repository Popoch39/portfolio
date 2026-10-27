import type { APIRoute } from 'astro';
import { pages } from '../data/profile';
import { alternatesOf, locales, pathOf } from '../lib/i18n';

// L'accueil et les fiches, chaque version avec les mêmes alternatives que les `hreflang` de son
// `<head>` : pas besoin de l'intégration @astrojs/sitemap.
export const GET = (({ site }) => {
	if (!site) throw new Error('`site` doit être défini dans astro.config.mjs : le sitemap en dérive.');
	const urls = pages.flatMap((page) => {
		const alternates = alternatesOf(page)
			.map(({ hreflang, path }) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${new URL(path, site).href}"/>`)
			.join('');
		return locales.map((locale) => `<url><loc>${new URL(pathOf(page, locale), site).href}</loc>${alternates}</url>`);
	});
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urls,
		'</urlset>',
		'',
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}) satisfies APIRoute;
