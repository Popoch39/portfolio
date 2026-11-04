import { defineConfig, devices } from '@playwright/test';
import e2e from './playwright.config';
import type { ProfileOptions } from './tests/perf/profile';

/**
 * The fluidity bench (`bun run perf`): same built site and same per-worktree port as the e2e, in a
 * test directory of its own so that `bun run test:e2e` never runs it. One test at a time: two
 * measures sharing the CPU would each slow the other down.
 */
export default defineConfig<ProfileOptions>({
	testDir: 'tests/perf',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	// The Intro alone lasts about 10 s, then the whole page is scrolled under a trace at CPU ×4.
	timeout: 300_000,
	reporter: 'list',
	use: {
		baseURL: e2e.use?.baseURL,
		reducedMotion: 'no-preference',
	},
	projects: [
		{
			name: 'mouse',
			testMatch: 'scroll.spec.ts',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, profile: 'mouse' },
		},
		{
			name: 'finger',
			testMatch: 'scroll.spec.ts',
			use: {
				...devices['Pixel 7'],
				viewport: { width: 412, height: 915 },
				hasTouch: true,
				isMobile: true,
				profile: 'finger',
			},
		},
		{
			name: 'lighthouse',
			testMatch: 'lighthouse.spec.ts',
		},
	],
	webServer: e2e.webServer,
});
