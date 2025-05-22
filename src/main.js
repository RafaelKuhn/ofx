import './style/style.css'
import { filterTransactionCurrencyObj, makeOfxParseFunc } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx, initChartData } from './web/webCharter.js';
import { logBasic } from './web/log.js';


const init = () => {
	const parseOfx = makeOfxParseFunc();
	const chartData = initChartData();

	initHtmlFileReader(readFile => {
		const ofx = parseOfx(readFile);
		chartOfx(ofx, chartData, readFile);

		// logBasic(ofx)
	});

}

window.addEventListener("load", init);
