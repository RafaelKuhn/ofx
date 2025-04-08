import { initHtmlFileReader } from './web/webFileLoader.js';
import { filterTransactionCurrencyObj, parseOfxInWeb, xmlParserOptions } from './ofxParser.js';
import { ReadFile } from "./types.js";
import './style.css'


const init = () => {
	if (!fxp) {
		console.error(`fxp library not found!`);
		return;
	}

	const fxpXmlParser = new fxp.XMLParser(xmlParserOptions);
	initHtmlFileReader(readFile => onFileRead(readFile, fxpXmlParser));
}

/**
 * @param {ReadFile} readFile
 * @param {*} fxpXmlParser
 */
const onFileRead = (readFile, fxpXmlParser) => {
	const ofx = parseOfxInWeb(readFile, fxpXmlParser)
	console.log(filterTransactionCurrencyObj(ofx.transactionCurrencyObjs[0]));
}

window.addEventListener("load", init);
