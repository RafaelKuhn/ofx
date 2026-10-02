import { filterTransactionCurrencyObj, Ofx } from "../ofxParser.js";
import { summarizeFileSpending } from "../spending.js";

export const logSpending = (summaries, fileName, fileSummaries) => {
	const averages = new Map(summarizeFileSpending(fileSummaries).map(summary => [summary.currency, summary]));
	console.group(`Pix/crédito spending (transactions up to 5,000): ${fileName}`);
	console.table(summaries.map(summary => ({
		Currency: summary.currency,
		'Total matching outgoing': summary.totalOutgoing.toFixed(2),
		'Files in average': averages.get(summary.currency).fileCount,
		'Average matching spent per file': averages.get(summary.currency).averageSpentPerFile.toFixed(2),
	})));
	console.groupEnd();
};


/**
 * @param {Ofx} ofx 
 */
export const logBasic = ofx => {
	console.log(filterTransactionCurrencyObj(ofx.allTransactionCurrencyObjs[0]));
}



// inside index.js
class Operation {
	/**
	 * @param {Number} count
	 * @param {Number} inputs
	 * @param {Number} outputs
	 */
	constructor(count, inputs, outputs) {
		this.count = count;
		this.inputTotal = inputs;
		this.outputTotal = outputs;
	}
}



/**
 * @param {Ofx} ofx 
 */
export const logWhatever = ofx => {
	const totalByCurrency = new Map();
	const inputsByCurrency = new Map();
	const outputsByCurrency = new Map();

	const balanceByCurrency = new Map();

	/** @type {Map.<String, Operation>} */
	const operationsObjsByDesc = new Map();
}
