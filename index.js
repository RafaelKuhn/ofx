#!/usr/bin/env node

//  ############################################################################
//  ############################### TERMINAL APP ###############################
//  ############################################################################

import fs from 'fs';
import { Ofx, parseOfxObj, filterTransactionCurrencyObj, makeXmlParser } from './src/ofxParser.js';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';


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


/**
 * @typedef {import('./src/ofxParser.js').RawOfxTypedef} RawOfxTypedef
 */

const run = () => {
	const args = process.argv.slice();
	const settings = parseArgs(args);

	/** @type {Array.<{ ofx: Ofx, path: string }>} */
	const ofxsAndPaths = [];

	for (const path of settings.paths) {
		if (fs.lstatSync(path).isDirectory()) {
			console.log(`directory: '${path}', skipping`);
			continue;
		}

		const xmlParser = makeXmlParser();

		const fileContent = fs.readFileSync(path, 'utf8');

		const rawParsedXml = xmlParser.parse(fileContent);
		if (!rawParsedXml.OFX) {
			console.error(`error: '${path}': needs to start with an '<OFX>' element, skipping`);
			return false;
		}

		/** @type {RawOfxTypedef} */
		const rawOfx = rawParsedXml.OFX;

		const ofx = parseOfxObj(rawOfx);
    ofxsAndPaths.push({ ofx, path });

		//  console.log(rawOfx.BANKMSGSRSV1.STMTTRNRS.STMTRS[0].BANKTRANLIST.STMTTRN);
		//  console.log(ofx.allTransactionCurrencyObjs[0].transactions);
	}

	for (const { ofx, path } of ofxsAndPaths) {
		console.log(`\n\nfile '${path}':`);
		console.log(ofx.allTransactionCurrencyObjs[0].transactions);
	}

}


run();