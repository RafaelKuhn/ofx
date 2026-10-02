import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initChartContainer, updateChartMaxima, deleteChart } from '../src/web/webCharter.js';

// Stand in for Chart.js: update exposes its independently rounded maximum
// unless a fixed maximum is configured.
const chartObject = roundedMaximum => ({
	chart: {
		roundedMaximum,
		options: { scales: { y: {} } },
		scales: { y: {} },
		update() {
			this.scales.y.max = this.options.scales.y.max ?? this.roundedMaximum;
		},
		canvas: { remove() {} },
		destroy() {},
	},
});

test('shares the largest automatically rounded limit and restores individual limits', () => {
	const data = initChartContainer();
	data.chartObjs.push(chartObject(5000), chartObject(8000));
	updateChartMaxima(data);
	assert.deepEqual(data.chartObjs.map(({ chart }) => chart.scales.y.max), [8000, 8000]);
	updateChartMaxima(data, false);
	assert.deepEqual(data.chartObjs.map(({ chart }) => chart.scales.y.max), [5000, 8000]);
	updateChartMaxima(data, true);
	assert.deepEqual(data.chartObjs.map(({ chart }) => chart.scales.y.max), [8000, 8000]);
});

test('single graph uses identical automatic scaling in both modes', () => {
	const data = initChartContainer();
	const single = chartObject(5000);
	data.chartObjs.push(single);
	for (const enabled of [true, false, true]) {
		updateChartMaxima(data, enabled);
		assert.equal(single.chart.scales.y.max, 5000);
		assert.equal(Object.hasOwn(single.chart.options.scales.y, 'max'), false);
	}
});

test('adding and removing graphs recomputes limits without retaining an old shared cap', () => {
	const data = initChartContainer();
	data.chartObjs.push(chartObject(100), chartObject(200));
	updateChartMaxima(data);
	const largest = chartObject(1000);
	data.chartObjs.push(largest);
	updateChartMaxima(data);
	assert.deepEqual(data.chartObjs.map(({ chart }) => chart.scales.y.max), [1000, 1000, 1000]);
	deleteChart(largest, data);
	assert.deepEqual(data.chartObjs.map(({ chart }) => chart.scales.y.max), [200, 200]);
	deleteChart(data.chartObjs[1], data);
	assert.equal(data.chartObjs[0].chart.scales.y.max, 100);
});
