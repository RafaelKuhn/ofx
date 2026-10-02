import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeSpending, summarizeFileSpending } from '../src/spending.js';

const statement = (currency, amounts) => ({
	currency,
	transactions: amounts.map(amount => ({ amount, description: 'Transferência Pix' })),
});

test('matches Pix and accented or unaccented crédito, excluding amounts above 5,000', () => {
	const files = [
		{ allTransactionCurrencyObjs: [{ currency: 'BRL', transactions: [
			{ amount: -5000, description: 'PIX enviado' },
			{ amount: -10, description: 'Pagamento credito' },
			{ amount: -20, description: 'Pagamento crédito' },
			{ amount: -30, description: 'CREDITO' },
			{ amount: -40, description: 'CRÉDITO' },
			{ amount: -5000.01, description: 'pix' },
			{ amount: -6000, description: 'crédito' },
			{ amount: 100, description: 'crédito recebido' },
			{ amount: -100, description: 'Boleto' },
		] }] },
		{ allTransactionCurrencyObjs: [statement('BRL', [-9000])] },
	].map(summarizeSpending);
	assert.deepEqual(files[0], [{ currency: 'BRL', totalOutgoing: 5100, outgoingCount: 5 }]);
	assert.deepEqual(files[1], [{ currency: 'BRL', totalOutgoing: 0, outgoingCount: 0 }]);
	assert.deepEqual(summarizeFileSpending(files), [
		{ currency: 'BRL', totalOutgoing: 5100, fileCount: 2, averageSpentPerFile: 2550 },
	]);
});

test('totals outgoing transactions across all statements', () => {
	const result = summarizeSpending({ allTransactionCurrencyObjs: [
		statement('BRL', [-10, 100, 0, -30]),
		statement('BRL', [-20]),
	] });
	assert.deepEqual(result, [{ currency: 'BRL', totalOutgoing: 60, outgoingCount: 3 }]);
});

test('keeps currencies separate and reports zero for files without spending', () => {
	const result = summarizeSpending({ allTransactionCurrencyObjs: [
		statement('BRL', [-40]),
		statement('USD', [-10]),
		statement('EUR', [100, 0]),
		statement('GBP', []),
	] });
	assert.deepEqual(result, [
		{ currency: 'BRL', totalOutgoing: 40, outgoingCount: 1 },
		{ currency: 'USD', totalOutgoing: 10, outgoingCount: 1 },
		{ currency: 'EUR', totalOutgoing: 0, outgoingCount: 0 },
		{ currency: 'GBP', totalOutgoing: 0, outgoingCount: 0 },
	]);
});

test('each file is summarized independently', () => {
	summarizeSpending({ allTransactionCurrencyObjs: [statement('BRL', [-100])] });
	assert.deepEqual(summarizeSpending({ allTransactionCurrencyObjs: [statement('BRL', [-5])] }), [
		{ currency: 'BRL', totalOutgoing: 5, outgoingCount: 1 },
	]);
});

test('averages per file regardless of transaction count, including zero-spending files', () => {
	const files = [
		[statement('BRL', [-10, -30]), statement('BRL', [-20])],
		[statement('BRL', [-120]), statement('USD', [-10])],
		[statement('BRL', [100])],
	].map(allTransactionCurrencyObjs => summarizeSpending({ allTransactionCurrencyObjs }));
	assert.deepEqual(summarizeFileSpending(files), [
		{ currency: 'BRL', totalOutgoing: 180, fileCount: 3, averageSpentPerFile: 60 },
		{ currency: 'USD', totalOutgoing: 10, fileCount: 1, averageSpentPerFile: 10 },
	]);
	assert.deepEqual(summarizeFileSpending([]), []);
});

test('filters Pix descriptions case-insensitively for totals and per-file averages', () => {
	const files = [
		{ allTransactionCurrencyObjs: [{ currency: 'BRL', transactions: [
			{ amount: -10, description: 'pix enviado' },
			{ amount: -20, description: 'Transferência PIX' },
			{ amount: -30, description: 'Pagamento PiX recebido pelo vendedor' },
			{ amount: -500, description: 'Compra no cartão' },
			{ amount: -100 },
			{ amount: -100, description: null },
			{ amount: 200, description: 'PIX recebido' },
		] }] },
		{ allTransactionCurrencyObjs: [{ currency: 'BRL', transactions: [
			{ amount: -400, description: 'Boleto' },
		] }] },
	].map(summarizeSpending);
	assert.deepEqual(files[0], [{ currency: 'BRL', totalOutgoing: 60, outgoingCount: 3 }]);
	assert.deepEqual(files[1], [{ currency: 'BRL', totalOutgoing: 0, outgoingCount: 0 }]);
	assert.deepEqual(summarizeFileSpending(files), [
		{ currency: 'BRL', totalOutgoing: 60, fileCount: 2, averageSpentPerFile: 30 },
	]);
});
