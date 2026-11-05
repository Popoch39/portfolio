import { createHash } from 'node:crypto';

/**
 * The CSP hash of an inline script, for `Astro.csp.insertScriptHash`: Astro hashes only the scripts
 * it bundles, so an `is:inline` one is let through by its own hash, wherever it stands in the head,
 * before the policy's `<meta>` or after it.
 */
export function inlineScriptHash(source: string): `sha256-${string}` {
	return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}
