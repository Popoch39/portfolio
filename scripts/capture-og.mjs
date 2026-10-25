// Capture scripts/og-composition.html en public/og.png (1200×630) avec Chromium headless.
// Lancé à la main (`pnpm og:capture`) quand la composition change, pas au build :
// l'image est versionnée, le build n'a besoin ni de navigateur ni de dépendance.
// Navigateur : variable CHROMIUM, sinon `chromium` du PATH.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const composition = new URL('./og-composition.html', import.meta.url);
const output = fileURLToPath(new URL('../public/og.png', import.meta.url));

execFileSync(
	process.env.CHROMIUM ?? 'chromium',
	[
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		'--force-device-scale-factor=1',
		'--window-size=1200,630',
		// Laisse le temps aux polices distantes d'arriver (font-display: block).
		'--virtual-time-budget=10000',
		`--screenshot=${output}`,
		composition.href,
	],
	{ stdio: 'inherit' },
);
console.log(`Image de partage écrite : ${output}`);
