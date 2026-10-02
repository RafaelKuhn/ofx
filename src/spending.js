const SPENDING_DESCRIPTION_REGEX = /pix|cr[eé]dito/i;
const MAX_OUTGOING_AMOUNT = 5000;

/** Summarize matching outgoing transactions up to 5,000 per transaction, by currency.
 */
export const summarizeSpending = ofx => {
	const byCurrency = new Map();
	for (const statement of ofx.allTransactionCurrencyObjs) {
		const currency = statement.currency;
		if (!byCurrency.has(currency)) {
			byCurrency.set(currency, { currency, totalOutgoing: 0, outgoingCount: 0 });
		}
		const summary = byCurrency.get(currency);
		for (const transaction of statement.transactions) {
			if (
				transaction.amount < 0 &&
				transaction.amount >= -MAX_OUTGOING_AMOUNT &&
				SPENDING_DESCRIPTION_REGEX.test(transaction.description ?? '')
			) {
				summary.totalOutgoing -= transaction.amount;
				summary.outgoingCount++;
			}
		}
	}
	return [...byCurrency.values()];
};

/** Average the document totals, counting each file once per currency. */
export const summarizeFileSpending = fileSummaries => {
	const byCurrency = new Map();
	for (const summaries of fileSummaries) {
		for (const { currency, totalOutgoing } of summaries) {
			if (!byCurrency.has(currency)) {
				byCurrency.set(currency, { currency, totalOutgoing: 0, fileCount: 0 });
			}
			const summary = byCurrency.get(currency);
			summary.totalOutgoing += totalOutgoing;
			summary.fileCount++;
		}
	}
	return [...byCurrency.values()].map(summary => ({
		...summary,
		averageSpentPerFile: summary.totalOutgoing / summary.fileCount,
	}));
};
