import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ReadFile } from "./types.js";
import { isUndef, parseDate } from "./utils.js";


export class Ofx {
	/**
	 * @constructor
	 * @param {Date} emittedDate
	 * @param {string} language
	 * @param {TransactionCurrencyObj} relevantCurrencyObj
	 * @param {Array.<TransactionCurrencyObj>} transactionCurrencyObjs
	 */
	constructor(emittedDate, language, relevantCurrencyObj, transactionCurrencyObjs) {
		this.emittedDate = emittedDate;
		this.language = language;
		this.relevantCurrencyObj = relevantCurrencyObj;
		this.allTransactionCurrencyObjs = transactionCurrencyObjs;
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
 * @callback ofxParseFunction
 * @param {ReadFile} readFile
 * @returns {Ofx}
 */

/**
 * @returns {ofxParseFunction}
 */
export const makeOfxParseFunc = () => {
	const xmlParser = makeXmlParser();
	return readFile => parseOfxInWeb(readFile, xmlParser);
}

/**
 * @returns {XMLParser}
 */
export const makeXmlParser = () => new XMLParser({
	parseTagValue: false,
});

/**
 * @param {ReadFile} readFile
 * @returns {Ofx}
 */
export const parseOfxInWeb = (readFile, fxpXmlParser) => {

	const xmlFileData = parseXmlInWeb(readFile, fxpXmlParser);
	if (!xmlFileData) return;

	const parsedOfxObj = parseOfxObj(xmlFileData);
	return parsedOfxObj;
}


/**
 * @param {ReadFile} readFile
 * @param {XMLParser} fxpXmlParser
 * @returns {RawOfxTypedef|false}
 */
const parseXmlInWeb = (readFile, fxpXmlParser) => {
	const fileContent = readFile.content
	const onlyXmlString = cutAfterOfxTagRemovingHeader(fileContent);
	if (!onlyXmlString) {
		alert(`error: no '<OFX>' tag found`);
		return false;
	}

	const validation = XMLValidator.validate(onlyXmlString);
	if (validation.err) {
		alert(`error: ${validation.err.msg}\nline ${validation.err.line}`);
		return false;
	}

	const parsedXml = fxpXmlParser.parse(onlyXmlString);
	if (!parsedXml.OFX) {
		alert(`error: needs to start with an '<OFX>' element`);
		return false;
	}

	return parsedXml.OFX;
}


// store just the first 45 digits of MEMO
// Transferência enviada pelo Pix - EDUARDA LIMA 

// BANKMSGSRSV1: Array.<> is actually not an array but an object with numeric keys
//// BANKMSGSRSV1.STMTTRNRS.STMTRS[0].CURDEF

/**
@typedef {{
	BANKMSGSRSV1: {
		STMTTRNRS: {
			STMTRS: Array.<{
				BANKACCTFROM: { BANKID: String, ACCTID: String, ACCTTYPE: String },
				BANKTRANLIST: {
					DTSTART: String,
					DTEND: String,
					STMTTRN: Array.<{
						TRNTYPE:  String,
						DTPOSTED: String,
						TRNAMT:   String,
						NAME:     String, // OR MEMO
						MEMO:     String,
						FITID:    String,
						// REFNUM: String
					}>
				},
				CURDEF: String,
			}>
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
	},
	SIGNONMSGSRSV1: {
		SONRS: {
			DTSERVER: String
			LANGUAGE: String
			STATUS: { CODE: String, SEVERITY: String },
		}
	},
}} RawOfxTypedef
*/


/**
 * mutates ofxData to make its type correct
 * @param {RawOfxTypedef} ofxData
 * @returns {Ofx}
 */
export const parseOfxObj = ofxData => {

	if (!Array.isArray(ofxData.BANKMSGSRSV1.STMTTRNRS.STMTRS)) {
		const val = ofxData.BANKMSGSRSV1.STMTTRNRS.STMTRS;
		ofxData.BANKMSGSRSV1.STMTTRNRS.STMTRS = [];
		ofxData.BANKMSGSRSV1.STMTTRNRS.STMTRS.push(val);
	}

	const ofx = new Ofx();
	ofx.language = ofxData?.SIGNONMSGSRSV1?.SONRS?.LANGUAGE;
	ofx.emittedDate = parseDate(ofxData?.SIGNONMSGSRSV1?.SONRS?.DTSERVER);

	// TODO: ofx.relevantCurrencyObj is the one with the most transactions
	ofx.allTransactionCurrencyObjs = [];

	const stmtrsList = ofxData.BANKMSGSRSV1.STMTTRNRS.STMTRS;
	for (const currencyInd in stmtrsList) {
		const rawBankTransfersOfCurrency = stmtrsList[currencyInd];

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

		ofx.allTransactionCurrencyObjs.push(transactionCurrencyObj);
	}

	ofx.relevantCurrencyObj = ofx.allTransactionCurrencyObjs[0];
	for (const currencyObj of ofx.allTransactionCurrencyObjs) {
		if (currencyObj.transactions.length > ofx.relevantCurrencyObj.transactions.length) {
			ofx.relevantCurrencyObj = currencyObj;
		}
	}

	// console.log("most relevant:");
	// console.log(ofx.relevantCurrencyObj);

	return ofx;
}

/**
 * @param {string} fileContent
 * @returns {string|false}
 */
const cutAfterOfxTagRemovingHeader = fileContent => {
	const lower = fileContent.toLowerCase();
	const ofxStart = lower.indexOf("<ofx>")
	if (ofxStart === -1) {
		return false;
	}

	return fileContent.slice(ofxStart);
}


/** @param {TransactionCurrencyObj} */
export
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
