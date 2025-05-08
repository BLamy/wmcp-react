/**
 * Simple utility functions
 */

/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function add(a, b) {
  const total = a + b;
  return total;
}

/**
 * Subtracts second number from first
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Difference of a and b
 */
export function subtract(a, b) {
  const difference = a - b;
  return difference;
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - Input string
 * @returns {string} String with first letter capitalized
 */
export function capitalize(str) {
  if (!str || typeof str !== 'string' || str.length === 0) return '';
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
  return capitalized;
}

/**
 * Reverses a string
 * @param {string} str - Input string
 * @returns {string} Reversed string
 */
export function reverseString(str) {
  if (!str || typeof str !== 'string') return '';
  const reversed = str.split('').reverse().join('');
  return reversed;
}
