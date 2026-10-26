// Les trames du grain, une par facette : la palette des figures en remplit la pièce maîtresse au
// repos et la pièce visée (`url(#anatomy-grain-…)`). Le SVG autonome les embarque ; une page qui
// insère ou dessine des figures les porte une seule fois (`GrainPatterns.astro`), les `id` devant
// rester uniques.

/** Pas vertical de la grille, en unités de figure : l'écran l'agrandit jusqu'à ×1,5, il reste un grain. */
const STEP = 2.6;
/** Une grille centrée de pas STEP × STEP√3 aligne ses points sur les axes isométriques (voisins à ±30°). */
const WIDTH = STEP * Math.sqrt(3);

// Toutes les facettes partagent la grille ; l'ombre fonce trois choses à la fois, chacune d'un
// rien : le fond, l'encre et le rayon des points. `top` est le dessus, 0 la face la plus sombre.
const SHADES = [
	{ shade: 'top', r: 0.3, ground: '#f7f8ff', ink: '#8e9bff' },
	{ shade: '3', r: 0.32, ground: '#eceeff', ink: '#5b6bff' },
	{ shade: '2', r: 0.34, ground: '#e2e5ff', ink: '#2433ff' },
	{ shade: '1', r: 0.36, ground: '#d6daff', ink: '#2433ff' },
	{ shade: '0', r: 0.38, ground: '#c9ceff', ink: '#161f9e' },
];

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Les `<pattern>` du grain, à placer dans un `<defs>`. */
export const grainPatterns = SHADES.map(
	({ shade, r, ground, ink }) =>
		`<pattern id="anatomy-grain-${shade}" width="${round(WIDTH)}" height="${STEP}" patternUnits="userSpaceOnUse">` +
		`<rect width="${round(WIDTH)}" height="${STEP}" fill="${ground}"/>` +
		`<circle cx="${round(WIDTH / 4)}" cy="${STEP / 4}" r="${r}" fill="${ink}"/>` +
		`<circle cx="${round((3 * WIDTH) / 4)}" cy="${(3 * STEP) / 4}" r="${r}" fill="${ink}"/>` +
		`</pattern>`,
).join('');
