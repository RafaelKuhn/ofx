import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOfx, makeOfxParseFunc, makeXmlParser, parseOfxObj } from '../src/ofxParser.js';
import { parseDate } from '../src/utils.js';

const CLOSING_TAG_ERROR_REGEX = /closing tag/;
const CLI_AMOUNT_REGEX = /amount: 10/;
const CLI_DESCRIPTION_REGEX = /Example & Co/;

const transaction = (id = '001', amount = 10) => `<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20240229120000</DTPOSTED>
<TRNAMT>${amount}</TRNAMT><FITID>${id}</FITID><NAME>Example &amp; Co</NAME>
</STMTTRN>`;
const statement = (transactions = '', balances = '', currency = 'USD') => `<STMTTRNRS>
<TRNUID>1</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS><CURDEF>${currency}</CURDEF>
<BANKACCTFROM><BANKID>1</BANKID><ACCTID>123</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20240201</DTSTART><DTEND>20240301</DTEND>${transactions}</BANKTRANLIST>
<LEDGERBAL><BALAMT>100</BALAMT><DTASOF>20240301</DTASOF></LEDGERBAL>
${balances}</STMTRS></STMTTRNRS>`;
const wrap = statements => `<OFX><SIGNONMSGSRSV1><SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>20240301</DTSERVER><LANGUAGE>ENG</LANGUAGE></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>${statements}</BANKMSGSRSV1></OFX>`;
const balance = (value, type = 'DOLLAR') => `<BAL><NAME>Information</NAME>
<DESC>Informational value</DESC><BALTYPE>${type}</BALTYPE><VALUE>${value}</VALUE></BAL>`;

for (const [count, transactions, expectedAmounts, expectedStart] of [
	[0, '', [], 100],
	[1, transaction(), [10], 90],
	[2, transaction() + transaction('002', -20), [10, -20], 110],
]) {
	test(`parses ${count} transactions`, () => {
		const result = parseOfx(wrap(statement(transactions))).relevantCurrencyObj;
		assert.deepEqual(result.transactions.map(tx => tx.amount), expectedAmounts);
		assert.equal(result.startBalance, expectedStart);
		if (count) {
			assert.equal(result.transactions[0].id, '001');
			assert.equal(result.transactions[0].description, 'Example & Co');
			assert.equal(result.transactions[0].date.getDate(), 29);
		}
	});
}

test('retains multiple statement responses and selects the one with most transactions', () => {
	const result = parseOfx(wrap(statement(transaction()) +
		statement(transaction('002', 20) + transaction('003', 30), '', 'BRL')));
	assert.equal(result.allTransactionCurrencyObjs.length, 2);
	assert.deepEqual(result.allTransactionCurrencyObjs.map(s => s.startBalance), [90, 50]);
	assert.equal(result.relevantCurrencyObj.currency, 'BRL');
});

test('does not mutate parsed input while normalizing singleton elements', () => {
	const raw = makeXmlParser().parse(wrap(statement(transaction(), `<BALLIST>${balance(500)}</BALLIST>`))).OFX;
	const before = structuredClone(raw);
	parseOfxObj(raw);
	assert.deepEqual(raw, before);
});

for (const [label, balances] of [['single', balance(500)], ['multiple', balance(500) + balance(7.85, 'PERCENT')]]) {
	test(`${label} informational balances do not affect opening balance`, () => {
		const result = parseOfx(wrap(statement(transaction(), `<BALLIST>${balances}</BALLIST>`))).relevantCurrencyObj;
		assert.equal(result.startBalance, 90);
		assert.equal(result.extraBalanceList[0].amount, 500);
		if (result.extraBalanceList.length === 2) {
			assert.equal(result.extraBalanceList[1].amount, 7.85);
			assert.equal(result.extraBalanceList[1].baltype, 'PERCENT');
		}
	});
}

test('keeps leap days and month boundaries in their original calendar year', () => {
	for (const [input, expected] of [
		['20240229', [2024, 1, 29]], ['20000229', [2000, 1, 29]],
		['20260228', [2026, 1, 28]], ['20261231', [2026, 11, 31]],
	]) {
		const date = parseDate(input);
		assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], expected);
	}
	assert.equal(parseDate(undefined), undefined);
});

// Deliberately handwritten SGML: omitted scalar end tags, an empty value,
// and an explicitly closed value mixed into the same document.
const sgml = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0
<SEVERITY>INFO
</STATUS><DTSERVER>20240301
<LANGUAGE>ENG
</SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS><STMTRS><CURDEF>USD
<BANKACCTFROM><BANKID>1<ACCTID>123<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20240201<DTEND>20240301
<!-- A comment with <NAME>example markup inside it -->
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240229120000
<TRNAMT>10<FITID>001<NAME>
<MEMO>Example &amp; Co</MEMO></STMTTRN></BANKTRANLIST>
<LEDGERBAL><BALAMT>100<DTASOF>20240301</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

test('browser and core parser support OFX 1.x SGML with mixed scalar end tags', () => {
	const core = parseOfx(sgml);
	assert.deepEqual(makeOfxParseFunc()({ content: sgml }), core);
	const result = core.relevantCurrencyObj;
	assert.equal(result.transactions.length, 1);
	assert.equal(result.transactions[0].amount, 10);
	assert.equal(result.transactions[0].description, 'Example & Co');
	assert.equal(result.startBalance, 90);
});

test('does not repair malformed XML or missing SGML aggregate end tags', () => {
	const xml = wrap(statement(transaction()));
	assert.throws(() => parseOfx(xml.replace('</TRNAMT>', '')), CLOSING_TAG_ERROR_REGEX);
	assert.throws(() => parseOfx(sgml.replace('</STMTTRN>', '')), CLOSING_TAG_ERROR_REGEX);
});

test('CLI uses the SGML-capable parser', () => {
	const directory = mkdtempSync(join(tmpdir(), 'ofx-parser-test-'));
	try {
		const path = join(directory, 'statement.ofx');
		writeFileSync(path, sgml);
		const output = execFileSync(process.execPath, [fileURLToPath(new URL('../index.js', import.meta.url)), path], { encoding: 'utf8' });
		assert.match(output, CLI_AMOUNT_REGEX);
		assert.match(output, CLI_DESCRIPTION_REGEX);
	} finally {
		rmSync(directory, { recursive: true });
	}
});
