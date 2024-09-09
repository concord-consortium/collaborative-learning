
// Just wraps the native getBBox method to make it mockable in tests
export function getBBox(element: SVGGraphicsElement): DOMRect {
    return element.getBBox();
}

// Round a number up to the next multiple of 5.
export function roundTo5(n: number): number {
  return Math.max(5, Math.ceil(n/5)*5);
}
