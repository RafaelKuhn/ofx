import './style/style.css'
import { makeXmlParser, parseOfx } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx, deleteChart, initChartContainer } from './web/webCharter.js';
import { createTimingRun } from './web/performance.js';


const init = () => {
	const xmlParser = makeXmlParser();
	const chartContainer = initChartContainer();

	initHtmlFileReader((instancedFile, timings) => {
		const file = instancedFile.file;
		let ofx;
		try {
			ofx = timings.measure('OFX parsing', () => parseOfx(file.content, xmlParser));
		} catch (error) {
			alert(`error: ${error.message}`);
			return;
		}
		const chartObj = timings.measure('Chart creation (synchronous)', () => chartOfx(ofx, chartContainer, file));

		instancedFile.closeAnchor.addEventListener("click", () => deleteChart(chartObj, chartContainer))
	});

}

window.addEventListener("load", () => {
	const timings = createTimingRun('Page initialization');
	try {
		timings.measure('Initialize app', init);
	} finally {
		timings.report();
	}
});
