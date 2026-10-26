// Modèle de l'anatomie de pointcloud-viewer : les vrais chiffres du dépôt, au commit lu. Le relevé,
// la spirale dessinée, les secteurs du disque et le rythme du bake en découlent. Module pur : il
// tourne au build, sous Node pour l'audit, et dans le module de mouvement.
import type { Locale, Localized } from '../../lib/i18n.ts';

/** Commit lu de Popoch39/pointcloud-viewer : tous les liens vers le code y sont figés. */
export const SHA = 'e30a105e0cf22c12d500d6bbf06fcd26b12697a1';

// --- Le fichier d'essai, `webassembly/examples/generate-sample.rs` L27-L41 -------------------

/** Points de `sample.laz` (L27). */
export const POINTS = 100_000;
/** Un point dessiné en représente 40 : 2 500 points dessinés. */
export const STRIDE = 40;
export const DRAWN = POINTS / STRIDE;
/**
 * Le point du fichier que représente le point dessiné `j`, pris dans son lot de 40. Le décalage
 * `j mod 6` évite le repliement des classes : `40 j mod 6` n'en parcourrait que trois sur six.
 */
export const drawnIndex = (j: number) => j * STRIDE + (j % 6);

/** Le point `i` est à l'angle `i / 100` radians (L29) : c'est l'angle de la tête quand elle le lit. */
export const angleOf = (index: number) => index / 100;
/** …à `0,05 · t` mètres de la station (L31-L32) et à `50 + 0,02 · t` mètres d'altitude (L33). */
export const radiusOf = (index: number) => 0.05 * angleOf(index);
export const altitudeOf = (index: number) => 50 + 0.02 * angleOf(index);

/** Un tour de tête lit `200 π` points ; 159 tours pour tout le fichier. */
export const PER_TURN = 200 * Math.PI;
export const TURNS = POINTS / PER_TURN;
/** Angle du dernier point, où la tête s'arrête au repos. */
export const LAST_ANGLE = angleOf(POINTS - 1);

/** Altitude locale de 0 à 20 m : la rampe du mode altitude (`uZMin`, `uZMax` du shader). */
export const Z_SPAN = 0.02 * angleOf(POINTS - 1);

// --- Le format PCBK, `webassembly/src/lib.rs` L41-L131 ---------------------------------------

export const HEADER_BYTES = 72;
export const VERSION = 2;
/** Blocs planaires, dans l'ordre d'écriture (L115-L130) : l'intensité passe avant le RGB. */
export const BLOCKS = [
	{ id: 'positions', bytes: 12 },
	{ id: 'intensite', bytes: 2 },
	{ id: 'rgb', bytes: 3 },
	{ id: 'classification', bytes: 1 },
] as const;
export const BYTES_PER_POINT = BLOCKS.reduce((sum, block) => sum + block.bytes, 0);
/** 1 800 072 octets : 72 + 100 000 × 18 (L100). */
export const PCBK_BYTES = HEADER_BYTES + POINTS * BYTES_PER_POINT;

/** Les secteurs du disque : chaque bloc prend sa part des octets de blocs, en angle. */
export const SECTORS = (() => {
	let from = 0;
	return BLOCKS.map((block) => {
		const sweep = (block.bytes / BYTES_PER_POINT) * Math.PI * 2;
		const sector = { id: block.id, from, to: from + sweep };
		from += sweep;
		return sector;
	});
})();

// --- Les modes de couleur, `src/lib/pointcloud-shaders.ts` -----------------------------------

/** Les clés du dépôt (`ColorMode`, L10) ; le relevé affiche leurs libellés, dans la langue du document. */
export const MODES = ['rgb', 'intensity', 'classification', 'altitude'] as const;
export type Mode = (typeof MODES)[number];

/** Palette ASPRS des classes 0 à 5, les seules de l'échantillon (`i mod 6`), L35-L41. */
const CLASS_PALETTE: [number, number, number][] = [
	[0.53, 0.53, 0.53],
	[0.4, 0.4, 0.4],
	[0.63, 0.44, 0.26],
	[0.47, 0.77, 0.46],
	[0.25, 0.63, 0.29],
	[0.11, 0.44, 0.16],
];

