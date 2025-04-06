

/**
 * @param {*} arg
 * @returns {boolean}
 */
export const isUndef = arg => typeof arg === "undefined";


/**
 * @param {number} value
 * @returns {string}
 */
const formatEnglish = value => number_format(value, 2, ".", ",");

/**
 * @param {Date} date
 * @returns {string}
 */
const formatDate = date => {
	const isoDate = date.toISOString();
	const formatted = `${isoDate.substring(8, 10)}/${isoDate.substring(5, 7)}/${isoDate.substring(0, 4)}`
	return formatted;
}
