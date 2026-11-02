import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// One port per working copy: several worktrees run their tests at the same time,
// and a reused server would serve another branch's build.
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
			// Playwright does not emulate `isMobile` under Firefox: touch is tested in Chromium.
			testIgnore: /touch\.spec\.ts/,
		},
	],
	// Always the built site, never the dev server.
	// Astro moves `preview` to the background when it detects an AI agent: Playwright would lose
	// the process. It stays in the foreground, outside the lock file of a manual preview.
	webServer: {
		command: `bun run build && bun run preview --ignore-lock --host 127.0.0.1 --port ${port}`,
		env: { ASTRO_PREVIEW_BACKGROUND: '0' },
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
