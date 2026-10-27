// Capture les images de partage (1200×630) avec Chromium headless : celle de l'accueil dans chaque
// langue (scripts/og-composition.html → public/og.png, public/og.en.png) et celle de chaque fiche
// dans chaque langue (scripts/og-fiche.html, remplie avec le projet et son SVG au repos →
// public/og/<slug>.png, public/og/<slug>.en.png).
// Lancé à la main (`pnpm build && pnpm og:capture`) quand une composition ou une figure change,
// pas au build : les images sont versionnées, le build n'a besoin ni de navigateur ni de dépendance.
// Navigateur : variable CHROMIUM, sinon `chromium` du PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { identity, pageMeta, projects, restFigurePath, shareCaption, shareImagePath } from '../src/data/profile.ts';
import { formats, locales, ui } from '../src/lib/i18n.ts';

const root = new URL('../', import.meta.url);
const pad = (n) => String(n).padStart(2, '0');
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function capture(compositionUrl, output) {
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
			compositionUrl,
		],
		{ stdio: 'inherit' },
	);
	console.log(`Image de partage écrite : ${output}`);
}

/** Remplit les champs `%KEY%` d'un gabarit ; un champ inconnu reste tel quel. */
const fill = (template, fields) => template.replace(/%([A-Z_]+)%/g, (match, key) => fields[key] ?? match);

const homeTemplate = readFileSync(new URL('scripts/og-composition.html', root), 'utf8');
const template = readFileSync(new URL('scripts/og-fiche.html', root), 'utf8');
const scratch = mkdtempSync(join(tmpdir(), 'og-'));
mkdirSync(new URL('public/og/', root), { recursive: true });
try {
	for (const locale of locales) {
		const fields = {
			LANG: formats[locale].lang,
			ROLE: escapeHtml(shareCaption[locale].role),
			PLACE: escapeHtml(shareCaption[locale].place),
		};
		const composition = join(scratch, `home.${locale}.html`);
		writeFileSync(composition, fill(homeTemplate, fields));
		capture(pathToFileURL(composition).href, fileURLToPath(new URL(`public${pageMeta[locale].shareImage.path}`, root)));
	}

	for (const locale of locales) {
		for (const [index, project] of projects.entries()) {
			const figure = new URL(`dist${restFigurePath(project, locale)}`, root);
			if (!existsSync(figure)) {
				throw new Error(`${fileURLToPath(figure)} introuvable : lancer \`pnpm build\` avant la capture.`);
			}
			const fields = {
				LANG: formats[locale].lang,
				REPO: escapeHtml(project.repo),
				// Le nom peut passer à la ligne après un tiret ou un point, jamais au milieu d'un mot ;
				// pas après « _ », qui descend sous la ligne de base et heurterait la ligne suivante.
				REPO_BREAKABLE: escapeHtml(project.repo).replace(/[-.]/g, '$&<wbr>'),
				FILE: escapeHtml(ui.ficheFile[locale](project.repo)),
				RANK: escapeHtml(ui.ficheRank[locale](pad(index + 1), pad(projects.length))),
				STACK: escapeHtml(project.stack.join(' · ')),
				AUTHOR: escapeHtml(identity.name),
				FIGURE: readFileSync(figure, 'utf8'),
			};
			const composition = join(scratch, `${project.slug}.${locale}.html`);
			writeFileSync(composition, fill(template, fields));
			capture(pathToFileURL(composition).href, fileURLToPath(new URL(`public${shareImagePath(project, locale)}`, root)));
		}
	}
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
