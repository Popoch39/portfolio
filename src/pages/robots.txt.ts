import type { APIRoute } from 'astro';

export const GET = (({ site }) => {
	if (!site) throw new Error('`site` doit être défini dans astro.config.mjs : le sitemap en dérive.');
	const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap.xml', site).href}`, ''].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}) satisfies APIRoute;
