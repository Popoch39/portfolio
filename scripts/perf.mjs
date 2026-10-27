// Mesure Lighthouse mobile de toutes les pages du build : quatre scores, FCP, LCP, TBT, CLS et poids
// transféré, dans un tableau Markdown prêt à coller dans une PR. Sort en échec dès qu'une catégorie
// d'une page est sous 100. Lancé à la main (`pnpm build && pnpm perf`) avant et après tout changement
// de rendu, pas dans `pnpm test` : quatorze passages de Lighthouse prennent plusieurs minutes.
// Lighthouse est épinglé et lancé à la demande par npx, sans dépendance au projet ; il pilote le
// Chromium du système (variable CHROMIUM, sinon `chromium` du PATH). Le build est servi par
// `astro preview`, arrêté quoi qu'il arrive.
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { constants, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const LIGHTHOUSE = 'lighthouse@12.8.2';

/** Les catégories Lighthouse, avec leur nom dans le verdict. */
const CATEGORIES = { performance: 'performance', accessibility: 'accessibilité', 'best-practices': 'bonnes pratiques', seo: 'SEO' };

/** Les pages du site, dans l'ordre du sitemap : une fiche ajoutée au build est mesurée d'office. */
export const pagesOf = (sitemap) => [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname);

/** Chaque catégorie d'une page sous 100 (ou sans score, si Lighthouse n'a pas pu la noter). */
export const shortfalls = (results) =>
	results.flatMap(({ page, scores }) =>
		Object.entries(CATEGORIES)
			.filter(([id]) => scores[id] !== 100)
			.map(([id, category]) => ({ page, category, score: scores[id] })),
	);

const number = (digits, minimumFractionDigits = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits });
const seconds = (ms) => `${number(1, 1).format(ms / 1000)} s`;

/** Une ligne du tableau, tirée du rapport Lighthouse d'une page. */
function resultOf(page, report) {
	if (report.runtimeError) throw new Error(`${page} : Lighthouse en échec (${report.runtimeError.code}) ${report.runtimeError.message}`);
	const scores = Object.fromEntries(Object.keys(CATEGORIES).map((id) => [id, report.categories[id]?.score == null ? null : Math.round(report.categories[id].score * 100)]));
	const metric = (id) => report.audits[id].numericValue;
	return {
		page,
		scores,
		cells: [
			...Object.keys(CATEGORIES).map((id) => scores[id] ?? '—'),
			seconds(metric('first-contentful-paint')),
			seconds(metric('largest-contentful-paint')),
			`${number(0).format(metric('total-blocking-time'))} ms`,
			number(3).format(metric('cumulative-layout-shift')),
			`${number(0).format(metric('total-byte-weight') / 1024)} Kio`,
		],
	};
}

const table = (results) =>
	[
		'| Page | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Poids transféré |',
		'|---|---|---|---|---|---|---|---|---|---|',
		...results.map(({ page, cells }) => `| \`${page}\` | ${cells.join(' | ')} |`),
	].join('\n');

/** Le chemin absolu d'un navigateur : Lighthouse ne cherche pas une commande dans le PATH. */
function browserPath(command) {
	if (command.includes('/')) return command;
	const found = (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, command)).find((path) => statSync(path, { throwIfNoEntry: false })?.isFile());
	if (!found) throw new Error(`\`${command}\` introuvable dans le PATH : installer Chromium ou le désigner par la variable CHROMIUM.`);
	return found;
}

const freePort = () =>
	new Promise((resolve, reject) => {
		const probe = createServer().once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const { port } = probe.address();
			probe.close(() => resolve(port));
		});
	});

/** `astro preview` au premier plan, sur un port libre : d'autres mesures peuvent tourner à côté. */
async function startPreview(root) {
	const port = await freePort();
	const server = spawn(
		process.execPath,
		[fileURLToPath(new URL('node_modules/astro/bin/astro.mjs', root)), 'preview', '--host', '127.0.0.1', '--port', String(port), '--ignore-lock'],
		// Astro passe la prévisualisation en arrière-plan détaché quand il croit parler à un agent :
		// on la garde attachée pour pouvoir l'arrêter.
		{ cwd: fileURLToPath(root), env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: '0' }, stdio: ['ignore', 'ignore', 'inherit'] },
	);
	const origin = `http://127.0.0.1:${port}`;
	const exited = new Promise((_, reject) => server.once('exit', (code) => reject(new Error(`astro preview s'est arrêté (code ${code}) avant de servir le build.`))));
	const ready = (async () => {
		for (const deadline = Date.now() + 30_000; Date.now() < deadline; await new Promise((r) => setTimeout(r, 200))) {
			// Connexion refusée tant que le serveur n'écoute pas : on réessaie.
			if (await fetch(`${origin}/`).then((response) => response.ok, () => false)) return;
		}
		throw new Error(`astro preview ne répond pas sur ${origin} après 30 s.`);
	})();
	try {
		await Promise.race([ready, exited]);
	} catch (error) {
		server.kill();
		throw error;
	}
	return { origin, server };
}

async function main() {
	const root = new URL('../', import.meta.url);
	const sitemap = new URL('dist/sitemap.xml', root);
	if (!existsSync(sitemap)) throw new Error('dist/sitemap.xml introuvable : lancer `pnpm build` avant la mesure.');
	const pages = pagesOf(readFileSync(sitemap, 'utf8'));
	const chrome = browserPath(process.env.CHROMIUM ?? 'chromium');
	const run = promisify(execFile);
	let measuring;
	const lighthouse = (args) => {
		const pending = run('npx', ['--yes', LIGHTHOUSE, ...args], { env: { ...process.env, CHROME_PATH: chrome }, maxBuffer: 64 * 1024 * 1024 });
		measuring = pending.child;
		return pending;
	};

	console.error(`Lighthouse ${(await lighthouse(['--version'])).stdout.trim()}, ${chrome}`);
	const { origin, server } = await startPreview(root);
	const scratch = mkdtempSync(join(tmpdir(), 'perf-'));
	const stop = () => {
		server.kill();
		rmSync(scratch, { recursive: true, force: true });
	};
	process.once('exit', stop);
	// Ctrl-C ou arrêt demandé : le serveur part avec la mesure. Lighthouse ne ferme son Chromium que
	// sur SIGINT : il le reçoit, et on attend qu'il ait fini avant de partir.
	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		process.once(signal, async () => {
			stop();
			if (measuring.exitCode === null && measuring.signalCode === null) {
				measuring.kill('SIGINT');
				await once(measuring, 'exit');
			}
			process.exit(128 + constants.signals[signal]);
		});
	}
	try {
		const results = [];
		for (const [index, page] of pages.entries()) {
			console.error(`(${index + 1}/${pages.length}) ${page}`);
			const output = join(scratch, `${index}.json`);
			await lighthouse([
				`${origin}${page}`,
				'--quiet',
				'--output=json',
				`--output-path=${output}`,
				`--only-categories=${Object.keys(CATEGORIES).join(',')}`,
				'--chrome-flags=--headless=new',
			]);
			results.push(resultOf(page, JSON.parse(readFileSync(output, 'utf8'))));
		}
		console.log(table(results));
		const below = shortfalls(results);
		if (below.length) {
			console.error(`\nSous 100 :\n${below.map(({ page, category, score }) => `  ${page} : ${category} ${score ?? 'sans score'}`).join('\n')}`);
			process.exitCode = 1;
		}
	} finally {
		stop();
	}
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
