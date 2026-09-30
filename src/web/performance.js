let nextRunId = 0;
const retainedMeasures = [];
const MAX_RETAINED_MEASURES = 200;

/** Each run owns its marks so simultaneous file reads cannot collide. */
export const createTimingRun = label => {
	const prefix = `OFX #${++nextRunId}: ${label}`;
	const rows = [];
	let nextStageId = 0;

	const start = stage => {
		const name = `${prefix} / ${++nextStageId} ${stage}`;
		const startMark = `${name}:start`;
		const endMark = `${name}:end`;
		performance.mark(startMark);
		let stopped = false;
		return () => {
			if (stopped) return;
			stopped = true;
			performance.mark(endMark);
			const entry = performance.measure(name, startMark, endMark);
			rows.push({ stage, milliseconds: Number(entry.duration.toFixed(3)) });
			performance.clearMarks(startMark);
			performance.clearMarks(endMark);
			retainedMeasures.push(name);
			if (retainedMeasures.length > MAX_RETAINED_MEASURES) {
				performance.clearMeasures(retainedMeasures.shift());
			}
		};
	};

	return {
		start,
		// For synchronous functions; use start()/stop() for asynchronous work.
		measure(stage, action) {
			const stop = start(stage);
			try {
				return action();
			} finally {
				stop();
			}
		},
		report() {
			console.groupCollapsed(prefix);
			console.table(rows);
			console.groupEnd();
		},
	};
};
