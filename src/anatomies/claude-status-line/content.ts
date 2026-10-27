// Textes et nomenclature de la rampe à cadran, validés à la revue (#21) : voir `concept.md`.
// L'anglais (#37) est une transcréation en anglais britannique ; `5h`, `sem` et les délais restent
// ceux du binaire, qui les écrit ainsi.
import type { AnatomyContent, Piece } from '../contract.ts';
import { releve, SHA, timeline } from './model.ts';

const code = (lines: [number, number]) => ({ path: 'statusline.ts', lines });

export const pieces: Piece[] = [
	{
		id: 'aiguillage',
		name: { fr: 'Tête d’aiguillage', en: 'Selector head' },
		role: {
			fr: 'Boisseau rotatif à levier et trois crans, stdin, API et cache : il choisit d’où viennent les limites à chaque rendu.',
			en: 'Rotary plug with a lever and three detents, stdin, API and cache: it picks where the limits come from on every render.',
		},
		code: code([211, 227]),
		note: {
			title: { fr: 'Choisir la source', en: 'Pick the source' },
			text: {
				fr: 'Prend les limites de Claude Code, sinon de l’API, sinon du cache.',
				en: 'Takes the limits from Claude Code, failing that the API, failing that the cache.',
			},
			tech: ['claude'],
			clue:'stdin',
			symbol: 'resolveRateLimits()',
		},
	},
	{
		id: 'sonde-api',
		name: { fr: 'Sonde API', en: 'API probe' },
		role: {
			fr: 'Plongeur à ressort et bague de temporisation de 2,5 s : il demande un jeton et revient avec les en-têtes anthropic-ratelimit-unified-*.',
			en: 'Spring plunger with a 2.5 s timer ring: it asks for a single token and comes back with the anthropic-ratelimit-unified-* headers.',
		},
		code: code([157, 209]),
		note: {
			title: { fr: 'Demander à l’API', en: 'Ask the API' },
			text: {
				fr: 'Interroge l’API Anthropic avec votre jeton, en 2,5 s au plus.',
				en: 'Queries the Anthropic API with your token, giving up after 2.5 s.',
			},
			tech: ['anthropic'],
			clue:'fetch',
			symbol: 'readOAuthToken()',
		},
	},
	{
		id: 'capsule-cache',
		name: { fr: 'Capsule de cache', en: 'Cache capsule' },
		role: {
			fr: 'Capsule tournée, vissée sous la tête : frappée à chaque écriture, elle montre son contenu par une fenêtre témoin et n’est relue qu’en dernier recours.',
			en: 'Turned capsule screwed under the head: struck on every write, it shows its contents through a witness window and is only read back as a last resort.',
		},
		code: code([115, 145]),
		note: {
			title: { fr: 'Garder une copie', en: 'Keep a copy' },
			text: {
				fr: 'Range les dernières limites dans un fichier JSON de secours.',
				en: 'Saves the latest limits to a fallback JSON file.',
			},
			tech: ['json'],
			clue:'~/.claude',
			symbol: 'readCache()',
		},
	},
	{
		id: 'rampe',
		name: { fr: 'Rampe', en: 'Rail' },
		role: {
			fr: 'Profilé qui porte les segments dans l’ordre, modèle, dossier, puis les deux fenêtres, séparés par trois goujons « · » : il sort une seule ligne.',
			en: 'Section that carries the segments in order, model, folder, then the two windows, parted by three ‘·’ studs: it puts out a single line.',
		},
		code: code([231, 254]),
		note: {
			title: { fr: 'Assembler la ligne', en: 'Build the line' },
			text: {
				fr: 'Modèle · dossier · 5h · sem, sur une seule ligne de terminal.',
				en: 'Model · folder · 5h · sem, on a single terminal line.',
			},
			tech: ['bun', 'typescript'],
			clue:'render()',
			symbol: 'render()',
		},
	},
	{
		id: 'peignes',
		name: { fr: 'Peignes à dix lames', en: 'Ten-blade combs' },
		role: {
			fr: 'Un module par fenêtre, 5h puis sem : un peigne de dix lames, une par case de la barre. Sans pourcentage, les dix lames restent baissées.',
			en: 'One module per window, 5h then sem: a comb of ten blades, one per cell of the bar. With no percentage, all ten blades stay down.',
		},
		code: code([103, 109]),
		note: {
			title: { fr: 'Dessiner les barres', en: 'Draw the bars' },
			text: {
				fr: 'Dix cases par fenêtre : 68 % donne sept cases pleines.',
				en: 'Ten cells per window: at 68%, seven of them are filled.',
			},
			tech: ['typescript'],
			clue:'bar()',
			symbol: 'windowSegment()',
		},
	},
	{
		id: 'cadran',
		name: { fr: 'Cadran à deux aiguilles', en: 'Two-needle dial' },
		role: {
			fr: 'Échelle de 0 à 100 % en trois zones, sous 50, de 50 à 80 et au-delà : il borne, arrondit et juge chaque pourcentage, aiguille longue pour 5h, courte pour la semaine.',
			en: 'Scale from 0 to 100% in three zones, under 50, 50 to 80 and above: it clamps, rounds and judges each percentage, long needle for 5h, short for the week.',
		},
		code: code([52, 69]),
		note: {
			title: { fr: 'Colorer selon l’usage', en: 'Colour by usage' },
			text: {
				fr: 'Vert sous 50 %, jaune jusqu’à 80 %, rouge au-delà.',
				en: 'Green below 50%, yellow up to 80%, red above that.',
			},
			tech: ['typescript'],
			clue:'colorFor()',
			symbol: 'colorFor()',
		},
		master: true,
	},
	{
		id: 'tambours',
		name: { fr: 'Tambours de reset', en: 'Reset drums' },
		role: {
			fr: 'Compteurs dans la face de chaque module : le délai avant reset en jours, en heures-minutes ou en minutes, « — » sans pourcentage.',
			en: 'Counters set in the face of each module: the time left before the reset in days, hours and minutes, or minutes, ‘—’ with no percentage.',
		},
		code: code([73, 85]),
		note: {
			title: { fr: 'Compter jusqu’au reset', en: 'Count down to the reset' },
			text: {
				fr: 'Le temps avant la remise à zéro : 3j, 2h14 ou 14m.',
				en: 'Time left before the limits reset: 3j, 2h14 or 14m.',
			},
			tech: ['typescript'],
			clue:'fmtReset()',
			symbol: 'fmtReset()',
		},
	},
	{
		id: 'volant',
		name: { fr: 'Volant du temps et croix de Malte', en: 'Time handwheel and Geneva drive' },
		role: {
			fr: 'Un tour de volant fait soixante crans de croix de Malte : un rendu de la status line par cran, toutes les 60 secondes de refreshInterval.',
			en: 'One turn of the handwheel is sixty steps of the Geneva drive: one status line render per step, every 60 seconds of refreshInterval.',
		},
		code: code([280, 285]),
		note: {
			title: { fr: 'Recommencer chaque minute', en: 'Run again every minute' },
			text: {
				fr: 'Claude Code relance le binaire toutes les 60 secondes.',
				en: 'Claude Code reruns the binary every 60 seconds.',
			},
			tech: ['claude'],
			clue:'refreshInterval',
			symbol: 'settings.statusLine',
		},
	},
];

