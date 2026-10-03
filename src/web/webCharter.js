import { Ofx } from "../ofxParser.js";
import { ReadFile } from "../types.js";
import { formatMoney, prettyCurrency } from "../utils.js";
import { Chart, registerables } from 'chart.js';
import { indexTransactionsByDate } from '../transactionIndex.js';

Chart.register(...registerables);

const USE_SHARED_CHART_MAXIMUM = true;

/** Share the largest upper limit chosen by Chart.js's automatic tick rounding. */
export const updateChartMaxima = (chartData, sharedMaximum = chartData.sharedMaximum) => {
	chartData.sharedMaximum = sharedMaximum;
	let maximum = -Infinity;
	for (const { chart } of chartData.chartObjs) {
		// Remove any previous shared cap before asking for the natural scale.
		delete chart.options.scales.y.max;
		chart.update('none');
		const roundedMaximum = chart.scales.y.max;
		if (Number.isFinite(roundedMaximum)) maximum = Math.max(maximum, roundedMaximum);
	}

	chartData.maxima = maximum;
	// A single graph always retains exactly the same automatic scale.
	if (!sharedMaximum || chartData.chartObjs.length < 2 || !Number.isFinite(maximum)) return;

	for (const { chart } of chartData.chartObjs) {
		chart.options.scales.y.max = maximum;
		chart.update('none');
	}
};

class ChartData {
	constructor() {
		this.sharedMaximum = USE_SHARED_CHART_MAXIMUM;
		this.minima =  Infinity;
		this.maxima = -Infinity;
		/** @type {Array.<ChartObj>} */
		this.chartObjs = [];
		this.transactionsByGraph = new Map();
	}
}

class ChartObj {
	/**
	 * @param {Date} date
	 * @param {Chart} chart
	 * @param {Symbol} fileSymbol
	 */
	constructor(date, chart, fileSymbol,) {
		this.date = date;
		this.chart = chart;
		this.fileSymbol = fileSymbol;
	}
}

export const initChartContainer = () => new ChartData();


/** @param {Date} date @returns {string} */
const toIso = date => date.toISOString().split("T")[0]; // "YYYY-MM-DD"

/**
 * @param {Ofx} ofx
 * @param {ChartData} chartData
 * @param {ReadFile} readFile
 * @returns {ChartObj}
 */
