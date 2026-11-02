import type { APIRoute } from 'astro';

// Generated rather than kept in `public/`: the sitemap URL follows `site`.
export const GET: APIRoute = ({ site }) =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
