// Les valeurs du build que le code du site lit (`:version`, et les versions des dépendances) : calculées
// sous Node au chargement de la config, puis injectées par `vite.define` (astro.config.mjs), qui ne les
// écrit que dans le code qui les lit, la Lunette, jamais dans le HTML. Leur type est dans `src/env.d.ts`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

/** Le commit court de HEAD ; `null` hors d'un dépôt git (une archive, un CI sans historique). */
function commit() {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
	} catch {
		// git absent, ou pas de dépôt : le site affiche son repli au lieu du commit.
		return null;
	}
}

/** La version installée d'une dépendance, celle que le build utilise vraiment. */
const versionOf = (name) => JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, root), 'utf8')).version;

/**
 * Les définitions à passer à `vite.define` : `__BUILD__` porte le commit, la date du build (instant ISO)
 * et la version de chaque dépendance de `packages`, par nom.
 * @param {string[]} packages
 */
export function buildDefines(packages) {
	const build = {
		commit: commit(),
		date: new Date().toISOString(),
		versions: Object.fromEntries(packages.map((name) => [name, versionOf(name)])),
	};
	return { __BUILD__: JSON.stringify(build) };
}
