// L'aperçu A3 de la section Projets, importé par son script une fois la bascule vérifiée. La ligne
// survolée ou focalisée devient la sélection, qui reste quand le pointeur quitte la liste. À
// l'approche de la section, les SVG au repos arrivent ; le panneau actif passe en SVG inséré, dont
// le chargeur des fiches monte le mouvement ; les autres mouvements sont préchargés quand le
// navigateur est inactif.
import { mountFigure, preloadMotion } from '../anatomies/loader.ts';
import { linkPieces } from '../anatomies/highlight.ts';

const idle = (task: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(task) : setTimeout(task, 200));

const fetchRest = async (src: string) => {
	const response = await fetch(src);
	if (!response.ok) throw new Error(`Aperçu : ${src} a répondu ${response.status}`);
	return response.text();
};

/**
 * Le SVG au repos autonome, inséré dans la scène sans ses styles ni ses trames : la page a déjà
 * ceux du kit, la palette et les trames du grain, dont les `id` doivent rester uniques.
 */
const insert = (scene: HTMLElement, markup: string) => {
	const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
	if (!(svg instanceof SVGSVGElement)) throw new Error('Aperçu : SVG au repos illisible');
	for (const embedded of svg.querySelectorAll('style, defs[data-grain]')) embedded.remove();
	const inserted = document.importNode(svg, true);
	scene.replaceChildren(inserted);
	linkPieces(scene);
	return inserted;
};

export function preview(section: HTMLElement) {
	const rows = [...section.querySelectorAll<HTMLAnchorElement>('ol > li > a')];
	const panels = [...section.querySelectorAll<HTMLElement>('[data-panel]')].flatMap((panel) => {
		const scene = panel.querySelector<HTMLElement>('[data-motion]');
		const releve = panel.querySelector<HTMLElement>('[data-releve]');
		const src = scene?.querySelector('source')?.getAttribute('srcset');
		return scene?.dataset.motion && releve && src ? [{ panel, scene, releve, src, motion: scene.dataset.motion }] : [];
	});
	if (rows.length === 0 || rows.length !== panels.length) return;

	let selected = Math.max(rows.findIndex((row) => row.hasAttribute('data-selected')), 0);
	let rests: Promise<string>[] | null = null;
	/** Chaque panneau n'est inséré qu'une fois, même quand on y revient pendant son arrivée. */
	const inserted = new Map<number, Promise<SVGSVGElement>>();
	let pending: AbortController | null = null;
	let stopShown = () => {};

	// Changer de projet arrête l'ancienne figure ; un changement rapide annule le montage en cours.
	const show = async (index: number) => {
		pending?.abort();
		stopShown();
		stopShown = () => {};
		const attempt = (pending = new AbortController());
		const { scene, releve, motion } = panels[index];
		const rest = rests?.[index];
		if (!rest) return;
		if (!inserted.has(index)) inserted.set(index, rest.then((markup) => insert(scene, markup)));
		const svg = await inserted.get(index);
		if (!svg || attempt.signal.aborted) return;
		const stop = await mountFigure({ scene, svg, releve }, motion, { signal: attempt.signal });
		if (attempt.signal.aborted) stop();
		else stopShown = stop;
	};

	const select = (index: number) => {
		if (index < 0 || index === selected) return;
		selected = index;
		rows.forEach((row, i) => row.toggleAttribute('data-selected', i === index));
		panels.forEach(({ panel }, i) => panel.toggleAttribute('data-active', i === index));
		if (rests) void show(index);
	};
	const rowOf = (target: EventTarget | null) => (target instanceof Node ? rows.findIndex((row) => row.contains(target)) : -1);
	const list = rows[0].closest('ol');
	list?.addEventListener('pointerover', (event) => select(rowOf(event.target)));
	list?.addEventListener('focusin', (event) => select(rowOf(event.target)));

	// Parcours clavier : chaque ligne, puis son aperçu (la scène une fois montée, puis « Ouvrir la
	// fiche »), puis la ligne suivante ; Maj+Tab refait le chemin à l'envers. L'aperçu vient après la
	// liste dans le document : sans ce relais, Tab traverserait toutes les lignes, donc toutes les
	// sélections, avant de l'atteindre. Aux deux bouts du chemin, Tab sort de la section normalement.
	const stopsOf = (index: number) => {
		const { panel, scene } = panels[index];
		const open = panel.querySelector<HTMLAnchorElement>('a[href]');
		return [rows[index], ...(scene.hasAttribute('tabindex') ? [scene] : []), ...(open ? [open] : [])];
	};
	section.addEventListener('keydown', (event) => {
		if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
		const path = rows.flatMap((_, index) => stopsOf(index));
		const at = path.findIndex((stop) => stop === event.target);
		const next = at < 0 ? undefined : path[at + (event.shiftKey ? -1 : 1)];
		if (!next) return;
		event.preventDefault();
		// Un panneau masqué ne prend pas le focus : sa sélection le rend visible d'abord.
		const row = rows.findIndex((candidate) => candidate === next);
		select(row >= 0 ? row : panels.findIndex(({ panel }) => panel.contains(next)));
		next.focus();
	});

	const approach = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			approach.disconnect();
			rests = panels.map(({ src }) => fetchRest(src));
			void show(selected);
			idle(() => {
				const others = new Set(panels.map(({ motion }) => motion));
				others.delete(panels[selected].motion);
				for (const motion of others) void preloadMotion(motion);
			});
		},
		{ rootMargin: '100% 0px' },
	);
	approach.observe(section);
}
