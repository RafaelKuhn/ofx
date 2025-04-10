

/**
 * @param {*} arg
 * @returns {boolean}
 */
export const isUndef = arg => typeof arg === "undefined";


/** @type {Map.<string, string>} */
const currencyMap = new Map();
currencyMap.set("BRL", "R$");
currencyMap.set("USD", "U$");

export const prettyCurrency = val => currencyMap.get(val) ?? val;

/**
 * @param {string} dateStr
 * @returns {Date}
 */
export const parseDate = dateStr => {
	if (isUndef(dateStr)) return undefined;

	// let date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
	let date = new Date(2025, 0, 1, 0, 0, 0, 0);
	date.setMilliseconds(0);
	date.setSeconds(0);
	date.setMinutes(0);
	date.setHours(0);

	let ct = 0;

	const year  = dateStr.substring(ct, ct += 4);
	const month = dateStr.substring(ct, ct += 2);
	const day   = dateStr.substring(ct, ct += 2);
	date.setDate( parseInt(day) );
	date.setMonth( parseInt(month) - 1 );
	date.setFullYear( parseInt(year) );

	// logs if correct
	// console.log(`from str '${dateStr}' date: ${formatDate(date)}`);
	return date;
}


/**
 * @param {number} value
 * @returns {string}
 */
export const formatMoney = value => number_format(value, 2, ".", ",");

const number_format = (number, decimals, dec_point, thousands_sep) => {
	var n = !isFinite(+number) ? 0 : +number, 
			prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
			sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
			dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
			toFixedFix = function (n, prec) {
					// Fix for IE parseFloat(0.55).toFixed(0) = 0;
					var k = Math.pow(10, prec);
					return Math.round(n * k) / k;
			},
			s = (prec ? toFixedFix(n, prec) : Math.round(n)).toString().split('.');
	if (s[0].length > 3) {
			s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
	}
	if ((s[1] || '').length < prec) {
			s[1] = s[1] || '';
			s[1] += new Array(prec - s[1].length + 1).join('0');
	}
	return s.join(dec);
}

/**
 * @param {Date} date
 * @returns {string}
 */
export const formatDate = date => {
	const isoDate = date.toISOString();
	const formatted = `${isoDate.substring(8, 10)}/${isoDate.substring(5, 7)}/${isoDate.substring(0, 4)}`
	return formatted;
}