export const content: AnatomyContent = {
	slug: 'claude-status-line',
	sha: SHA,
	machine: { fr: 'Rampe à cadran', en: 'Dial rail' },
	lede: {
		before: { fr: 'L’usage de votre abonnement Claude Code, ', en: 'Your Claude Code subscription usage, ' },
		emphasis: { fr: 'mesuré', en: 'measured' },
		after: { fr: ' sur une seule ligne, sous la zone de saisie.', en: ' on a single line, just below the prompt.' },
	},
	title: { fr: 'Rampe à cadran — fenêtre de 5 h et semaine', en: 'Dial rail — 5-hour and weekly windows' },
	consignes: {
		pointer: { fr: 'Glissez vers la droite pour faire avancer le temps', en: 'Drag to the right to move time forward' },
		touch: { fr: 'Glissez le doigt vers la droite pour faire avancer le temps', en: 'Swipe right to move time forward' },
	},
	releve,
	caption: {
		fr: 'Tant que Claude Code n’a pas encore fourni ses limites sur stdin, l’aiguillage interroge l’API (un jeton, 2,5 s au plus) ou relit le cache. Chaque pourcentage est ensuite borné à 0–100 et arrondi en dix cases : une lame se lève dès 5, 15, …, 95 %. Le cadran le juge sous 50, de 50 à 80 ou au-delà, et les tambours écrivent le délai de reset en jours, en heures-minutes ou en minutes. Les pourcentages sont un exemple, le traitement est celui du code.',
		en: 'Until Claude Code has passed its limits on stdin, the selector queries the API (one token, 2.5 s at most) or reads the cache back. Each percentage is then clamped to 0–100 and rounded to ten cells: a blade rises from 5, 15, …, 95%. The dial judges it under 50, from 50 to 80 or above, and the drums write the time left before the reset in days, hours and minutes, or minutes. The percentages are an example; the processing is the code’s own.',
	},
	label: {
		fr: 'Rampe à cadran. Une longue règle d’instrument, bridée au bord d’une tablette, montre l’usage d’abonnement Claude Code. À gauche, un aiguillage choisit la source des limites : stdin, API ou cache. Le long de la rampe, deux peignes de dix lames marquent la fenêtre de 5 heures et la fenêtre hebdomadaire, chacune avec un compte à rebours jusqu’au reset. À droite, un cadran à deux aiguilles indique les pourcentages en trois zones, et un volant fait avancer le temps. Au clavier, les flèches avancent ou reculent d’une minute, Page suivante et Page précédente d’une heure.',
		en: 'Dial rail. A long instrument rail, clamped to the edge of a shelf, shows Claude Code subscription usage. On the left, a selector picks the source of the limits: stdin, API or cache. Along the rail, two ten-blade combs mark the 5-hour window and the weekly window, each with a countdown to its reset. On the right, a two-needle dial shows the percentages in three zones, and a handwheel moves time forward. With the keyboard, the arrow keys step one minute forward or back, Page Down and Page Up one hour.',
	},
	pieces,
	seo: {
		title: { fr: 'claude-status-line — l’usage Claude Code en status line', en: 'claude-status-line — Claude Code usage in the status line' },
		description: {
			fr: 'Binaire Bun qui affiche l’usage d’abonnement Claude Code, fenêtre de 5 h et semaine, dans la status line. Anatomie : sources, seuils, reset.',
			en: 'A Bun binary that shows Claude Code subscription usage, 5-hour window and week, in the status line. Anatomy: sources, thresholds, reset.',
		},
	},
	// Recadrage à 390 px voulu par la revue (#21) : la coupe ne prend que les bouts de la tablette,
	// ni le levier de l'aiguillage ni le volant.
	phoneCrop: true,
	timeline,
};
