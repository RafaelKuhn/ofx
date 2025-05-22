import { Ofx } from "../ofxParser.js";
import { ReadFile } from "../types.js";
import { formatMoney, prettyCurrency } from "../utils.js";
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);


// TODO: type chartData

class ChartData {
	constructor() {
		this.minima =  Infinity;
		this.maxima = -Infinity;
		/** @type {Array.<ChartObj>} */
		this.chartObjs = [];
	}
}

class ChartObj {
	/**
	 * @param {Date} date
	 * @param {Chart} chart
	 */
	constructor(date, chart,) {
		this.date = date;
		this.chart = chart;
	}
}

export const initChartData = () => new ChartData();


/** @param {Date} date @returns {string} */
const toIso = date => date.toISOString().split("T")[0]; // "YYYY-MM-DD"

/**
 * @param {Ofx} ofx
 * @param {ChartData} chartData
 * @param {ReadFile} readFile
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

	// TODO: we assume transactions are sorted
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
	const balanceData = sortedDates.map(date => dailyTotals[date]);
	const expenseData = sortedDates.map(date => dailyExpense[date]);
	const incomesData = sortedDates.map(date => dailyIncomes[date]);

	const margin = (localMaxima - localMinima) * 0.05;

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
				// yAxisID: 'y'
			},
			{
				label: "Incomes",
				data: incomesData,
				backgroundColor: "rgba(72, 255, 0, 0.5)",
				borderColor: "rgb(86, 214, 27)",
				borderWidth: 2,
				// yAxisID: 'y'
			},
			{
				label: "Expenses",
				data: expenseData,
				backgroundColor: "rgb(255, 102, 102)",
				borderColor: "rgb(196, 79, 79)",
				borderWidth: 2,
				// yAxisID: 'y',
			}
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
			}
		}
	});

	if (sortedDates.length === 0) { console.error(`no date?`); return; }

	if (localMaxima > chartData.maxima) chartData.maxima = localMaxima;
	if (localMinima < chartData.minima) chartData.minima = localMinima;

	chartData.chartObjs.push(new ChartObj(sortedDates[0], chart))
	postProcessMaps(list, chartData);
}

// TODO: data type for our version of chart

/**
 * @param {Array.<{ date: string, chart: Chart }>} list
 * @param {ChartData} chartData
 */
const postProcessMaps = (list, chartData) => {
	chartData.chartObjs.sort((a, b) => new Date(a.date) - new Date(b.date));

	const margin = (chartData.maxima - chartData.minima) * 0.05;

	// TODO: if I check only total balance, it needs to apply this

	for (const chartObj of chartData.chartObjs) {
		list.appendChild(chartObj.chart.canvas);
		// chartObj.chart.options.scales.y.min = 0;
		// chartObj.chart.options.scales.y.min = Math.max(0, chartData.minima - margin);
		// chartObj.chart.options.scales.y.max = chartData.maxima + margin;
		chartObj.chart.update({ duration: 0 });
	}

}


