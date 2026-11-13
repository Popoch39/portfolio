import type { APIRoute } from 'astro';

// Every `.astro` page except the 404s, as a directory URL: every such page is an index (`build.format: 'preserve'`).
// A handful of static pages does not call for the `@astrojs/sitemap` integration.
const paths = Object.keys(import.meta.glob('./**/*.astro'))
	.filter((file) => !file.endsWith('/404.astro'))
	.map((file) => file.slice(1).replace(/(index)?\.astro$/, '').replace(/([^/])$/, '$1/'));

export const GET: APIRoute = ({ site }) => {
	const urls = paths.map((path) => `\t<url><loc>${new URL(path, site).href}</loc></url>`).join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
	);
};
