#!/usr/bin/env node

import ofxConvertjs from 'ofx-convertjs';
import { readFileSync } from 'fs';
import { type } from 'os';

const args = process.argv.slice();
args.shift();
args.shift();
// console.log(args);

const paths = args;

if (paths.length === 0) {
	console.log(`Provide at least one path for .ofx parsing.`);
	process.exit(1);
}



// store just the first 45 digits of MEMO
// Transferência enviada pelo Pix - EDUARDA LIMA 
// Transferência enviada pelo Pix - Kauan Portella losekam




/**
// SONRS: { STATUS: { CODE: String, SEVERITY: String }, DTSERVER: String LANGUAGE: String },
BANKMSGSRSV1: Array.<> is actually not an array but an object with numeric keys
@typedef {{
	SIGNONMSGSRSV1: {
		SONRS: {
			STATUS: { CODE: String, SEVERITY: String },
			DTSERVER: String
			LANGUAGE: String
		}
	},
	BANKMSGSRSV1: Array.<{
		CURDEF: String,
		BANKACCTFROM: { BANKID: String, ACCTID: String, ACCTTYPE: String },
		BANKTRANLIST: {
			DTSTART: String,
			DTEND: String,
			STMTTRN: Array.<{
				TRNTYPE:  String,
				DTPOSTED: String,
				TRNAMT:   String,
				NAME:     String,
				MEMO:     String,
				FITID:    String,
			}>,
		},
		LEDGERBAL: { BALAMT: String, DTASOF: String, }
	}>
}} OfxTypedef
*/



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

// class OperationDesc {
// 	/**
// 	 * @param {Number} count
// 	 * @param {Number} inputs
// 	 * @param {Number} outputs
// 	 * @param {string} desc
// 	 */
// 	constructor(count, inputs, outputs, desc) {
// 		this.count = count;
// 		this.inputs = inputs;
// 		this.outputs = outputs;
// 		this.desc = desc;
// 	}
// }

/** @type {Map.<String, Number>} */
const totalByCurrency = new Map();
const inputsByCurrency = new Map();
const outputsByCurrency = new Map();

const balanceByCurrency = new Map();

const operationsByDesc = new Map();

/** @type {Map.<String, Operation>} */
const operationsObjsByDesc = new Map();

