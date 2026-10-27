// Relève où les notes de la fiche touchent chaque pièce : ses boîtes (le viseur s'y cale) et son
// premier point visible en venant de chaque côté (la pointe du trait s'y pose), dans les unités de
// la figure au repos → src/anatomies/<slug>/anchors.json. La fiche place ainsi notes, traits et
// viseurs en CSS seule, sans mesurer la figure dans le navigateur.
// Mesuré dans Chromium headless (variable CHROMIUM, sinon `chromium` du PATH) sur le SVG autonome du
// build. Lancé à la main (`pnpm build && pnpm ancres`) quand une figure change : le relevé porte
// l'empreinte de la figure mesurée, et le build échoue s'il ne correspond plus.
// La figure française suffit : un relevé sert aux deux versions, et l'empreinte vérifiée au build de
// chaque version fait échouer celle dont la figure dessinerait autre chose.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projects, restFigurePath } from '../src/data/profile.ts';
import { defaultLocale } from '../src/lib/i18n.ts';
import { figurePrint } from '../src/anatomies/anchors.ts';

const root = new URL('../', import.meta.url);

/**
 * Le relevé, exécuté dans la page : la figure y est dessinée à peu près à sa taille naturelle (sa
 * CSS l'étire à la fenêtre). Un point est visible quand la pièce est ce qui s'y voit.
 */
function measure() {
	const svg = document.querySelector('svg');
	const origin = svg.getBoundingClientRect();
	// La mesure se fait en pixels, le relevé s'écrit en unités de la figure.
	const unit = svg.viewBox.baseVal.width / origin.width;
	const round = (value) => Math.round(value * unit * 10) / 10;
	const ids = [...new Set([...svg.querySelectorAll('[data-piece]')].map((hook) => hook.getAttribute('data-piece')))];
	// Un élément transparent (une pose cachée au repos) reste atteignable par le pointeur : seul compte
	// le premier élément peint sous le point.
	const hidden = new Map();
	const painted = (element) => {
		for (let node = element; node && node !== svg; node = node.parentElement) {
			if (!hidden.has(node)) {
				const style = getComputedStyle(node);
				hidden.set(node, style.opacity === '0' || style.visibility !== 'visible' || style.display === 'none');
			}
			if (hidden.get(node)) return false;
		}
		return true;
	};
	const pieceAt = (x, y) =>
		document
			.elementsFromPoint(origin.left + x, origin.top + y)
			.find(painted)
			?.closest('[data-piece]')
			?.getAttribute('data-piece');
	const out = {};
	for (const id of ids) {
		const hooks = [...svg.querySelectorAll(`[data-piece="${CSS.escape(id)}"]`)];
		const visible = (x, y) => pieceAt(x, y) === id;
		// Les boîtes des crochets, fusionnées quand elles se touchent : une pièce en deux endroits (les
		// deux tambours) garde deux boîtes.
		let boxes = hooks
			.map((hook) => hook.getBoundingClientRect())
			.filter((box) => box.width > 0 && box.height > 0)
			.map((box) => ({ left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top }));
		for (let merged = true; merged; ) {
			merged = false;
			outer: for (let i = 0; i < boxes.length; i++) {
				for (let j = i + 1; j < boxes.length; j++) {
					const [a, b] = [boxes[i], boxes[j]];
					if (a.left <= b.right + 6 && b.left <= a.right + 6 && a.top <= b.bottom + 6 && b.top <= a.bottom + 6) {
						boxes[i] = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
						boxes.splice(j, 1);
						merged = true;
						break outer;
					}
				}
			}
		}
		const all = boxes.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }));
		// Les points visibles, sur une grille de la boîte de la pièce : au pas d'une unité, élargi sur les
		// grandes pièces pour rester sous quinze mille essais.
		const step = Math.max(1, Math.sqrt(((all.right - all.left) * (all.bottom - all.top)) / 15000));
		const points = [];
		for (let x = Math.ceil(all.left); x <= all.right; x += step) {
			for (let y = Math.ceil(all.top); y <= all.bottom; y += step) if (visible(x, y)) points.push([x, y]);
		}
		const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
		const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
		// Le premier point visible d'un côté : le plus avancé de ce côté, à 3 unités près le plus proche
		// du milieu de la pièce, pour que le trait n'accroche pas un coin.
		const extreme = (key, sign, across, middle) => {
			const best = Math.min(...points.map((p) => sign * p[key]));
			const near = points.filter((p) => sign * p[key] <= best + 3);
			const pick = near.reduce((a, b) => (Math.abs(b[across] - middle) < Math.abs(a[across] - middle) ? b : a));
			return pick.map(round);
		};
		const center = points.reduce((a, b) => (Math.hypot(b[0] - cx, b[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? b : a));
		// Chaque boîte resserrée sur ce qui s'y voit : le viseur entoure la pièce telle qu'elle est dessinée.
		const seen = boxes
			.map((box) => points.filter(([x, y]) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom))
			.filter((inside) => inside.length)
			.map((inside) => {
				const xs = inside.map(([x]) => x);
				const ys = inside.map(([, y]) => y);
				return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
			});
		out[id] = {
			boxes: seen.map((box) => [box.left, box.top, box.right - box.left, box.bottom - box.top].map(round)),
			top: extreme(1, 1, 0, cx),
			bottom: extreme(1, -1, 0, cx),
			left: extreme(0, 1, 1, cy),
			right: extreme(0, -1, 1, cy),
			center: center.map(round),
		};
	}
	document.querySelector('#out').textContent = JSON.stringify(out);
}

const scratch = mkdtempSync(join(tmpdir(), 'ancres-'));
try {
	for (const project of projects) {
		const figure = new URL(`dist${restFigurePath(project, defaultLocale)}`, root);
		if (!existsSync(figure)) throw new Error(`${fileURLToPath(figure)} introuvable : lancer \`pnpm build\` avant le relevé.`);
		const { anatomy } = await import(`../src/anatomies/${project.slug}/index.ts`);
		const { width, height, body } = anatomy.renderRest(defaultLocale);
		const svg = readFileSync(figure, 'utf8').replace('<svg ', `<svg width="${width}" height="${height}" `);
		const page = join(scratch, `${project.slug}.html`);
		writeFileSync(
			page,
			`<!doctype html><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style>${svg}<pre id="out"></pre><script>(${measure})()</script>`,
		);
		const dom = execFileSync(
			process.env.CHROMIUM ?? 'chromium',
			['--headless=new', '--disable-gpu', `--window-size=${Math.ceil(width) + 40},${Math.ceil(height) + 200}`, '--dump-dom', pathToFileURL(page).href],
			{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
		);
		const json = dom.match(/<pre id="out">([^<]*)<\/pre>/)?.[1];
		if (!json) throw new Error(`${project.slug} : relevé vide`);
		const pieces = JSON.parse(json.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
		// Une pièce par ligne : le diff d'un nouveau relevé se lit pièce par pièce.
		const lines = Object.entries(pieces).map(([id, anchors]) => `\t\t${JSON.stringify(id)}: ${JSON.stringify(anchors)}`);
		const output = new URL(`src/anatomies/${project.slug}/anchors.json`, root);
		writeFileSync(output, `{\n\t"print": ${JSON.stringify(figurePrint(body))},\n\t"width": ${width},\n\t"height": ${height},\n\t"pieces": {\n${lines.join(',\n')}\n\t}\n}\n`);
		console.log(`Ancrages écrits : src/anatomies/${project.slug}/anchors.json`);
	}
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
