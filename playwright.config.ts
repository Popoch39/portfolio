import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Un port par copie de travail : plusieurs worktrees lancent leurs tests en même temps,
// et un serveur réutilisé servirait le build d'une autre branche.
const port = 4400 + (createHash('sha1').update(process.cwd()).digest().readUInt16BE(0) % 500);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
			// Playwright n'émule pas `isMobile` sous Firefox : le doigt se teste dans Chromium.
			testIgnore: /tactile\.spec\.ts/,
		},
	],
	// Toujours le site construit, jamais le serveur de dev.
	// Astro passe `preview` en arrière-plan quand il détecte un agent IA : Playwright perdrait
	// le processus. On le garde au premier plan, hors du fichier de verrou d'un preview manuel.
	webServer: {
		command: `bun run build && bun run preview --ignore-lock --host 127.0.0.1 --port ${port}`,
		env: { ASTRO_PREVIEW_BACKGROUND: '0' },
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
