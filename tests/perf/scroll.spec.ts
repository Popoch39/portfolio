import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { CDPSession, Page } from '@playwright/test';
import { CPU_THROTTLING, expect, test } from './profile';
import { formatScroll, RESULTS, saveSection } from './report';
import { analyseTrace, budgetBreaches, MARK, SCENE_SECTIONS, traceEvents } from './trace';

/** What DevTools records for its Performance panel, frames and layout shifts included. */
const CATEGORIES = [
	'toplevel',
	'devtools.timeline',
	'disabled-by-default-devtools.timeline',
	'disabled-by-default-devtools.timeline.frame',
	'blink.user_timing',
	'loading',
	'cc',
	'benchmark',
	// Off by default: the sampler costs main-thread time. With it, the saved trace shows the JS
	// call tree in DevTools, to find which code a long task runs.
	...(process.env.PERF_JS_SAMPLES ? ['disabled-by-default-v8.cpu_profiler'] : []),
];

/** The wheel: a notch every 100 ms, about a window per second. */
const WHEEL_STEP = 100;
const WHEEL_INTERVAL = 100;
/** A swipe: half a window in 12 moves, one per 60 Hz frame, then the finger lifts for a moment. */
const SWIPE_SHARE = 0.5;
const SWIPE_MOVES = 12;
const SWIPE_PAUSE = 300;
/** Long enough for Défilement lissé (1.5 s) and the scenes' lag (`SCENE_SCRUB`, 1 s) to settle. */
const SETTLE = 3_000;

test('the home page holds the fluidity budgets, Intro then scroll from top to bottom', async ({ browser, page, profile }) => {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLING[profile] });
	await watchIntro(page);

	await browser.startTracing(page, { categories: CATEGORIES });
	// A direct visit, without a referrer: the Intro plays.
	await page.goto('/');
	expect(await page.evaluate(() => window.perfIntroPlayed), 'the Intro did not play').toBe(true);
	await waitForScenes(page);
	await markPhases(page);

	if (profile === 'mouse') await scrollWithWheel(page);
	else await scrollWithFinger(page, cdp);
	await page.waitForTimeout(SETTLE);
	await page.evaluate((end) => performance.mark(end), MARK.end);
	const trace = await browser.stopTracing();

	mkdirSync(RESULTS, { recursive: true });
	// Opens in the DevTools Performance panel as is.
	writeFileSync(join(RESULTS, `${profile}.trace.json.gz`), gzipSync(trace));
	const metrics = analyseTrace(traceEvents(JSON.parse(trace.toString('utf8'))));
	saveSection(profile, { cpuThrottling: CPU_THROTTLING[profile], viewport: page.viewportSize(), ...metrics });
	console.log(formatScroll(profile, metrics));

	expect.soft(budgetBreaches(metrics), 'budgets of #68 (perf-results/report.json)').toEqual([]);
});

declare global {
	interface Window {
		/** Settles once the Intro has ended: `true`, or `false` if it never started. */
		perfIntroPlayed?: Promise<boolean>;
	}
}

/**
 * Marks the end of the Intro, when `<html>` loses its `intro` class, without polling: a poll would
 * add frames of its own to the ones measured.
 */
function watchIntro(page: Page) {
	return page.addInitScript((introEnd) => {
		if (location.pathname !== '/') return;
		let started = false;
		window.perfIntroPlayed = new Promise((resolve) => {
			const observer = new MutationObserver(() => {
				if (document.documentElement.classList.contains('intro')) started = true;
				else if (started) {
					observer.disconnect();
					performance.mark(introEnd);
					resolve(true);
				}
			});
			const watch = () => observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
			// Init scripts run before the parser has created `<html>`, and its `<head>` sets the class.
			if (document.documentElement) watch();
			else {
				new MutationObserver((_, waiting) => {
					if (!document.documentElement) return;
					waiting.disconnect();
					watch();
				}).observe(document, { childList: true });
			}
			addEventListener('load', () => started || resolve(false), { once: true });
		});
	}, MARK.introEnd);
}

/**
 * The scenes are built once the Intro has ended: their pins are in place, and a moment later the
 * page is still. Their build is measured within the Intro phase.
 */
async function waitForScenes(page: Page) {
	await page.waitForFunction(() => document.querySelector('.pin-spacer'), null, { polling: 100 });
	await page.waitForTimeout(1_000);
}

/**
 * From now on, marks the scroll's start and each scene section crossing the middle of the window,
 * as drawn (smoothing and pins included): the trace is split into phases by these marks.
 */
function markPhases(page: Page) {
	return page.evaluate(
		({ sections, scroll }) => {
			const phaseOf = new Map<Element, string>();
			const observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						performance.mark(`perf:${entry.isIntersecting ? 'enter' : 'leave'}:${phaseOf.get(entry.target)}`);
					}
				},
				{ rootMargin: '-50% 0px -50% 0px' },
			);
			for (const [phase, selector] of Object.entries(sections)) {
				const section = document.querySelector(selector);
				if (!section) throw new Error(`no section ${selector} for the ${phase} phase`);
				phaseOf.set(section, phase);
				observer.observe(section);
			}
			performance.mark(scroll);
		},
		{ sections: SCENE_SECTIONS, scroll: MARK.scroll },
	);
}

const scrollRange = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

async function scrollWithWheel(page: Page) {
	const size = page.viewportSize();
	if (!size) throw new Error('window without a size');
	// The wheel acts under the pointer: in the middle, neither over the statusline nor outside the page.
	await page.mouse.move(size.width / 2, size.height / 2);
	const range = await scrollRange(page);
	for (let scrolled = 0; scrolled < range; scrolled += WHEEL_STEP) {
		await page.mouse.wheel(0, WHEEL_STEP);
		await page.waitForTimeout(WHEEL_INTERVAL);
	}
}

/**
 * Swipes up until the bottom of the page, by touch events replayed through CDP:
 * `Input.synthesizeScrollGesture` does not scroll the headless shell.
 */
async function scrollWithFinger(page: Page, cdp: CDPSession) {
	const size = page.viewportSize();
	if (!size) throw new Error('window without a size');
	const range = await scrollRange(page);
	const distance = size.height * SWIPE_SHARE;
	const x = size.width / 2;
	const from = size.height * 0.75;
	// Twice the swipes the page should need: past that, the page no longer scrolls.
	for (let swipes = 0; swipes < (2 * range) / distance; swipes++) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
		for (let move = 1; move <= SWIPE_MOVES; move++) {
			await page.waitForTimeout(16);
			await cdp.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x, y: from - (distance * move) / SWIPE_MOVES }],
			});
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await page.waitForTimeout(SWIPE_PAUSE);
		if ((await page.evaluate(() => scrollY)) >= range - 1) return;
	}
	throw new Error(`the page stopped scrolling before its bottom (${range} px)`);
}