export const chartOfx = (ofx, chartData, readFile) => {

	// const list = document.getElementById("fileList");
	const list = document.querySelector(".list");
	const canvas = document.createElement("canvas");
	list.append(canvas);

	canvas.style.background = "beige";
	canvas.style.marginBottom = "10px";
	const ctx = canvas.getContext("2d");

	const relevantCurrency = ofx.relevantCurrencyObj;
	const currency = relevantCurrency.currency;

	const start = relevantCurrency.startBalance;
	const end = relevantCurrency.endBalance;
	const transactions = relevantCurrency.transactions;
	const graphId = Symbol(readFile.name);
	const transactionsByDate = indexTransactionsByDate(transactions);

	// Aggregate amounts by day (YYYY-MM-DD)
	const dailyTotals = {};
	const dailyIncomes = {};
	const dailyExpense = {};

	let localMinima = relevantCurrency.startBalance;
	let localMaxima = relevantCurrency.startBalance;

	/** @param {number} value */
	const trySetLocalMinimasAndMaxima = value => {
		if (value < localMinima) localMinima = value;
		if (value > localMaxima) localMaxima = value;
	}

	const startDate = toIso(relevantCurrency.startDate);
	dailyTotals[startDate] = relevantCurrency.startBalance;
	if (!dailyIncomes[startDate]) dailyIncomes[startDate] = 0.0;
	if (!dailyExpense[startDate]) dailyExpense[startDate] = 0.0;
	trySetLocalMinimasAndMaxima(relevantCurrency.startBalance);

	// we assume transactions are sorted
	let lastDailyTotal = start;
	for (const tx of transactions) {
		const dateStr = toIso(tx.date);
		if (!dailyTotals[dateStr]) dailyTotals[dateStr] = lastDailyTotal;

		dailyTotals[dateStr] += tx.amount;
		lastDailyTotal += tx.amount;

		if (!dailyIncomes[dateStr]) dailyIncomes[dateStr] = 0.0;
		if (!dailyExpense[dateStr]) dailyExpense[dateStr] = 0.0;
		if (tx.amount > 0.0) dailyIncomes[dateStr] += tx.amount;
		else dailyExpense[dateStr] += Math.abs(tx.amount);

		trySetLocalMinimasAndMaxima(lastDailyTotal);
	}

	const endDate = toIso(relevantCurrency.endDate);
	dailyTotals[endDate] = relevantCurrency.endBalance;
	if (!dailyIncomes[endDate]) dailyIncomes[endDate] = 0.0;
	if (!dailyExpense[endDate]) dailyExpense[endDate] = 0.0;

	trySetLocalMinimasAndMaxima(relevantCurrency.endBalance);

	// Sort dates chronologically
	const sortedDates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
	const dateKeys = [...sortedDates];
	const balanceData = sortedDates.map(date => dailyTotals[date]);
	const expenseData = sortedDates.map(date => dailyExpense[date]);
	const incomesData = sortedDates.map(date => dailyIncomes[date]);

	// const margin = (localMaxima - localMinima) * 0.05;

	for (let i = 0; i < sortedDates.length; ++i) {
		const date = sortedDates[i];
		sortedDates[i] = `${date.substring(8, 10)}/${date.substring(5, 7)}/${date.substring(0, 4)}`;
	}

	const cur = prettyCurrency(currency);
	const chart = new Chart(ctx, {
		type: "line",
		data: {
			labels: sortedDates,
			datasets: [
			{
				label: "Total Balance",
				data: balanceData,
				backgroundColor: "rgba(153, 102, 255, 1)",
				borderColor: "rgba(153, 102, 255, 1)",
				borderWidth: 2,
				// yAxisID: 'y',
				// tension: 0.4
			},
			{
				label: "Income",
				data: incomesData,
				backgroundColor: "rgba(72, 255, 0, 0.5)",
				borderColor: "rgb(86, 214, 27)",
				borderWidth: 2,
				// yAxisID: 'y',
				// tension: 0.4
			},
			{
				label: "Outgoing",
				data: expenseData,
				backgroundColor: "rgb(255, 102, 102)",
				borderColor: "rgb(196, 79, 79)",
				borderWidth: 2,
				// yAxisID: 'y',
				// tension: 0.4
			},
		]
		},
		options: {
			responsive: true,
			plugins: {
				legend: {
					position: "top"
				},
				title: {
					display: true,
					text: [ readFile.name, `${cur} ${formatMoney(start)} → ${cur} ${formatMoney(end)}` ],
				}
			},
			scales: {
				y: {
					beginAtZero: false,
					ticks: {
						callback: value => `${cur} ${formatMoney(value)}`,
					},
					// min: localMinima - margin,
					// max: localMaxima + margin,
				},
				x: {
					ticks: {
						autoSkip: true,
						maxTicksLimit: 10
					}
				}
			},
			onClick: (event, elements, chart) => {
				// if (elements.length == 0) console.log(`no element clicked ?`);
				if (elements.length == 0) return;

				const firstElement = elements[0];

				const datasetIndex = firstElement.datasetIndex;
				const dataIndex = firstElement.index;

				const label = chart.data.labels[dataIndex];
				const value = chart.data.datasets[datasetIndex].data[dataIndex];

				const graphName = chart.options.plugins.title.text[0];
				/** @type {HTMLDialogElement} */
				const modal = document.getElementById('nodeModal');
				document.getElementById('nodeModalText').textContent = `Node Clicked, Label: ${label}, Value: ${value}\ngraph: '${graphName}'`;

				const dayTransactions = chartData.transactionsByGraph.get(graphId)?.get(dateKeys[dataIndex]) ?? [];
				const transactionList = document.getElementById('nodeTransactions');

				transactionList.replaceChildren();

				for (const transaction of dayTransactions) {
					const item = document.createElement('li');
					const description = document.createElement('span');

					description.textContent = transaction.description || 'No description';

					const amount = document.createElement('span');
					amount.className = 'transaction-amount';
					amount.textContent = `${cur} ${transaction.amount > 0 ? '+' : ''}${formatMoney(transaction.amount)}`;

					item.append(description, amount);
					transactionList.append(item);
				}

				document.getElementById('nodeTransactionsEmpty').hidden = dayTransactions.length > 0;
				if (!modal.open) modal.showModal();
			}

		}
	});

	if (sortedDates.length === 0) { console.error(`no date?`); return; }

	if (localMaxima > chartData.maxima) chartData.maxima = localMaxima;
	if (localMinima < chartData.minima) chartData.minima = localMinima;

	const chartObj = new ChartObj(sortedDates[0], chart, graphId);
	chartData.transactionsByGraph.set(graphId, transactionsByDate);
	chartData.chartObjs.push(chartObj)
	postProcessMaps(list, chartData);

	return chartObj;
}


/**
 * @param {ChartObj} chartObj
 * @param {ChartData} chartData
 */
export const deleteChart = (chartObj, chartData) => {
	const indexOfChart = chartData.chartObjs.indexOf(chartObj);
	if (indexOfChart === -1) { console.error("chart not found, debug!"); return; }

	chartData.chartObjs.splice(indexOfChart, 1);
	chartData.transactionsByGraph.delete(chartObj.fileSymbol);

	chartObj.chart.canvas.remove();
	chartObj.chart.destroy();

	updateChartMaxima(chartData);
}

// TODO: data type for our version of chart

/**
 * @param {Array.<{ date: string, chart: Chart }>} list
 * @param {ChartData} chartData
 */
const postProcessMaps = (list, chartData) => {
	chartData.chartObjs.sort((a, b) => new Date(a.date) - new Date(b.date));

	// const margin = (chartData.maxima - chartData.minima) * 0.05;

	for (const chartObj of chartData.chartObjs) {
		list.appendChild(chartObj.chart.canvas);
		// chartObj.chart.options.scales.y.min = 0;
		// chartObj.chart.options.scales.y.min = Math.max(0, chartData.minima - margin);
	}
	updateChartMaxima(chartData);

}


