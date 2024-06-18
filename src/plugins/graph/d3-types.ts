import { select, Selection } from "d3";

// The data stored with each plot element (e.g. 'circle')
export type CaseData = { dataConfigID: string, plotNum: number, caseID: string };

export type DotsElt = SVGSVGElement | null;

// For proper typing of D3 callbacks, the initial selection must be typed appropriately.

// type arguments:
//  SVGElement: type of element being selected
//  CaseData: type of data attached to selected element
//  SVGSVGElement: type of parent element selected by initial/global select
//  unknown: type of data attached to parent element (none in this case)
export type DotSelection = Selection<SVGGElement, CaseData, SVGSVGElement, unknown>;

export const graphDotSelector = "g.graph-dot";

// selects all all g elements, which contain inner and outer circles
export function selectGraphDots(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll(graphDotSelector)
          : null;
}

export function selectOuterCircles(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll("g.graph-dot .outer-circle")
          : null;
}

export function selectOuterCirclesSelected(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll("g.graph-dot .outer-circle.selected")
          : null;
}

export function selectInnerCircles(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll("g.graph-dot .inner-circle")
          : null;
}

/**
 * Returns true if node is a graph dot.
 * @param node
 * @returns boolean
 */
export function isGraphDot(node: Node) {
  return (node.nodeName === "g"
      && node instanceof SVGElement
      && node.classList.contains("graph-dot"));
}

/**
 * Returns true if node is a graph dot, or part of a graph dot.
 * @param node
 * @returns the graph dot element, or undefined
 */
export function inGraphDot(node: Node): SVGElement | undefined {
  if (isGraphDot(node)) return node as SVGElement;
  const parent = node.parentNode;
  if (parent && parent instanceof SVGElement) {
    return inGraphDot(parent);
  } else {
    return undefined;
  }
}
