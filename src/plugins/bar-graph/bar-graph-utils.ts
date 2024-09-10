
// Just wraps the native getBBox method to make it mockable in tests
export function getBBox(element: SVGGraphicsElement): DOMRect {
    return element.getBBox();
}
