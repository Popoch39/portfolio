// Textes des trois manches du banc. Le SVG au repos les porte (`data-texts` sur le bandeau de A) :
// le mouvement les y relit au lieu de les embarquer.

/**
 * Tirés une fois par `generateText(seed, 'en', 2, 36)` (text.ts, liste anglaise v2 pondérée) avec
 * les graines ci-dessous, toutes différentes comme `#nextSeed`. 36 mots tiennent 30 s jusqu'à 7
 * caractères par seconde ; au-delà, le curseur reste sur le dernier.
 */
export const SEEDS = [0x5eed0001, 0x5eed0002, 0x5eed0003];
export const TEXTS = [
	'analysis factor credit even response only through determined decided justice on already woman took one are whether committee however risk toward way government employees move practice under press woman power only first started water there first',
	'asked reported want brought got technology area learning find systems literature longer time example trying care knew war operation others sir education management little provide importance potential land home experience here district give strategy myself within',
	'heat how minutes company court management education then green between which based her meet your systems were men problems who are friends left new energy shall as which mean some having yet while note should section',
].map((text) => text.split(' '));
