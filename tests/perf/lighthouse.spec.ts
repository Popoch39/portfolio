import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import lighthouse, { type Config, type Result } from 'lighthouse';
import { RESULTS, saveSection, table } from './report';

/**
 * Lighthouse mobile through its Node API, in Playwright's Chromium: unlike the DevTools MCP's audit,
 * it scores Performance. The default config is the mobile one (Moto G Power, simulated slow 4G and
 * CPU ×4). Every category must score 100.
 */
const PAGES: { name: string; path: string; settings?: Config['settings'] }[] = [
	{ name: 'home', path: '/' },
	// The 404 page at its own address, served with a 200: under its real 404 status, Lighthouse
	// refuses the page, or counts that status against it twice (SEO, and the console error of the
	// document itself). Its `noindex` is the page's very point: that SEO audit is left out.
	{ name: '404', path: '/404', settings: { skipAudits: ['is-crawlable'] } },
];

/** The four categories of the project's target (CLAUDE.md); newer ones are left out. */
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const METRICS = [
	'first-contentful-paint',
	'largest-contentful-paint',
	'total-blocking-time',
	'cumulative-layout-shift',
	'speed-index',
];

test('Lighthouse mobile scores 100 in every category on the home page and the 404', async ({ baseURL }) => {
	mkdirSync(RESULTS, { recursive: true });
	const port = await freePort();
	const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
	const breaches: string[] = [];
	const section: Record<string, unknown> = {};
	const lines: string[] = [];
	try {
		for (const { name, path, settings } of PAGES) {
			// The Web Analytics beacon only reports from the real domain: from localhost Cloudflare refuses
			// it (CORS), a console error the live site never shows. Measured apart on the home page: ~110 ms
			// of TBT under CPU ×4, Performance still 99.
			const blockedUrlPatterns = ['*cloudflareinsights.com*'];
			const config: Config = {
				extends: 'lighthouse:default',
				settings: { onlyCategories: CATEGORIES, blockedUrlPatterns, ...settings },
			};
			const result = await lighthouse(new URL(path, baseURL).href, { port, logLevel: 'error', output: 'html' }, config);
			if (!result) throw new Error(`Lighthouse returned nothing for ${path}`);
			if (result.lhr.runtimeError) throw new Error(`Lighthouse could not audit ${path}: ${result.lhr.runtimeError.message}`);
			writeFileSync(join(RESULTS, `lighthouse-${name}.html`), String(result.report));
			const summary = summarise(result.lhr);
			section[name] = summary;
			lines.push(`Lighthouse mobile, ${name} (${path})`);
			lines.push(...table([Object.keys(summary.scores), Object.values(summary.scores).map(String)]));
			lines.push(`  ${Object.entries(summary.metrics).map(([metric, value]) => `${metric} ${value}`).join(', ')}`);
			for (const audit of summary.failing) lines.push(`  ${audit}`);
			for (const [category, score] of Object.entries(summary.scores)) {
				if (score < 100) breaches.push(`${name}: ${category} ${score} < 100`);
			}
		}
	} finally {
		await browser.close();
	}
	saveSection('lighthouse', section);
	console.log(lines.join('\n'));

	expect.soft(breaches, 'Lighthouse mobile budgets (perf-results/lighthouse-*.html)').toEqual([]);
});

/** Scores out of 100, the main metrics, and every audit that costs points. */
function summarise(lhr: Result) {
	const scores = Object.fromEntries(
		Object.values(lhr.categories).map((category) => [category.id, Math.round((category.score ?? 0) * 100)]),
	);
	const metrics = Object.fromEntries(METRICS.map((id) => [id, lhr.audits[id]?.displayValue ?? '?']));
	const weighted = new Set(
		Object.values(lhr.categories).flatMap((category) => category.auditRefs.filter((ref) => ref.weight > 0).map((ref) => ref.id)),
	);
	const failing = Object.values(lhr.audits)
		.filter((audit) => weighted.has(audit.id) && audit.score !== null && audit.score < 1)
		.map((audit) => `${audit.id}: ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
	return { scores, metrics, failing };
}

/** A port nobody listens on, for Chromium's remote debugging, which Lighthouse drives. */
function freePort() {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
		});
	});
}
