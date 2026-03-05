import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BASE_NAMES = require('../../data/names.json');

/**
 * Assigns names to a given number of robots.
 *
 * Draws from the 20 base names in data/names.json in order. When the count
 * exceeds 20, the list cycles with a numeric suffix: Robbie_2, Jane_2, etc.
 * for the second cycle, Robbie_3 for the third, and so on.
 *
 * @param {number} count - Number of robots (must be >= 1)
 * @returns {string[]} Array of robot names, length === count
 */
export function assignRobotNames(count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const nameIndex = i % BASE_NAMES.length;
    const cycle = Math.floor(i / BASE_NAMES.length);
    const baseName = BASE_NAMES[nameIndex];
    result.push(cycle === 0 ? baseName : `${baseName}_${cycle + 1}`);
  }
  return result;
}