/** La palette turbo du shader (approximation polynomiale, L73-L85). */
function turbo(t: number): [number, number, number] {
	const x = Math.min(1, Math.max(0, t));
	const [x2, x3] = [x * x, x * x * x];
	const [x4, x5] = [x2 * x2, x2 * x3];
	return [
		0.13572138 + 4.6153926 * x - 42.66032258 * x2 + 132.13108234 * x3 - 152.94239396 * x4 + 59.28637943 * x5,
		0.09140261 + 2.19418839 * x + 4.84296658 * x2 - 14.18503333 * x3 + 4.27729857 * x4 + 2.82956604 * x5,
		0.1066733 + 12.64194608 * x - 60.58204836 * x2 + 110.36276771 * x3 - 89.90310912 * x4 + 27.34824973 * x5,
	];
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Luminance (0 à 1) du point `index` dans un mode, avec les formules du dépôt : couleurs de
 * l'échantillon réduites à 8 bits par `>> 8` (`lib.rs` L121-L129), intensité `i mod 65 536` mise à
 * l'échelle par son maximum (65 535, facteur 1), classe `i mod 6`, turbo de l'altitude locale.
 */
export function lightOf(index: number, mode: Mode) {
	const t = angleOf(index);
	switch (mode) {
		case 'rgb': {
			const channel = (unit: number) => (Math.floor(unit * 65_535) >> 8) / 255;
			return luminance([channel(Math.sin(t) * 0.5 + 0.5), channel(Math.cos(t) * 0.5 + 0.5), channel(index / POINTS)]);
		}
		case 'intensity':
			return (index % 65_536) / 65_535;
		case 'classification':
			return luminance(CLASS_PALETTE[index % 6]);
		case 'altitude':
			return luminance(turbo((0.02 * t) / Z_SPAN));
	}
}

/** Les tons d'encre d'un nuage rendu (opacités) : une couleur sombre se lit en encre dense. */
export const INKS = [0.3, 0.44, 0.58, 0.72, 0.86, 1] as const;

/**
 * Ton d'encre de chaque point dessiné, par mode. La luminance est étirée sur l'étendue du mode
 * (une mise en tons, comme un tirage contrasté), sans changer l'ordre des couleurs.
 */
export const inksOf = (mode: Mode) => {
	const lights = Array.from({ length: DRAWN }, (_, j) => lightOf(drawnIndex(j), mode));
	const [low, high] = [Math.min(...lights), Math.max(...lights)];
	return lights.map((light) => Math.min(INKS.length - 1, Math.floor(((high - light) / (high - low || 1)) * INKS.length)));
};

// --- Le rythme du bake rejoué (aucune durée n'est affichée) ----------------------------------

/** La boucle Rust est rejouée en 14 s : elle démarre lentement, puis accélère comme un moteur. */
export const READ_SECONDS = 14;
/** Vitesse de lecture au départ (rad/s) et constante de l'accélération exponentielle. */
export const READ_START = 3;
export const READ_RISE = 2.4;
/** Avec `ω = ω₀ e^(t/τ)`, la vitesse vaut `ω₀ + θ/τ` : elle ne dépend que de l'angle déjà lu. */
const readTime = (top: number) => {
	const ramp = READ_RISE * (top - READ_START);
	return READ_RISE * Math.log(top / READ_START) + (LAST_ANGLE - ramp) / top;
};
/** Vitesse de croisière telle que les 159 tours prennent exactement `READ_SECONDS`. */
export const READ_TOP = (() => {
	let [low, high] = [READ_START * 2, 1000];
	for (let step = 0; step < 60; step++) {
		const middle = (low + high) / 2;
		if (readTime(middle) > READ_SECONDS) low = middle;
		else high = middle;
	}
	return (low + high) / 2;
})();
export const readSpeed = (angle: number) => Math.min(READ_TOP, READ_START + angle / READ_RISE);

// --- Les chiffres du relevé -----------------------------------------------------------------

/** EPSG lu par `crs.rs`, et l'ancre : le World Offset reprojeté en WGS84 (calcul refait). */
export const EPSG = 2154;
export const ANCHOR = { lat: 48.8468, lng: 2.3384 };

/**
 * Les mots du relevé et le format de ses nombres : les chiffres, eux, ne changent pas d'une langue
 * à l'autre. Le format reprend `formats` du module i18n sans l'importer : importé ici, il passerait
 * dans le morceau du chargeur, que télécharge toute page qui a une figure.
 */
const WORDS: Localized<{ intl: string; mb: string; turn: string; ratchet: string; bytes: string; anchor: string; modes: string[] }> = {
	fr: { intl: 'fr-FR', mb: 'Mo', turn: 'tour', ratchet: 'cliquet', bytes: 'o', anchor: 'ancre', modes: ['RGB', 'intensité', 'classification', 'altitude'] },
	en: { intl: 'en-GB', mb: 'MB', turn: 'turn', ratchet: 'ratchet', bytes: 'B', anchor: 'anchor', modes: ['RGB', 'intensity', 'classification', 'altitude'] },
};

/**
 * Le relevé dans une langue, nombres à son format. Pas le `formatNumber` du site
 * (`src/lib/activity.ts`) : ses formats de date, construits à l'import, suivraient dans le module
 * de mouvement et le feraient passer au-dessus de 20 Ko.
 */
export const releveOf = (locale: Locale) => {
	const words = WORDS[locale];
	const { intl } = words;
	const count = (value: number) => value.toLocaleString(intl);
	const decimal = (value: number, digits: number) => value.toLocaleString(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits });
	const all = `${count(POINTS)} pts`;
	return {
		// « 1,80 Mo » : unités de `bake-panel.tsx` L18-L23.
		rest: `${all} · ${decimal(PCBK_BYTES / 1_000_000, 2)} ${words.mb} · EPSG:${EPSG}`,
		reading: (read: number) => `${count(read)} / ${all} · ${words.turn} ${Math.floor(read / PER_TURN)}`,
		slipping: (read: number) => `${count(read)} / ${all} · ${words.ratchet}`,
		writing: `${all} · PCBK v${VERSION} · ${count(PCBK_BYTES)} ${words.bytes}`,
		anchored: `${all} · ${words.anchor} ${decimal(ANCHOR.lat, 3)}° N ${decimal(ANCHOR.lng, 3)}° E`,
		/** Le relevé du nuage rendu, avec le mode de couleur `mode` (rang dans `MODES`). */
		rendered: (mode: number) => `${all} · ${words.modes[mode]}`,
	};
};
