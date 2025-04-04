#!/usr/bin/env node

import ofxConvertjs from 'ofx-convertjs';
import fs from 'fs';





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

/** @type {Map.<String, Number>} */
const totalByCurrency = new Map();
const inputsByCurrency = new Map();
const outputsByCurrency = new Map();

const balanceByCurrency = new Map();

const operationsByDesc = new Map();

/** @type {Map.<String, Operation>} */
const operationsObjsByDesc = new Map();

class Settings {
	/**
	 * @constructor
	 * @param {Array.<string>} paths
	 * @param {number} cols
	 */
	constructor(paths, cols) {
		this.paths = paths;
		this.cols = cols;
	}
}

/**
 * @param {Array.<string>} args
 * @returns {Settings}
 */
const parseArgs = args => {

	args.shift();
	args.shift();

	/** @type {Settings} */
	const settings = {
		cols: 80,
		paths: [],
	}

	for (let i = 0; i < args.length; ++i) {
		const arg = args[i];
	
		if (arg === "-c") {
			const lastI = args.length - 1;
			if (i === lastI) {
				console.error(`no argument for -c`);
				process.exit();
			}
	
			i += 1;
			const cValue = args[i];
			const cValueInt = parseInt(cValue);
			if (isNaN(cValueInt) || cValue !== '' + cValueInt) {
				console.error(`argument for -c must be numeric`);
				process.exit();
			}
	
			if (cValueInt < 10) {
				console.error(`argument for -c must be at least 10`);
				process.exit();
			}
	
			settings.columns = cValueInt;
			args.splice(i - 1, 2);
			i -= 2;
			continue;
		}
	
	}

	settings.paths = args;

	if (settings.paths.length === 0) {
		console.error(`Provide at least one path for .ofx parsing.`);
		process.exit(1);
	}

	return settings;
}






// store just the first 45 digits of MEMO
// Transferência enviada pelo Pix - EDUARDA LIMA 

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
		LEDGERBAL: { BALAMT: String, DTASOF: String, },
		BALLIST: {
			BAL: Array.<{
				NAME: String,
				DESC: String,
				BALTYPE: String,
				VALUE: String,
			}>
		}
	}>
}} RawOfxTypedef
*/

class Ofx {
	/**
	 * @constructor
	 * @param {Date} emittedDate
	 * @param {string} language
	 * @param {Array.<TransactionCurrencyObj>} transactionCurrencyObjs
	 */
	constructor(emittedDate, language, transactionCurrencyObjs) {
		this.emittedDate = emittedDate;
		this.language = language;
		this.transactionCurrencyObjs = transactionCurrencyObjs;
	}
}

class TransactionCurrencyObj {
	/**
	 * @constructor
	 * @param {string} currency
	 * @param {string} accountType
	 * @param {Date} startDate
	 * @param {Date} endDate
	 * @param {Array.<Transaction>} transactions
	 * @param {Array.<Bal>} extraBalanceList
	 * @param {number} endBalance
	 * @param {number} startBalance
	 */
	constructor(currency, accountType, endBalance, startDate, endDate, transactions, startBalance, extraBalanceList) {
		this.currency = currency;
		this.accountType = accountType;
		this.endBalance = endBalance;
		this.startDate = startDate;
		this.endDate = endDate;
		this.transactions = transactions;
		this.extraBalanceList = extraBalanceList;
		this.startBalance = startBalance;
	}
}

class Transaction {
	/**
	 * @constructor
	 * @param {number} amount
	 * @param {string} id
	 * @param {string} description
	 * @param {Date} date
	 * @param {string} typeCreditDebit
	 */
	constructor(amount, id, description, date, typeCreditDebit) {
		this.amount = amount;
		this.id = id;
		this.description = description;
		this.date = date;
		this.typeCreditDebit = typeCreditDebit;
	}
}

class Bal {
	/**
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 * @param {string} baltype
	 * @param {number} amount
	 */
	constructor(name, description, baltype, amount) {
		this.name = name;
		this.description = description;
		this.baltype = baltype;
		this.amount = amount;
	}
}

/**
 * @param {RawOfxTypedef} ofxData
 * @returns {Ofx}
 */
