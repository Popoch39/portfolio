// Modèle de claude-tmux-notify.nvim, au commit lu : les constantes du plugin, la ligne JSON que
// le crochet ajoute au fichier de cache, et le sondage qui la lit. Le relevé et le mouvement en
// découlent ; aucune API de navigateur, pour tourner aussi sous Node (audit).
import type { Piece } from '../contract.ts';

/** Commit lu de Popoch39/claude-tmux-notify.nvim (branche `master`). */
export const SHA = '12ae624f6c095e66e4f494b253e16612499fe32f';

/** `poll_interval` (init.lua L26) : le `fs_poll` regarde le fichier toutes les 1000 ms. */
export const POLL_MS = 1000;
/** `max_cache_size` (init.lua L27) : au-delà, le fichier est tronqué au démarrage. */
export const MAX_CACHE = 1024 * 1024;

export type HookEvent = 'Notification' | 'Stop';
export type Level = 'warn' | 'info';

/** `events` (init.lua L30-L33) : le niveau du toast selon le crochet. */
export const LEVELS: Record<HookEvent, Level> = { Notification: 'warn', Stop: 'info' };

/** Les cinq fenêtres tmux du tableau ; Neovim tourne dans la première, où le tableau est accroché. */
export const WINDOWS = ['1:nvim', '2:api-server', '3:front', '4:docs', '5:infra'] as const;
export const NVIM = 0;
const SESSION = 'main';

/**
 * Message de la ligne : celui de Claude pour une `Notification` (README L11-L14 pour
 * `2:api-server`), sinon les textes par défaut du crochet (tmux-notify.sh L24-L31).
 */
const messageOf = (event: HookEvent, window: number) =>
	event === 'Stop'
		? 'Claude finished its turn'
		: window === 1
			? 'Claude needs your permission to run a command'
			: 'Claude is waiting for your input';

/**
 * La ligne exacte que `jq -nc` écrit (tmux-notify.sh L45-L51), suivie du saut de ligne de L57.
 * `window_id` et `session` sont des exemples : tmux les donne au crochet.
 */
export function lineOf(event: HookEvent, window: number) {
	const json = JSON.stringify({
		event,
		window_id: `@${window + 1}`,
		label: WINDOWS[window],
		session: SESSION,
		message: messageOf(event, window),
	});
	return `${json}\n`;
}

/** Octets de la ligne : une rangée de bande par octet. Les messages sont en ASCII. */
export const bytesOf = (event: HookEvent, window: number) => lineOf(event, window).length;

/** Le titre du toast (init.lua L91-L98), le niveau remplaçant l'icône dans le relevé. */
export const toastOf = (event: HookEvent, window: number) => `${LEVELS[event]} · Claude — ${WINDOWS[window]}`;

/** Prochain sondage après `clock` (en ms), quand le premier a lieu à `phase`. */
export const nextPoll = (clock: number, phase = 0) => phase + Math.ceil((clock - phase + 1e-6) / POLL_MS) * POLL_MS;

/** Au démarrage (init.lua L149-L162) : tronqué au-delà de 1 Mio, puis la lecture part de la fin. */
export function startOffset(size: number) {
	const kept = size > MAX_CACHE ? 0 : size;
	return { size: kept, offset: kept, truncated: kept !== size };
}

/** Taille du fichier à la mise en route, sous le seuil : le massicot reste ouvert. */
export const START_SIZE = 18_406;

export const releves = {
	rest: (active: number) => `${WINDOWS[active]} au premier plan · sondage ${POLL_MS} ms`,
	focused: (active: number) => `${WINDOWS[active]} au premier plan`,
	unread: (bytes: number, ms: number) => `+${bytes} o non lus · lecture dans ${Math.max(0, Math.round(ms))} ms`,
	suppressed: (window: number) => `supprimé · ${WINDOWS[window]} au premier plan`,
	hover: (window: number, fallen: boolean) => `${WINDOWS[window]} · volet ${fallen ? 'tombé' : 'levé'}`,
};

export const releve = releves.rest(NVIM);

const code = (path: string, lines: [number, number]) => ({ path, lines }) as const;
const LUA = 'lua/claude-tmux-notify/init.lua';

export const pieces: Piece[] = [
	{
		id: 'perforateur',
		name: 'Perforateur',
		role: 'Le crochet Claude Code : lit l’événement, demande à tmux sa fenêtre et perfore une ligne JSON de cinq champs au bout de la bande. Sort toujours en 0.',
		code: code('scripts/tmux-notify.sh', [9, 59]),
	},
	{
		id: 'bobine',
		name: 'Bobine et massicot',
		role: 'Le fichier de cache : à la mise en route, il est tronqué au-delà de 1 Mio, puis la lecture part de sa fin.',
		code: code(LUA, [149, 162]),
	},
	{
		id: 'echappement',
		name: 'Échappement à la seconde',
		role: 'Le fs_poll de libuv, qui regarde le fichier toutes les 1000 ms.',
		code: code(LUA, [164, 170]),
	},
	{
		id: 'lecture',
		name: 'Tête de lecture et boucle tampon',
		role: 'Lit les octets au-delà du décalage, avance le décalage et décode chaque ligne JSON.',
		code: code(LUA, [104, 142]),
	},
	{
		id: 'cordon',
		name: 'Fiche à cordon',
		role: 'Demande à tmux si la fenêtre de l’événement est active ; branchée dans le jack de cette fenêtre, la fiche retient son volet.',
		code: code(LUA, [64, 74]),
	},
	{
		id: 'volet',
		name: 'Volet',
		role: 'Le toast : titre Claude — <fenêtre>, message de Claude, niveau selon l’événement.',
		code: code(LUA, [86, 102]),
		master: true,
	},
	{
		id: 'sonnette',
		name: 'Sonnette trembleuse',
		role: 'Le notifieur : Snacks s’il est chargé, sinon vim.notify au niveau warn ou info.',
		code: code(LUA, [76, 84]),
	},
];

export const pieceOf = (id: string) => {
	const piece = pieces.find((candidate) => candidate.id === id);
	if (!piece) throw new Error(`claude-tmux-notify : pièce inconnue « ${id} »`);
	return piece;
};
