import './style/style.css'
import { filterTransactionCurrencyObj, makeOfxParseFunc } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx, initChartData } from './web/webCharter.js';


const init = () => {
	const parseOfx = makeOfxParseFunc();
	const chartData = initChartData();

	initHtmlFileReader(readFile => {
		const ofx = parseOfx(readFile);
		chartOfx(ofx, chartData, readFile);
		// console.log(filterTransactionCurrencyObj(ofx.transactionCurrencyObjs[0]));	
	});

}

window.addEventListener("load", init);
