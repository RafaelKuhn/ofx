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
		/** @type {Array.<{ date: Date, chart: Chart }>} */
		this.chartObjs = [];
	}
}

export const initChartData = () => new ChartData();


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

	const firstCurrency = ofx.allTransactionCurrencyObjs[0];
	const currency = firstCurrency.currency;

	const start = firstCurrency.startBalance;
	const end = firstCurrency.endBalance;
	const transactions = firstCurrency.transactions;

	// Aggregate amounts by day (YYYY-MM-DD)
	const dailyTotals = {};

	let localMinima = firstCurrency.startBalance;
	let localMaxima = firstCurrency.startBalance;

	/** @param {Date} date @returns {string} */
	const toIso = date => date.toISOString().split("T")[0]; // "YYYY-MM-DD"

	/** @param {number} value */
	const accountForLocals = value => {
		if (value < localMinima) localMinima = value;
		if (value > localMaxima) localMaxima = value;
	}

	const startDate = toIso(firstCurrency.startDate);
	dailyTotals[startDate] = firstCurrency.startBalance;
	accountForLocals(firstCurrency.startBalance);

	// TODO: we assume transactions are sorted
	let lastDailyTotal = start;
	for (const tx of transactions) {
		const dateStr = toIso(tx.date);
		if (!dailyTotals[dateStr]) {
			dailyTotals[dateStr] = lastDailyTotal;
		}
		dailyTotals[dateStr] += tx.amount;
		lastDailyTotal += tx.amount;
		accountForLocals(lastDailyTotal);
	}

	const endDate = toIso(firstCurrency.endDate);
	dailyTotals[endDate] = firstCurrency.endBalance;
	accountForLocals(firstCurrency.endBalance);


	// Sort dates chronologically
	const sortedDates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));

	const data = sortedDates.map(date => dailyTotals[date]);

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
			datasets: [{
				label: "Total Balance",
				data,
				backgroundColor: "rgba(153, 102, 255, 0.2)",
				borderColor: "rgba(153, 102, 255, 1)",
				borderWidth: 2,
				tension: 0.4
			}]
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
					min: localMinima - margin,
					max: localMaxima + margin,
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

	chartData.chartObjs.push({ date: sortedDates[0], chart })
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

	for (const chartObj of chartData.chartObjs) {
		list.appendChild(chartObj.chart.canvas);
		chartObj.chart.options.scales.y.min = Math.max(0, chartData.minima - margin);
		chartObj.chart.options.scales.y.max = chartData.maxima + margin;
		chartObj.chart.update();
	}

}


