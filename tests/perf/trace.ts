/**
 * Reads a Chromium trace of the page into per-phase fluidity metrics. Only the renderer's main thread
 * is measured: the headless browser rasterises in software, so the GPU side is left to the real-device
 * check (#45).
 */

/** The phases of a run, in page order. Later tickets compare against these names: keep them stable. */
export const PHASES = ['Intro', 'Frise', 'Atome', 'Montage', 'Reste'] as const;
export type Phase = (typeof PHASES)[number];

/** The sections whose scene gets a phase of its own, by selector; the rest of the page is `Reste`. */
export const SCENE_SECTIONS: Record<Exclude<Phase, 'Intro' | 'Reste'>, string> = {
	Frise: '#parcours',
	Atome: 'section:has([data-atome])',
	Montage: '#cafe',
};

/** Performance marks the bench sets in the page, read back from the trace. */
export const MARK = {
	introEnd: 'perf:intro-end',
	scroll: 'perf:scroll',
	end: 'perf:end',
	enter: (phase: Phase) => `perf:enter:${phase}`,
	leave: (phase: Phase) => `perf:leave:${phase}`,
};

/** Budgets of #68: 120 Hz where the browser allows it. */
export const BUDGET = {
	/** ms of main thread per frame, 95th percentile (one 120 Hz frame). */
	frameP95: 8.3,
	/** ms of main thread per frame, worst frame (one 60 Hz frame). */
	frameMax: 16.7,
	/** ms: any task longer than this is a long task, and none is allowed. */
	longTask: 50,
	cls: 0,
};

export interface TraceEvent {
	name: string;
	cat: string;
	ph: string;
	ts: number;
	dur?: number;
	pid: number;
	tid: number;
	args?: Record<string, any>;
}

export interface LongTask {
	phase: Phase;
	/** s since the trace started. */
	at: number;
	/** s since the Intro ended, negative before. */
	sinceIntroEnd: number | null;
	/** ms */
	duration: number;
}

export interface PhaseMetrics {
	/** Frames the main thread worked on (`BeginMainFrame`). */
	frames: number;
	/** ms of main thread per frame. */
	frameP95: number;
	frameMax: number;
	/** Frames the compositor presented without the main thread's update, or not at all. */
	lostFrames: number;
	/** Frames presented with every update, for scale. */
	fullFrames: number;
	longTasks: number;
	/** ms, 0 without a long task. */
	longestTask: number;
	cls: number;
}

export interface TraceMetrics {
	phases: Record<Phase, PhaseMetrics>;
	longTasks: LongTask[];
}

/** Every event of a trace as Chromium writes it: an array, or an object with `traceEvents`. */
export function traceEvents(json: unknown): TraceEvent[] {
	if (Array.isArray(json)) return json;
	const events = (json as { traceEvents?: TraceEvent[] }).traceEvents;
	if (!events) throw new Error('not a Chromium trace');
	return events;
}

export function analyseTrace(events: TraceEvent[]): TraceMetrics {
	const { pid, mainThread, compositor } = pageThreads(events);
	const onMain = (event: TraceEvent) => event.pid === pid && event.tid === mainThread;
	const marks = new Map<string, number[]>();
	for (const event of events) {
		if (event.pid !== pid || !event.cat.includes('blink.user_timing') || !event.name.startsWith('perf:')) continue;
		marks.set(event.name, [...(marks.get(event.name) ?? []), event.ts]);
	}
	const first = (name: string) => marks.get(name)?.[0];
	const scrollStart = first(MARK.scroll);
	const end = first(MARK.end);
	const introEnd = first(MARK.introEnd);
	if (scrollStart === undefined || end === undefined) throw new Error(`marks ${MARK.scroll} and ${MARK.end} missing from the trace`);
	// Hundreds of thousands of events: too many to spread into `Math.min`.
	let start = Number.POSITIVE_INFINITY;
	for (const event of events) if (event.pid === pid && event.ts > 0 && event.ts < start) start = event.ts;
	const phaseAt = phaseTimeline(marks, scrollStart, end);

	const frameTimes = emptyRecord<number[]>(() => []);
	const longTasks: LongTask[] = [];
	const phases = emptyRecord<PhaseMetrics>(() => ({
		frames: 0,
		frameP95: 0,
		frameMax: 0,
		lostFrames: 0,
		fullFrames: 0,
		longTasks: 0,
		longestTask: 0,
		cls: 0,
	}));

	for (const event of events) {
		const phase = phaseAt(event.ts);
		if (!phase) continue;
		const metrics = phases[phase];
		if (event.name === 'ProxyMain::BeginMainFrame' && event.ph === 'X' && onMain(event)) {
			frameTimes[phase].push((event.dur ?? 0) / 1000);
		} else if (event.name === 'RunTask' && event.ph === 'X' && onMain(event) && (event.dur ?? 0) / 1000 > BUDGET.longTask) {
			const duration = (event.dur ?? 0) / 1000;
			metrics.longTasks += 1;
			metrics.longestTask = Math.max(metrics.longestTask, duration);
			longTasks.push({
				phase,
				at: round((event.ts - start) / 1e6, 2),
				sinceIntroEnd: introEnd === undefined ? null : round((event.ts - introEnd) / 1e6, 2),
				duration: round(duration, 1),
			});
		} else if (event.name === 'PipelineReporter' && event.ph === 'b' && event.pid === pid && event.tid === compositor) {
			// A forked reporter doubles a frame already counted.
			const frame = event.args?.frame_reporter;
			if (!frame || frame.frame_type === 'FORKED') continue;
			if (frame.state === 'STATE_DROPPED' || frame.state === 'STATE_PRESENTED_PARTIAL') metrics.lostFrames += 1;
			else if (frame.state === 'STATE_PRESENTED_ALL') metrics.fullFrames += 1;
		} else if (event.name === 'LayoutShift' && event.pid === pid) {
			const data = event.args?.data;
			// As CLS counts them: shifts right after an input are excused.
			if (data?.is_main_frame && !data.had_recent_input) metrics.cls += data.weighted_score_delta ?? 0;
		}
	}
	for (const phase of PHASES) {
		const times = frameTimes[phase].sort((a, b) => a - b);
		phases[phase].frames = times.length;
		phases[phase].frameP95 = round(percentile(times, 0.95), 1);
		phases[phase].frameMax = round(times.at(-1) ?? 0, 1);
		phases[phase].longestTask = round(phases[phase].longestTask, 1);
		phases[phase].cls = round(phases[phase].cls, 4);
	}
	return { phases, longTasks };
}

