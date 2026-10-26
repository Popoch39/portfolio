// Textes et nomenclature de la rampe à cadran, validés à la revue (#21) : voir `concept.md`.
import type { AnatomyContent, Piece } from '../contract.ts';
import { releve, SHA, timeline } from './model.ts';

const code = (lines: [number, number]) => ({ path: 'statusline.ts', lines });

export const pieces: Piece[] = [
	{
		id: 'aiguillage',
		name: 'Tête d’aiguillage',
		role: 'Boisseau rotatif à levier et trois crans, stdin, API et cache : il choisit d’où viennent les limites à chaque rendu.',
		code: code([211, 227]),
	},
	{
		id: 'sonde-api',
		name: 'Sonde API',
		role: 'Plongeur à ressort et bague de temporisation de 2,5 s : il demande un jeton et revient avec les en-têtes anthropic-ratelimit-unified-*.',
		code: code([157, 209]),
	},
	{
		id: 'capsule-cache',
		name: 'Capsule de cache',
		role: 'Capsule tournée, vissée sous la tête : frappée à chaque écriture, elle montre son contenu par une fenêtre témoin et n’est relue qu’en dernier recours.',
		code: code([115, 145]),
	},
	{
		id: 'rampe',
		name: 'Rampe',
		role: 'Profilé qui porte les segments dans l’ordre, modèle, dossier, puis les deux fenêtres, séparés par trois goujons « · » : il sort une seule ligne.',
		code: code([231, 254]),
	},
	{
		id: 'peignes',
		name: 'Peignes à dix lames',
		role: 'Un module par fenêtre, 5h puis sem : un peigne de dix lames, une par case de la barre. Sans pourcentage, les dix lames restent baissées.',
		code: code([103, 109]),
	},
	{
		id: 'cadran',
		name: 'Cadran à deux aiguilles',
		role: 'Échelle de 0 à 100 % en trois zones, sous 50, de 50 à 80 et au-delà : il borne, arrondit et juge chaque pourcentage, aiguille longue pour 5h, courte pour la semaine.',
		code: code([52, 69]),
		master: true,
	},
	{
		id: 'tambours',
		name: 'Tambours de reset',
		role: 'Compteurs dans la face de chaque module : le délai avant reset en jours, en heures-minutes ou en minutes, « — » sans pourcentage.',
		code: code([73, 85]),
	},
	{
		id: 'volant',
		name: 'Volant du temps et croix de Malte',
		role: 'Un tour de volant fait soixante crans de croix de Malte : un rendu de la status line par cran, toutes les 60 secondes de refreshInterval.',
		code: code([280, 285]),
	},
];

export const content: AnatomyContent = {
	slug: 'claude-status-line',
	sha: SHA,
	machine: 'Rampe à cadran',
	lede: {
		before: 'L’usage de votre abonnement Claude Code, ',
		emphasis: 'mesuré',
		after: ' sur une seule ligne, sous la zone de saisie.',
	},
	title: 'Rampe à cadran — fenêtre de 5 h et semaine',
	consignes: {
		pointer: 'Glissez vers la droite pour faire avancer le temps',
		touch: 'Glissez le doigt vers la droite pour faire avancer le temps',
	},
	releve,
	caption:
		'Tant que Claude Code n’a pas encore fourni ses limites sur stdin, l’aiguillage interroge l’API (un jeton, 2,5 s au plus) ou relit le cache. Chaque pourcentage est ensuite borné à 0–100 et arrondi en dix cases : une lame se lève dès 5, 15, …, 95 %. Le cadran le juge sous 50, de 50 à 80 ou au-delà, et les tambours écrivent le délai de reset en jours, en heures-minutes ou en minutes. Les pourcentages sont un exemple, le traitement est celui du code.',
	label:
		'Rampe à cadran. Une longue règle d’instrument, bridée au bord d’une tablette, montre l’usage d’abonnement Claude Code. À gauche, un aiguillage choisit la source des limites : stdin, API ou cache. Le long de la rampe, deux peignes de dix lames marquent la fenêtre de 5 heures et la fenêtre hebdomadaire, chacune avec un compte à rebours jusqu’au reset. À droite, un cadran à deux aiguilles indique les pourcentages en trois zones, et un volant fait avancer le temps. Au clavier, les flèches avancent ou reculent d’une minute, Page suivante et Page précédente d’une heure.',
	pieces,
	seo: {
		title: 'claude-status-line — l’usage Claude Code en status line',
		description: 'Binaire Bun qui affiche l’usage d’abonnement Claude Code, fenêtre de 5 h et semaine, dans la status line. Anatomie : sources, seuils, reset.',
	},
	// Recadrage à 390 px voulu par la revue (#21) : la coupe ne prend que les bouts de la tablette,
	// ni le levier de l'aiguillage ni le volant.
	phoneCrop: true,
	timeline,
};
