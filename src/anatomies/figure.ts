// Habillage de la figure au repos en `<svg>` : intégré à la page (la CSS du kit et la palette
// viennent de la page) ou autonome (styles embarqués), pour l'image d'attente, l'aperçu et la
// capture de l'image de partage.
import { figureSvg } from '../vendor/anatomy/iso-kit.ts';
import palette from './palette.css?raw';
import type { Anatomy } from './contract.ts';

export function restSvg({ content, renderRest }: Anatomy, { standalone = false } = {}) {
	const { width, height, body } = renderRest();
	assertHooks(content.slug, body, content.pieces.map((piece) => piece.id));
	return figureSvg({
		width,
		height,
		label: content.label,
		body: standalone ? [`<style>${palette}</style>`, body] : body,
		standalone: standalone ? 'light' : false,
		className: 'anatomy',
	});
}

/** Les crochets de pièce du SVG doivent être exactement les identifiants de la nomenclature. */
function assertHooks(slug: string, body: string, ids: string[]) {
	const hooks = new Set([...body.matchAll(/\sdata-piece="([^"]*)"/g)].map((match) => match[1]));
	const missing = ids.filter((id) => !hooks.has(id));
	const extra = [...hooks].filter((hook) => !ids.includes(hook));
	if (missing.length || extra.length) {
		throw new Error(
			`Anatomie « ${slug} » : crochets de pièce du SVG et nomenclature diffèrent (absents du SVG : ${missing.join(', ') || 'aucun'} ; inconnus : ${extra.join(', ') || 'aucun'}).`,
		);
	}
}
