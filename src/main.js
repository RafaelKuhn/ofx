import './style/style.css'
import { filterTransactionCurrencyObj, makeOfxParser } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx } from './web/webCharter.js';


const init = () => {
	const parseOfx = makeOfxParser();

	initHtmlFileReader(readFile => {
		const ofx = parseOfx(readFile);
		console.log(filterTransactionCurrencyObj(ofx.transactionCurrencyObjs[0]));	
		chartOfx(ofx, readFile);
	});

}

window.addEventListener("load", init);
