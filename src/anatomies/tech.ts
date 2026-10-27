// Logos des technologies des notes, tirés de Simple Icons (CC0, `src/vendor/simple-icons/`) au
// build : chaque fiche n'en livre que ceux de ses notes, une fois, en symboles réutilisés.
import type { Tech } from './contract.ts';

const files = import.meta.glob<string>('../vendor/simple-icons/*.svg', { query: '?raw', import: 'default', eager: true });

export interface Logo {
	/** Le nom de la technologie, celui de Simple Icons (« TypeScript »). */
	name: string;
	/** Le tracé du logo, dans un carré de 24 unités. */
	path: string;
}

const logos = new Map(
	Object.entries(files).map(([file, svg]) => {
		const key = file.split('/').pop()!.replace(/\.svg$/, '');
		const name = /<title>([^<]+)<\/title>/.exec(svg)?.[1];
		const path = /\sd="([^"]+)"/.exec(svg)?.[1];
		if (!name || !path) throw new Error(`Logo « ${key} » : titre ou tracé introuvable`);
		return [key, { name: name.replaceAll('&amp;', '&'), path }] as const;
	}),
);

export function logoOf(tech: Tech): Logo {
	const logo = logos.get(tech);
	if (!logo) throw new Error(`Logo « ${tech} » absent de src/vendor/simple-icons/`);
	return logo;
}
