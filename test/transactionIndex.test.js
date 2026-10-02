import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexTransactionsByDate } from '../src/transactionIndex.js';
import { initChartContainer, deleteChart } from '../src/web/webCharter.js';

test('queries all transactions by graph and date without mixing same-named files', () => {
	const data = initChartContainer();
	const firstGraph = Symbol('statement.ofx');
	const secondGraph = Symbol('statement.ofx');
	const outgoing = { date: new Date('2026-10-01T12:00:00Z'), description: 'Purchase', amount: -50 };
	const incoming = { date: new Date('2026-10-01T14:00:00Z'), description: 'Deposit', amount: 100 };
	const otherDay = { date: new Date('2026-10-02T12:00:00Z'), description: 'Fee', amount: -5 };
	data.transactionsByGraph.set(firstGraph, indexTransactionsByDate([outgoing, incoming, otherDay]));
	data.transactionsByGraph.set(secondGraph, indexTransactionsByDate([otherDay]));
	assert.deepEqual(data.transactionsByGraph.get(firstGraph).get('2026-10-01'), [outgoing, incoming]);
	assert.deepEqual(data.transactionsByGraph.get(firstGraph).get('2026-10-02'), [otherDay]);
	assert.equal(data.transactionsByGraph.get(secondGraph).get('2026-10-01'), undefined);
	assert.equal(indexTransactionsByDate([]).size, 0);

	const graph = { fileSymbol: firstGraph, chart: { canvas: { remove() {} }, destroy() {} } };
	data.chartObjs.push(graph);
	deleteChart(graph, data);
	assert.equal(data.transactionsByGraph.has(firstGraph), false);
	assert.equal(data.transactionsByGraph.has(secondGraph), true);
});
