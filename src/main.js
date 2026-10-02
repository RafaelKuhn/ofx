import './style/style.css'
import { makeXmlParser, parseOfx } from './ofxParser.js';
import { initHtmlFileReader } from './web/webFileLoader.js';
import { chartOfx, deleteChart, initChartContainer, updateChartMaxima } from './web/webCharter.js';
import { createTimingRun } from './web/performance.js';
import { logSpending } from './web/log.js';
import { summarizeSpending } from './spending.js';


const init = () => {
	const xmlParser = makeXmlParser();
	const chartContainer = initChartContainer();
	const spendingByFile = new Map();
	const clearAllButton = document.getElementById('clearAllGraphs');
	const sharedMaximumToggle = document.getElementById('sharedMaximumToggle');
	const fileControls = document.getElementById('fileControls');
	const fileList = document.getElementById('fileList');
	const chartControls = document.getElementById('chartControls');
	const updateControlsVisibility = () => {
		const fileCount = fileList.querySelectorAll('li:not(#liTemplate)').length;
		fileControls.hidden = fileCount < 2;
		chartControls.hidden = fileCount < 2 || chartContainer.chartObjs.length === 0;
	};
	// Track listed files, including ones still loading or unable to produce a graph.
	new MutationObserver(updateControlsVisibility).observe(fileList, { childList: true });
	updateControlsVisibility();
	clearAllButton.addEventListener('click', () => {
		// Reuse each file's cleanup for charts, spending, duplicate tracking,
		// and any pending file reads. Keep the hidden listing template intact.
		for (const closeAnchor of document.querySelectorAll('#fileList > li:not(#liTemplate) .close')) {
			closeAnchor.click();
		}
		document.getElementById('fileInput').value = '';
		updateControlsVisibility();
	});
	sharedMaximumToggle.checked = chartContainer.sharedMaximum;
	sharedMaximumToggle.addEventListener('change', () => {
		updateChartMaxima(chartContainer, sharedMaximumToggle.checked);
	});

	initHtmlFileReader((instancedFile, timings) => {
		const file = instancedFile.file;
		let ofx;
		try {
			ofx = timings.measure('OFX parsing', () => parseOfx(file.content, xmlParser));
		} catch (error) {
			alert(`error: ${error.message}`);
			return;
		}

		const spending = summarizeSpending(ofx);
		spendingByFile.set(instancedFile, spending);
		instancedFile.closeAnchor.addEventListener('click', () => spendingByFile.delete(instancedFile));
		// logSpending(spending, file.name, spendingByFile.values());

		const chartObj = timings.measure('Chart creation (synchronous)', () => chartOfx(ofx, chartContainer, file));

		instancedFile.closeAnchor.addEventListener("click", () => {
			deleteChart(chartObj, chartContainer);
			updateControlsVisibility();
		});
		updateControlsVisibility();
	});

}

window.addEventListener("load", () => {
	const timings = createTimingRun('Page initialization');
	try {
		timings.measure('Initialize app', init);
	} finally {
		// timings.report();
	}
});
