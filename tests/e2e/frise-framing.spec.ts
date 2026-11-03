import { expect, test } from './fixtures';
import {
	expectFramed,
	expectReadable,
	friseFraming,
	friseLegend,
	inFrame,
	READABLE_TEXT,
	sceneStart,
	scrollToScene,
} from './frise-helpers';

// From the small phone to the 1440p screen, held upright and on its side.
const WINDOWS = [
	{ name: 'small phone, portrait', width: 320, height: 568 },
	{ name: 'phone, portrait', width: 390, height: 844 },
	{ name: 'tablet, portrait', width: 768, height: 1024 },
	{ name: 'small phone, landscape', width: 667, height: 375 },
	{ name: 'phone, landscape', width: 844, height: 390 },
	{ name: 'tablet, landscape', width: 1024, height: 768 },
	{ name: 'laptop', width: 1280, height: 800 },
	{ name: 'desktop', width: 1440, height: 900 },
];

const FIRST = /Baccalauréat/;
const HEAD = /HEAD/;

for (const { name, width, height } of WINDOWS) {
	test.describe(`Frise framing, ${name} (${width}×${height})`, () => {
		test.use({ viewport: { width, height } });

		test('scene: in the frame from start to end, the active commit readable', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const start = await sceneStart(page);

			await scrollToScene(page, start, 0);
			await expect(friseLegend(page)).toContainText(FIRST);
			expectFramed(await friseFraming(page));
			expectReadable(await friseFraming(page), FIRST);

			// Halfway, the longest title of the career sits in the legend.
			await scrollToScene(page, start, 0.5);
			await expect(friseLegend(page)).toContainText('Concepteur & développeur d’applications');
			expectFramed(await friseFraming(page));

			await scrollToScene(page, start, 1);
			await expect(friseLegend(page)).toContainText(HEAD);
			expectFramed(await friseFraming(page));
			expectReadable(await friseFraming(page), HEAD);
		});

		test('final state: in the frame, the first commit readable', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			await page.evaluate(() => document.querySelector('#parcours')?.scrollIntoView());

			const framing = await friseFraming(page);
			expectFramed(framing);
			expectReadable(framing, FIRST);
			// Branch labels stand further from the camera: those in the frame stay readable too.
			for (const commit of framing.commits.filter((candidate) => inFrame(framing, candidate.box))) {
				expect(commit.text, commit.title).toBeGreaterThanOrEqual(READABLE_TEXT);
			}
		});
	});
}
