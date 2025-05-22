import { filterTransactionCurrencyObj, Ofx } from "../ofxParser.js";


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
