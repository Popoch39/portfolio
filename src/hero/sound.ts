/**
 * The Établi's sound (ADR 0013): the Tactile keystrokes of Typomaniac, twelve whole strokes (press and
 * release) of a mechanical keyboard, each played as recorded. Nothing is fetched before the Son asks for
 * it, and the audio context runs only while a sound plays or a pointer moves on the board: a page at
 * rest keeps no audio thread awake.
 */
const urls = import.meta.glob<string>('../assets/sound/tactile/key-*.mp3', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});

/**
 * Where a stroke's attack starts, in s, for the files that do not open on it (measured with ffmpeg: the
 * first sample above a fifth of the peak, less 2 ms). Played from there, the stroke lands with the press.
 */
const ATTACK: Record<string, number> = { 'key-02': 0.11, 'key-05': 0.015, 'key-08': 0.031 };
const files = Object.entries(urls).map(([path, url]) => {
	const name = /key-\d+/.exec(path)?.[0] ?? '';
	return { name, url, attack: ATTACK[name] ?? 0 };
});

/** How far a key is detuned at random either way, in cents, so that no two strokes sound alike. */
const DETUNE = 50;
/** A wide key, as Typomaniac plays its space bar: one of the strokes, a minor third lower. */
const WIDE = { file: Math.max(0, files.findIndex(({ name }) => name === 'key-05')), detune: -300 };
/** The files' own rate: decoded at it, they are not resampled twice. */
const RATE = 44100;
/** How long a pointer resting on the board keeps the context up for its next stroke, in ms. */
const IDLE = 2000;

let loading: Promise<AudioBuffer[] | undefined> | undefined;
let strokes: AudioBuffer[] | undefined;
let context: AudioContext | undefined;
let playing = 0;
let held = false;
let idle: ReturnType<typeof setTimeout> | undefined;
let last = -1;

/**
 * Fetches and decodes the strokes, once. Decoded off any live context, they are ready before the
 * visitor's first gesture, which then only has to make the context. Offline or refused, the board stays
 * silent, and the next call tries again.
 */
export function load(): Promise<AudioBuffer[] | undefined> {
	loading ??= decodeAll()
		.then((buffers) => (strokes = buffers))
		.catch(() => (loading = undefined));
	return loading;
}

function decodeAll() {
	const decoder = new OfflineAudioContext(1, 1, RATE);
	return Promise.all(
		files.map(({ url }) =>
			fetch(url)
				.then((response) => {
					if (!response.ok) throw new Error(`Établi: ${url} answered ${response.status}`);
					return response.arrayBuffer();
				})
				.then((data) => decoder.decodeAudioData(data)),
		),
	);
}

/**
 * The context, made once the visitor has acted on the page: before that, the browser would only make it
 * suspended, and a sound started on it would be heard late, when some later gesture lets it run.
 */
function ready() {
	if (!context) {
		if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return undefined;
		context = new AudioContext({ latencyHint: 'interactive' });
	}
	clearTimeout(idle);
	if (context.state === 'suspended') void context.resume();
	return context;
}

/**
 * Lets the context sleep once nothing plays. A pointer on the board holds it up a little while for the
 * next stroke, which a waking context would sound late.
 */
function rest() {
	clearTimeout(idle);
	if (!context || playing > 0) return;
	const sleep = () => context?.state === 'running' && void context.suspend();
	if (held) idle = setTimeout(sleep, IDLE);
	else sleep();
}

/** A pointer moving on the board, or gone from it. */
export function hold(over: boolean) {
	held = over;
	if (over) ready();
	rest();
}

interface Options {
	/** Loudness, 1 as recorded. */
	gain: number;
	/** A wide key: its stroke deeper. */
	wide?: boolean;
	/** Seconds from now. */
	at?: number;
}

/** Plays a stroke, never the one heard just before; nothing if the sound is not ready. */
export function play({ gain, wide = false, at = 0 }: Options) {
	const audio = ready();
	if (!audio || !strokes) return undefined;
	let file = WIDE.file;
	let detune = WIDE.detune;
	if (!wide) {
		file = Math.floor(Math.random() * (last < 0 ? strokes.length : strokes.length - 1));
		if (last >= 0 && file >= last) file++;
		last = file;
		detune = (Math.random() * 2 - 1) * DETUNE;
	}
	const level = new GainNode(audio, { gain });
	const source = new AudioBufferSourceNode(audio, { buffer: strokes[file], detune });
	source.connect(level).connect(audio.destination);
	playing++;
	source.addEventListener('ended', () => {
		playing--;
		level.disconnect();
		rest();
	});
	source.start(audio.currentTime + at, files[file].attack);
	return source;
}
