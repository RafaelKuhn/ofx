import { Ofx } from "../ofxParser.js";
import { ReadFile } from "../types.js";
import { formatMoney } from "../utils.js";
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

/** @type {Map.<string, string>} */
const currencyMap = new Map();
currencyMap.set("BRL", "R$");
currencyMap.set("USD", "U$");

const mapCurrency = val => currencyMap.get(val) ?? val;


/** @type {Array.<{ date: Date, chart: Chart }>} */
const chartObjs = [];


let minima =  Infinity;
let maxima = -Infinity

/**
 * @param {Ofx} ofx
 * @param {ReadFile} readFile
 */
export const chartOfx = (ofx, readFile) => {

	// const list = document.getElementById("fileList");
	const list = document.querySelector(".list");
	const canvas = document.createElement("canvas");
	list.append(canvas);
	canvas.style.background = "beige";
	canvas.style.marginBottom = "10px";
	const ctx = canvas.getContext("2d");

	const firstCurrency = ofx.transactionCurrencyObjs[0];
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
          text: `${readFile.name} | ${formatMoney(start)} => ${formatMoney(end)}`,
        }
      },
      scales: {
        y: {
          beginAtZero: false,
					ticks: {
						callback: value => `${mapCurrency(currency)} ${formatMoney(value)}`,
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

	if (localMaxima > maxima) maxima = localMaxima;
	if (localMinima < minima) minima = localMinima;

	chartObjs.push({ date: sortedDates[0], chart })
	postProcessMaps(list);

	// chart.options.scales.y.max = 50000;
	// chart.update();
}

const postProcessMaps = list => {
	chartObjs.sort((a, b) => new Date(a.date) - new Date(b.date));

	const margin = (maxima - minima) * 0.05;

	for (const chartObj of chartObjs) {
		list.appendChild(chartObj.chart.canvas);
		chartObj.chart.options.scales.y.min = minima - margin;
		chartObj.chart.options.scales.y.max = maxima + margin;
		chartObj.chart.update();
	}

}