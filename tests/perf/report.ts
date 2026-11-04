import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHASES, type TraceMetrics } from './trace';

/** Ignored by git: the report and the traces of the last run. */
export const RESULTS = 'perf-results';
const REPORT = join(RESULTS, 'report.json');

/**
 * Writes one section of `perf-results/report.json`, keeping the others: running a single profile
 * (`--project finger`) updates its own section only. Each section says when and on which commit it
 * was measured.
 */
export function saveSection(name: string, data: unknown) {
	mkdirSync(RESULTS, { recursive: true });
	let report: Record<string, unknown> = {};
	try {
		report = JSON.parse(readFileSync(REPORT, 'utf8'));
	} catch {
		// First run, or a report from an older bench: started afresh.
		report = {};
	}
	report[name] = { measuredAt: new Date().toISOString(), commit: currentCommit(), ...(data as object) };
	writeFileSync(REPORT, `${JSON.stringify(report, null, '\t')}\n`);
}

function currentCommit() {
	try {
		const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
		const dirty = execSync('git status --porcelain --untracked-files=no', { encoding: 'utf8' }).trim();
		return dirty ? `${commit}+changes` : commit;
	} catch {
		return 'unknown';
	}
}

/** The per-phase table of a profile, then its long tasks. */
export function formatScroll(profile: string, metrics: TraceMetrics) {
	const header = ['Phase', 'Frames', 'p95 ms', 'Max ms', 'Lost', '>50 ms', 'Longest ms', 'CLS'];
	const rows = PHASES.map((phase) => {
		const m = metrics.phases[phase];
		return [phase, m.frames, m.frameP95, m.frameMax, `${m.lostFrames}/${m.lostFrames + m.fullFrames}`, m.longTasks, m.longestTask, m.cls].map(String);
	});
	const lines = [`Profile ${profile}`, ...table([header, ...rows])];
	const longest = [...metrics.longTasks].sort((a, b) => b.duration - a.duration).slice(0, 10);
	if (longest.length > 0) {
		lines.push('', `Longest tasks (${metrics.longTasks.length} over 50 ms):`);
		for (const task of longest) {
			const since = task.sinceIntroEnd === null ? '' : `, ${task.sinceIntroEnd >= 0 ? '+' : ''}${task.sinceIntroEnd} s from the Intro's end`;
			lines.push(`  ${task.duration} ms at ${task.at} s (${task.phase}${since})`);
		}
	}
	return lines.join('\n');
}

export function table(rows: string[][]) {
	const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
	return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  '));
}
