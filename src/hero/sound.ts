/**
 * The Établi's sound (ADR 0013): presses and releases of a lubed linear board, cut from one CC0 take
 * into a single sprite of fixed slots. Nothing is fetched before the Son asks for it, and the audio
 * context runs only while a sound plays or a pointer moves on the board: a page at rest keeps no audio
 * thread awake.
 */
import sprite from '../assets/sound/keys.wav?url&no-inline';

/** The sprite's layout: four presses, then four releases, each in a slot of 0.1 s from its attack. */
const SLOT = 0.1;
const VARIANTS = 4;
const LENGTH = { press: 0.087, release: 0.072 } as const;
/** The sprite's own rate: decoded at it, it is not resampled twice. */
const RATE = 32000;
/** How long a pointer resting on the board keeps the context up for its next stroke, in ms. */
const IDLE = 2000;

export type Stroke = keyof typeof LENGTH;

let loading: Promise<AudioBuffer | undefined> | undefined;
let samples: AudioBuffer | undefined;
let context: AudioContext | undefined;
let output: AudioNode | undefined;
let playing = 0;
let held = false;
let idle: ReturnType<typeof setTimeout> | undefined;
const last: Record<Stroke, number> = { press: -1, release: -1 };

/**
 * Fetches and decodes the sprite, once. Decoded off any live context, it is ready before the visitor's
 * first gesture, which then only has to make the context. Offline or refused, the board stays silent,
 * and the next call tries again.
 */
export function load(): Promise<AudioBuffer | undefined> {
	loading ??= fetch(sprite)
		.then((response) => {
			if (!response.ok) throw new Error(`Établi: the sound answered ${response.status}`);
			return response.arrayBuffer();
		})
		.then((data) => new OfflineAudioContext(1, 1, RATE).decodeAudioData(data))
		.then((buffer) => (samples = buffer))
		.catch(() => (loading = undefined));
	return loading;
}

/**
 * The context, made once the visitor has acted on the page: before that, the browser would only make it
 * suspended, and a sound started on it would be heard late, when some later gesture lets it run.
 */
function ready() {
	if (!context) {
		if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return undefined;
		context = new AudioContext({ latencyHint: 'interactive' });
		// Sixty-one clips of the replay overlap: the compressor keeps their sum from clipping.
		output = new DynamicsCompressorNode(context, { threshold: -6, knee: 6, ratio: 12 });
		output.connect(context.destination);
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
	/** Loudness, 1 for a full press. */
	gain: number;
	/** Below 1 for a wider, deeper key. */
	rate?: number;
	/** Seconds from now. */
	at?: number;
}

/** Plays one of the stroke's variants, never the one heard just before; nothing if the sound is not ready. */
export function play(stroke: Stroke, { gain, rate = 1, at = 0 }: Options) {
	const audio = ready();
	if (!audio || !samples || !output) return undefined;
	const before = last[stroke];
	let variant = Math.floor(Math.random() * (before < 0 ? VARIANTS : VARIANTS - 1));
	if (before >= 0 && variant >= before) variant++;
	last[stroke] = variant;
	const slot = (stroke === 'press' ? 0 : VARIANTS) + variant;
	const level = new GainNode(audio, { gain });
	// A slight spread in pitch: no two strokes alike, as no two fingers land alike.
	const source = new AudioBufferSourceNode(audio, { buffer: samples, playbackRate: rate * (0.96 + Math.random() * 0.08) });
	source.connect(level).connect(output);
	playing++;
	source.addEventListener('ended', () => {
		playing--;
		level.disconnect();
		rest();
	});
	source.start(audio.currentTime + at, slot * SLOT, LENGTH[stroke]);
	return source;
}