const run = () => {

	for (const path of paths) {
		const file = readFileSync(path, 'utf8')
		/** @type {OfxTypedef} */
		const ofxData = ofxConvertjs.toJson(file).OFX;

		logRealData(`| - - file ${path}, language ${ofxData.SIGNONMSGSRSV1.SONRS.LANGUAGE}:`);

		const singleCurrency = isUndef(ofxData.BANKMSGSRSV1[0]);
		if (singleCurrency) {
			const onlyCurrency = ofxData.BANKMSGSRSV1;
			ofxData.BANKMSGSRSV1 = { };
			ofxData.BANKMSGSRSV1['0'] = onlyCurrency;
		}

		// console.log(`BANKMSGSRSV1:`);
		console.log(ofxData.BANKMSGSRSV1);
		// console.log(`\n\n + +\n\n`);
		// console.log(ofxData.BANKMSGSRSV1[0].BANKTRANLIST.STMTTRN);

		for (const currencyInd in ofxData.BANKMSGSRSV1) {
			const bankTransfersOfCurrency = ofxData.BANKMSGSRSV1[currencyInd];
			// console.log(`of currency ID ${currencyInd}: `);
			// console.log(ofxData.BANKMSGSRSV1);
			// console.log(bankTransfersOfCurrency);

			// TODO: handle currency undefined?
			const currency = bankTransfersOfCurrency.CURDEF;
			if (!totalByCurrency.has(currency)) totalByCurrency.set(currency, 0.0);
			if (!inputsByCurrency.has(currency)) inputsByCurrency.set(currency, 0.0);
			if (!outputsByCurrency.has(currency)) outputsByCurrency.set(currency, 0.0);
			if (!balanceByCurrency.has(currency)) balanceByCurrency.set(currency, 0.0);

			const startDate = parseDate(bankTransfersOfCurrency.BANKTRANLIST.DTSTART);
			const endDate   = parseDate(bankTransfersOfCurrency.BANKTRANLIST.DTEND);

			const hasNoTransactions = isUndef(bankTransfersOfCurrency.BANKTRANLIST.STMTTRN);
			logRealData(`| - currency ${currency}, ${startDate.toDateString()} - ${endDate.toDateString()}:`);
			if (hasNoTransactions) {
				// console.log(`| `);
				continue;
			}

			const pad0 = 12;
			const pad1 = 12;
			
			logRealData(`| ${("SOMA".padStart(pad0))} ${("VALOR".padStart(pad1))}        DATA            TIPO`);
			
			// console.log(bankTransfersOfCurrency.BANKTRANLIST.STMTTRN);
			const endBalance = bankTransfersOfCurrency.LEDGERBAL.BALAMT;
			// console.log(` - - - - - -  ${endBalance}`);
			balanceByCurrency.set(currency, parseFloat(endBalance))

			const transactionsByIndex = bankTransfersOfCurrency.BANKTRANLIST.STMTTRN;
			for (const transactionIndex in transactionsByIndex) {
				const transaction = transactionsByIndex[transactionIndex];
				const parsedAmt = parseFloat(transaction.TRNAMT);
				const datePosted = parseDate(transaction.DTPOSTED);
				const description =
					transaction.NAME ? transaction.NAME
					: transaction.MEMO ? transaction.MEMO
					: "NULL";

				// if (!operationsByDesc.has(description)) operationsByDesc.set(description, 0);
				if (!operationsObjsByDesc.has(description)) operationsObjsByDesc.set(description, new Operation(0, 0, 0));

				const operationObj = operationsObjsByDesc.get(description);
				operationObj.count += 1;
				// operationsByDesc.set(description, operationsByDesc.get(description) + 1);

				const totalOfCurrency = totalByCurrency.get(currency);
				// logRealData(`| ${totalOfCurrency.toFixed(2).padStart(pad0)} ${parsedAmt.toFixed(2).padStart(pad1)}   ${datePosted.toDateString()}  ${description}`);
				logRealData(`| ${formatEnglish(totalOfCurrency).padStart(pad0)} ${formatEnglish(parsedAmt).padStart(pad1)}   ${datePosted.toDateString()}  ${description}`);

				const inputOfCurrency = inputsByCurrency.get(currency);
				const outputOfCurrency = outputsByCurrency.get(currency);

				totalByCurrency.set(currency, totalOfCurrency + parsedAmt);

				const isAnInput = parsedAmt >= 0;
				if (isAnInput) {
					operationObj.inputTotal += parsedAmt;
					inputsByCurrency.set(currency, inputOfCurrency + parsedAmt);
				} else {
					operationObj.outputTotal += parsedAmt;
					outputsByCurrency.set(currency, outputOfCurrency + parsedAmt);
				}
			}

			logRealData(`| `);

			// for (const transfer of bankTransfersOfCurrency.BANKTRANLIST.STMTTRN) {
			// 	console.log(`transfer`);
			// 	console.log(transfer);
			// }
		}

		console.log(`\n             Inputs      Outputs   Difference        Start      Balance`);
		for (const [key, input] of inputsByCurrency) {
			const output = outputsByCurrency.get(key);
			const inputOutput = totalByCurrency.get(key);
			const balance = balanceByCurrency.get(key);
			const startBalance = balance - inputOutput;
			console.log(`${key} -> ${formatEnglish(input).padStart(12)} ${formatEnglish(output).padStart(12)} ${formatEnglish(inputOutput).padStart(12)} ${formatEnglish(startBalance).padStart(12)} ${formatEnglish(balance).padStart(12)}`);
		}

		/** @type {Array.<Operation>} */
		const arr = []
		for (const [description, obj] of (operationsObjsByDesc)) {
			obj.description = description;
			arr.push(obj);
		}

		// arr.sort((a, b) => b.count - a.count);
		// arr.sort((a, b) => b.inputTotal - a.inputTotal);
		arr.sort((a, b) => (b.inputTotal + b.outputTotal) - (a.inputTotal + a.outputTotal));

		const maxLen = 150;
		const pads = [ 4, maxLen, 12, 12 ];
		console.log(`\n${"Qtd".padStart(pads.shift())} ${"Operação".padStart(pads.shift())} ${"Entradas".padStart(pads.shift())} ${"Saídas".padStart(pads.shift())}`);

		for (const { count, description, inputTotal, outputTotal } of arr) {

			const pads = [ 4, maxLen, 12, 12 ];
			const countStr = `${count}`;
			const inputTotalStr  = formatEnglish(inputTotal);
			const outputTotalStr = formatEnglish(outputTotal);
			const desc = description.length <= maxLen ? description : description.substring(0, maxLen);
			console.log(`${countStr.padStart(pads.shift())} ${desc.padStart(pads.shift())} ${inputTotalStr.padStart(pads.shift())} ${outputTotalStr.padStart(pads.shift())}`);
		}
		// for (const [description, obj] of (operationsObjsByDesc)) {
		// 	console.log(key.padStart(30), "->", amt);
		// }
		console.log(``);

		// for (const [key, amt] of (operationsByDesc)) {
		// 	console.log(key.padStart(30), "->", amt);			
		// }
		console.log(`\n`);

	}
}


