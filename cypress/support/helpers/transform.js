/**
 * Parse an SVG transform string and return the requested part.
 * @param {string} transform - The SVG transform string
 * @param {string} operation - The operation to return. One of 'translate', 'scale', or 'rotate'
 * @param {number} index - The index, eg 0 for the first scale, 1 for the second, etc.
 * @returns {List} A list of the requested operation's parameters.
 * @example
 * const transform = "translate(10, 20) scale(3, 4) translate(5, 6)";
 * const parsed = parseTransform(transform, 'translate');
 * console.log(parsed); // [10, 20]
 * const parsed = parseTransform(transform, 'scale');
 * console.log(parsed); // [3, 4]
 * const parsed = parseTransform(transform, 'translate', 1);
 * console.log(parsed); // [5, 6]
 */
export function parseTransform(transform, operation, index = 0) {
  if (!transform) {
    return [];
  }

  // Create regex pattern for the requested operation
  const pattern = new RegExp(`${operation}\\(([^)]+)\\)`, 'g');
  const matches = [];
  let match;

  // Find all matches for the operation
  while ((match = pattern.exec(transform)) !== null) {
    // Split the parameters and convert to numbers
    const params = match[1].split(',').map(param => parseFloat(param.trim()));
    matches.push(params);
  }

  // Return the requested match by index, or empty array if not found
  return matches[index] || [];
}