const parseOfx = ofxData => {

	const notAListOfCurrencies = isUndef(ofxData?.BANKMSGSRSV1?.[0]);
	if (notAListOfCurrencies) {
		const onlyCurrency = ofxData?.BANKMSGSRSV1;
		ofxData.BANKMSGSRSV1 = { };
		ofxData.BANKMSGSRSV1['0'] = onlyCurrency;
	}

	console.log(`\nparsing ofx`);

	const ofx = new Ofx();
	ofx.language = ofxData?.SIGNONMSGSRSV1?.SONRS?.LANGUAGE;
	ofx.emittedDate = parseDate(ofxData?.SIGNONMSGSRSV1?.SONRS?.DTSERVER);
	ofx.transactionCurrencyObjs = [];

	for (const currencyInd in ofxData.BANKMSGSRSV1) {
		const rawBankTransfersOfCurrency = ofxData?.BANKMSGSRSV1?.[currencyInd];
		const currency   = rawBankTransfersOfCurrency?.CURDEF;
		const acctType   = rawBankTransfersOfCurrency?.BANKACCTFROM?.ACCTTYPE;
		const startDate  = parseDate(rawBankTransfersOfCurrency?.BANKTRANLIST?.DTSTART);
		const endDate    = parseDate(rawBankTransfersOfCurrency?.BANKTRANLIST?.DTEND);
		const endBalance = parseFloat(rawBankTransfersOfCurrency?.LEDGERBAL?.BALAMT);

		const transactionCurrencyObj = new TransactionCurrencyObj();
		transactionCurrencyObj.accountType = acctType;
		transactionCurrencyObj.currency  = currency;
		transactionCurrencyObj.startDate = startDate;
		transactionCurrencyObj.endDate   = endDate;
		transactionCurrencyObj.endBalance = endBalance;
		transactionCurrencyObj.transactions = [];
		transactionCurrencyObj.extraBalanceList = [];

		const transactionsByIndex = rawBankTransfersOfCurrency.BANKTRANLIST.STMTTRN;
		for (const transactionIndex in transactionsByIndex) {
			const rawTransaction = transactionsByIndex?.[transactionIndex];

			const parsedAmt = parseFloat(rawTransaction?.TRNAMT);
			const datePosted = parseDate(rawTransaction?.DTPOSTED);
			const description =
			  rawTransaction?.NAME ? rawTransaction.NAME
			: rawTransaction?.MEMO ? rawTransaction.MEMO
			: "NULL";

			const transaction = new Transaction();
			transaction.amount = parsedAmt;
			transaction.date = datePosted;
			transaction.description = description;
			transaction.id = rawTransaction?.FITID;
			transaction.typeCreditDebit = rawTransaction?.TRNTYPE;

			transactionCurrencyObj.transactions.push(transaction);
		}

		if (!isUndef(rawBankTransfersOfCurrency?.BALLIST?.BAL)) {
			const isSingleBalInBalList = !(rawBankTransfersOfCurrency.BALLIST.BAL instanceof Array);
			if (isSingleBalInBalList) {
				const singleBal = rawBankTransfersOfCurrency.BALLIST.BAL;
				rawBankTransfersOfCurrency.BALLIST.BAL = [];
				rawBankTransfersOfCurrency.BALLIST.BAL.push(singleBal);	
			}

			for (const rawBal of rawBankTransfersOfCurrency.BALLIST.BAL) {
				const bal = new Bal();
				bal.amount = parseFloat(rawBal.VALUE);
				bal.baltype = rawBal.BALTYPE;
				bal.name = rawBal.NAME;
				bal.description = rawBal.DESC;
				transactionCurrencyObj.extraBalanceList.push(bal);
			}
		}

		transactionCurrencyObj.startBalance =
      getStartBalanceFromTransactionsAndBal(endBalance, transactionCurrencyObj.transactions, transactionCurrencyObj.extraBalanceList);

		console.log(filterTransactionCurrencyObj(transactionCurrencyObj));
		ofx.transactionCurrencyObjs.push(transactionCurrencyObj);
	}
}

/** @param {TransactionCurrencyObj} */
const filterTransactionCurrencyObj = ({ currency, startDate, endDate, startBalance, endBalance }) =>
                                     ({ currency, startDate, endDate, startBalance, endBalance })


/**
 * @param {number} endBalance
 * @param {Array.<Transaction>} transactions
 * @param {Array.<Bal>} bals
 * @returns {number}
 */
const getStartBalanceFromTransactionsAndBal = (endBalance, transactions, bals) => {

	let totalInTransactions = 0;
	for (const transaction of transactions) {
		totalInTransactions += transaction.amount;
	}

  let totalInBals = 0;
  for (const bal of bals) {
    totalInBals += bal.amount;
  }

	return endBalance - totalInTransactions - totalInBals;
}





