import './style/style.css'
import { filterTransactionCurrencyObj, makeOfxParseFunc } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx, deleteChart, initChartContainer } from './web/webCharter.js';
import { logBasic } from './web/log.js';


const init = () => {
	const parseOfx = makeOfxParseFunc();
	const chartContainer = initChartContainer();

	initHtmlFileReader(instancedFile => {
		const file = instancedFile.file;
		const ofx = parseOfx(file);
		const chartObj = chartOfx(ofx, chartContainer, file);

		instancedFile.closeAnchor.addEventListener("click", () => deleteChart(chartObj, chartContainer))
	});

}

window.addEventListener("load", init);