const formatEnglish = value => number_format(value, 2, ".", ",");


const number_format = (number, decimals, dec_point, thousands_sep) => {
	var n = !isFinite(+number) ? 0 : +number, 
			prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
			sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
			dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
			toFixedFix = function (n, prec) {
					// Fix for IE parseFloat(0.55).toFixed(0) = 0;
					var k = Math.pow(10, prec);
					return Math.round(n * k) / k;
			},
			s = (prec ? toFixedFix(n, prec) : Math.round(n)).toString().split('.');
	if (s[0].length > 3) {
			s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
	}
	if ((s[1] || '').length < prec) {
			s[1] = s[1] || '';
			s[1] += new Array(prec - s[1].length + 1).join('0');
	}
	return s.join(dec);
}

const logRealData = str => {
	console.log(str)
}

const isUndef = arg => typeof arg === "undefined";



/**
 * @param {String} dateStr
 * @returns {Date}
 */
const parseDate = dateStr => {
	// if (dateStr.length != 14) console.error(` ! ! '${dateStr}' ${dateStr.length} != 14`);

	// let date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
	let date = new Date(2025, 0, 1, 0, 0, 0, 0);
	date.setMilliseconds(0);
	date.setSeconds(0);
	date.setMinutes(0);
	date.setHours(-3); // WORKAROUND FOR BRAZIL

	let ct = 0;

	const year  = dateStr.substring(ct, ct += 4);
	const month = dateStr.substring(ct, ct += 2);
	const day   = dateStr.substring(ct, ct += 2);
	date.setDate( parseInt(day) );
	date.setMonth( parseInt(month) - 1 );
	date.setFullYear( parseInt(year) );
	
	// logs correct
	// console.log(`from str '${dateStr}' date: ${date.toDateString()}`);
	return date;

	// let dateStrToparse = "";
	// dateStrToparse += dateStr.substring(ct, ct += 4);
	// dateStrToparse += "-";
	// dateStrToparse += dateStr.substring(ct, ct += 2);
	// dateStrToparse += "-";
	// dateStrToparse += dateStr.substring(ct, ct += 2);

	// dateStrToparse += "T";
	// dateStrToparse += dateStr.substring(ct, ct += 2);
	// dateStrToparse += ":";
	// dateStrToparse += dateStr.substring(ct, ct += 2);
	// dateStrToparse += ":";
	// dateStrToparse += dateStr.substring(ct, ct += 2);

	// if (dateStr[ct] !== "[")
	// 	if (dateStr.length !== ct)
	// 		console.error(` ! ! ! ! ${ct} != ${dateStr.length}`);

	// dateStrToparse += "Z";

	// const date2 = new Date(Date.parse(dateStrToparse));
	// console.log(` - -  - ${dateStrToparse}`);
	// console.log(` PARSED TO`);
	// console.log(date.getDate());
	// console.log(` AT CT ${dateStr[ct]}`);
	
	// return date;
}

run();