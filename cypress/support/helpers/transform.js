/**
 * Parse an SVG transform string into an object with tx, ty, sx, sy properties
 * @param {string} transform - The SVG transform string
 * @returns {Object} An object with tx, ty, sx, sy properties
 */
export function parseTransform(transform) {
  let tx = 0, ty = 0, sx = 1, sy = 1;
  if (transform) {
    const translateMatch = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    if (translateMatch) {
      tx = parseFloat(translateMatch[1]);
      ty = parseFloat(translateMatch[2]);
    }
    const scaleMatch = transform.match(/scale\(([-\d.]+),\s*([-\d.]+)\)/);
    if (scaleMatch) {
      sx = parseFloat(scaleMatch[1]);
      sy = parseFloat(scaleMatch[2]);
    }
  }
  return { tx, ty, sx, sy };
}