const run = () => {
	const args = process.argv.slice();
	const settings = parseArgs(args);

	/** @type {Array.<Ofx>} */
	const ofxs = [];

	for (const path of settings.paths) {
		if (fs.lstatSync(path).isDirectory()) {
			console.log(`directory: '${path}', skipping`);
			continue;
		}

		const file = fs.readFileSync(path, 'utf8')
		/** @type {RawOfxTypedef} */
		const ofxData = ofxConvertjs.toJson(file).OFX;

		const ofx = parseOfx(ofxData);
    ofxs.push(ofx)
    continue;

		logRealData(`| - - file ${path}, language ${ofxData.SIGNONMSGSRSV1.SONRS.LANGUAGE}:`);

		const notAListOfCurrencies = isUndef(ofxData.BANKMSGSRSV1[0]);
		if (notAListOfCurrencies) {
			const onlyCurrency = ofxData.BANKMSGSRSV1;
			ofxData.BANKMSGSRSV1 = { };
			ofxData.BANKMSGSRSV1['0'] = onlyCurrency;
		}

		// console.log(ofxData);
		// console.log(`BANKMSGSRSV1:`);
		// console.log(ofxData.BANKMSGSRSV1);
		// console.log(`\n\n + +\n\n`);
		// dates here
		// console.log(ofxData.BANKMSGSRSV1[0].BANKTRANLIST);
		// data here
		// console.log(ofxData.BANKMSGSRSV1[0].BANKTRANLIST.STMTTRN);

		for (const currencyInd in ofxData.BANKMSGSRSV1) {
			const bankTransfersOfCurrency = ofxData?.BANKMSGSRSV1?.[currencyInd];
			// console.log(`of currency ID ${currencyInd}: `);
			// console.log(ofxData.BANKMSGSRSV1);

			const currency = bankTransfersOfCurrency?.CURDEF;
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
				// logRealData(`| ${totalOfCurrency.toFixed(2).padStart(pad0)} ${parsedAmt.toFixed(2).padStart(pad1)}   ${formatDate(datePosted)}  ${description}`);
				logRealData(`| ${formatEnglish(totalOfCurrency).padStart(pad0)} ${formatEnglish(parsedAmt).padStart(pad1)}   ${formatDate(datePosted)}  ${description}`);

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

			// TODO: remove break
			break;
		}

		logRealData(`\n             Inputs      Outputs   Difference        Start      Balance`);
		for (const [key, input] of inputsByCurrency) {
			const output = outputsByCurrency.get(key);
			const inputOutput = totalByCurrency.get(key);
			const balance = balanceByCurrency.get(key);
			const startBalance = balance - inputOutput;
			logRealData(`${key} -> ${formatEnglish(input).padStart(12)} ${formatEnglish(output).padStart(12)} ${formatEnglish(inputOutput).padStart(12)} ${formatEnglish(startBalance).padStart(12)} ${formatEnglish(balance).padStart(12)}`);
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
		logRealData(`\n${"Qtd".padStart(pads.shift())} ${"Operação".padStart(pads.shift())} ${"Entradas".padStart(pads.shift())} ${"Saídas".padStart(pads.shift())}`);

		for (const { count, description, inputTotal, outputTotal } of arr) {

			const pads = [ 4, maxLen, 12, 12 ];
			const countStr = `${count}`;
			const inputTotalStr  = formatEnglish(inputTotal);
			const outputTotalStr = formatEnglish(outputTotal);
			const desc = description.length <= maxLen ? description : description.substring(0, maxLen);
			logRealData(`${countStr.padStart(pads.shift())} ${desc.padStart(pads.shift())} ${inputTotalStr.padStart(pads.shift())} ${outputTotalStr.padStart(pads.shift())}`);
		}
		// for (const [description, obj] of (operationsObjsByDesc)) {
		// 	logRealData(key.padStart(30), "->", amt);
		// }
		logRealData(``);

		// for (const [key, amt] of (operationsByDesc)) {
		// 	logRealData(key.padStart(30), "->", amt);			
		// }
		logRealData(`\n`);

	}
}


/**
 * @param {number} value
 * @returns {string}
 */
const formatEnglish = value => number_format(value, 2, ".", ",");

/**
 * @param {Date} date
 * @returns {string}
 */
const formatDate = date => {
	const isoDate = date.toISOString();
	const formatted = `${isoDate.substring(8, 10)}/${isoDate.substring(5, 7)}/${isoDate.substring(0, 4)}`
	return formatted;
}


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
	// console.log(str)
}

const isUndef = arg => typeof arg === "undefined";



/**
 * @param {string} dateStr
 * @returns {Date}
 */
const parseDate = dateStr => {
	if (isUndef(dateStr)) return undefined;

	// let date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
	let date = new Date(2025, 0, 1, 0, 0, 0, 0);
	date.setMilliseconds(0);
	date.setSeconds(0);
	date.setMinutes(0);
	date.setHours(0);

	let ct = 0;

	const year  = dateStr.substring(ct, ct += 4);
	const month = dateStr.substring(ct, ct += 2);
	const day   = dateStr.substring(ct, ct += 2);
	date.setDate( parseInt(day) );
	date.setMonth( parseInt(month) - 1 );
	date.setFullYear( parseInt(year) );

	// logs if correct
	// console.log(`from str '${dateStr}' date: ${formatDate(date)}`);
	return date;
}

run();