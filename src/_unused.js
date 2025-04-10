import javascriptLogo from '/javascript.svg'
import viteLogo from '/vite.svg'

const example = `
	<div>
		<a href="https://vite.dev" target="_blank">
			<img src="${viteLogo}" class="logo" alt="Vite logo" />
		</a>
		<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
			<img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
		</a>
		<h1>Hello Vite!</h1>
		<p class="read-the-docs">
			Click on the Vite logo to learn more
		</p>
	</div>
`


// inside index.js
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



const logRealData = str => {
	console.log(str)
}

/** @type {Map.<String, Number>} */
const totalByCurrency = new Map();
const inputsByCurrency = new Map();
const outputsByCurrency = new Map();

const balanceByCurrency = new Map();

const operationsByDesc = new Map();

/** @type {Map.<String, Operation>} */
const operationsObjsByDesc = new Map();



// inside index.js run()
for (const path of settings.paths) {

	const file = fs.readFileSync(path, 'utf8')
	/** @type {RawOfxTypedef} */
	const ofxData = ofxConvertjs.toJson(file).OFX;

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


// document.querySelector('#app').innerHTML = wut;