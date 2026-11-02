import type { APIRoute, GetStaticPaths } from 'astro';
import { spriteSource, spriteVersion } from '../../components/logo-sprite';

// One file, named after its content: a new set of logos gets a new URL.
export const getStaticPaths = (() => [{ params: { version: spriteVersion } }]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
	new Response(spriteSource, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
