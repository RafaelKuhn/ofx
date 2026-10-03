/** Group the transactions plotted by one graph using its YYYY-MM-DD date keys. */
export const indexTransactionsByDate = transactions => {
	const byDate = new Map();
	for (const transaction of transactions) {
		const date = transaction.date.toISOString().split('T')[0];
		if (!byDate.has(date)) byDate.set(date, []);
		byDate.get(date).push(transaction);
	}
	return byDate;
};
