

/**
 * @param {*} arg
 * @returns {boolean}
 */
export const isUndef = arg => typeof arg === "undefined";


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
