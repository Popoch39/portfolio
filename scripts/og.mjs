// Redraws src/assets/og.png (1200×630) in the site's fonts and palette (ADR 0006).
// Run it again when the name, the tagline or the palette changes: `node scripts/og.mjs`.
// Requires the Playwright browsers (`bunx playwright install chromium`) and ImageMagick.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '..');
const FONTS = pathToFileURL(join(ROOT, 'src/assets/fonts')).href;
const OUTPUT = join(ROOT, 'src/assets/og.png');

// The palette of src/styles/global.css: a screenshot cannot read the site's custom properties.
const paper = '#efeee9';
const ink = '#141412';
const inkMuted = '#5e5d58';
const bar = '#2a2a27';
const accent = '#ff5b14';

const html = `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<style>
@font-face { font-family: Archivo; src: url(${FONTS}/archivo-variable.woff2) format('woff2'); font-weight: 400 900; font-stretch: 62% 100%; }
@font-face { font-family: 'Fragment Mono'; src: url(${FONTS}/fragment-mono-400.woff2) format('woff2'); }
html, body { margin: 0; }
body { position: relative; width: 1200px; height: 630px; overflow: hidden; background: ${paper}; color: ${ink}; font-family: Archivo, sans-serif; }
.mono { font-family: 'Fragment Mono', monospace; }
.top { position: absolute; left: 56px; right: 56px; top: 42px; display: flex; justify-content: space-between; padding-bottom: 22px; border-bottom: 2px solid ${ink}; font-size: 22px; }
.top .muted { color: ${inkMuted}; }
h1 { position: absolute; left: 52px; top: 120px; margin: 0; font-size: 204px; line-height: 0.84; font-weight: 900; font-stretch: 62%; letter-spacing: -0.015em; text-transform: uppercase; }
.line { display: block; }
.cursor { display: inline-block; width: 0.34em; height: 0.8em; margin-left: 0.08em; vertical-align: -0.01em; background: ${accent}; }
.sub { position: absolute; left: 56px; top: 476px; margin: 0; font-size: 34px; letter-spacing: -0.01em; }
/* The accent never carries text on the paper: the specialty is selected in ink, as in the lede. */
.sub .selected { padding: 0 8px; background: ${ink}; color: ${paper}; }
.statusline { position: absolute; inset: auto 0 0; display: flex; height: 40px; background: ${ink}; color: ${paper}; font-size: 18px; line-height: 40px; }
.statusline > span { padding: 0 18px; }
.mode { background: ${accent}; color: ${ink}; }
.segment { background: ${bar}; }
.end { margin-left: auto; }
</style>
<div class="top mono"><span>--&nbsp;NORMAL&nbsp;--</span><span class="muted">Concepteur &amp; développeur d’applications</span></div>
<h1><span class="line">Louis</span><span class="line">Pocheron<span class="cursor"></span></span></h1>
<p class="sub">Fullstack · <span class="selected">SIG &amp; cartographie</span> · Rust, TypeScript, React</p>
<div class="statusline mono"><span class="mode">NORMAL</span><span class="segment">main</span><span>~/louis/portfolio.md</span><span class="end">Besançon</span><span class="mode">:wq</span></div>
</html>`;

const tmp = mkdtempSync(join(tmpdir(), 'og-'));
try {
	const page = join(tmp, 'og.html');
	const shot = join(tmp, 'og.png');
	writeFileSync(page, html);
	const browser = await chromium.launch();
	const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
	await tab.goto(pathToFileURL(page).href);
	await tab.evaluate(() => document.fonts.ready);
	await tab.screenshot({ path: shot });
	await browser.close();
	// Flat colours and the text's antialiasing fit in a 64-colour palette: well under half the size.
	execFileSync('magick', [shot, '-strip', '-colors', '64', `PNG8:${OUTPUT}`]);
	console.log(`wrote ${OUTPUT}`);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