/** What breaks a budget, one line each; empty when the run holds them all. */
export function budgetBreaches(metrics: TraceMetrics): string[] {
	const breaches: string[] = [];
	for (const phase of PHASES) {
		const { frameP95, frameMax, longTasks, longestTask, cls } = metrics.phases[phase];
		if (frameP95 > BUDGET.frameP95) breaches.push(`${phase}: p95 ${frameP95} ms per frame > ${BUDGET.frameP95} ms`);
		if (frameMax > BUDGET.frameMax) breaches.push(`${phase}: worst frame ${frameMax} ms > ${BUDGET.frameMax} ms`);
		if (longTasks > 0) breaches.push(`${phase}: ${longTasks} task(s) over ${BUDGET.longTask} ms, longest ${longestTask} ms`);
		if (cls > BUDGET.cls) breaches.push(`${phase}: CLS ${cls} > ${BUDGET.cls}`);
	}
	return breaches;
}

/**
 * The page's renderer: the process that holds the bench's marks. Its compositor thread reports
 * the frames.
 */
function pageThreads(events: TraceEvent[]) {
	const mark = events.find((event) => event.name === MARK.scroll);
	if (!mark) throw new Error(`mark ${MARK.scroll} missing from the trace`);
	const threadNamed = (name: string) =>
		events.find((event) => event.name === 'thread_name' && event.pid === mark.pid && event.args?.name === name)?.tid;
	const mainThread = threadNamed('CrRendererMain');
	const compositor = threadNamed('Compositor');
	if (mainThread === undefined || compositor === undefined) throw new Error('renderer threads missing from the trace');
	return { pid: mark.pid, mainThread, compositor };
}

/**
 * The phase at a timestamp: `Intro` until the scroll starts (the Intro, then the scenes being built),
 * then the scene section crossing the middle of the window, or `Reste`; nothing after the end.
 */
function phaseTimeline(marks: Map<string, number[]>, scrollStart: number, end: number) {
	const changes: { ts: number; phase: Phase; inside: boolean }[] = [];
	for (const phase of PHASES) {
		for (const ts of marks.get(MARK.enter(phase)) ?? []) changes.push({ ts, phase, inside: true });
		for (const ts of marks.get(MARK.leave(phase)) ?? []) changes.push({ ts, phase, inside: false });
	}
	changes.sort((a, b) => a.ts - b.ts);
	return (ts: number): Phase | null => {
		if (ts > end) return null;
		if (ts < scrollStart) return 'Intro';
		let current: Phase = 'Reste';
		for (const change of changes) {
			if (change.ts > ts) break;
			if (change.inside) current = change.phase;
			else if (current === change.phase) current = 'Reste';
		}
		return current;
	};
}

function percentile(sorted: number[], fraction: number) {
	if (sorted.length === 0) return 0;
	// Nearest rank.
	return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function emptyRecord<T>(make: () => T) {
	return Object.fromEntries(PHASES.map((phase) => [phase, make()])) as Record<Phase, T>;
}

function round(value: number, digits: number) {
	return Number(value.toFixed(digits));
}
