import { select, Selection } from "d3";

 // The data stored with each plot element (e.g. 'circle')
export type CaseData = { plotNum: number, caseID: string };

export type DotsElt = SVGSVGElement | null;

// For proper typing of D3 callbacks, the initial selection must be typed appropriately.

// type arguments:
//  SVGCircleElement: type of element being selected
//  CaseData: type of data attached to selected element
//  SVGSVGElement: type of parent element selected by initial/global select
//  unknown: type of data attached to parent element (none in this case)
export type DotSelection = Selection<SVGCircleElement, CaseData, SVGSVGElement, unknown>;

// selects all all g elements, which contain inner and outer circles
export function selectGraphDots(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll("g.graph-dot")
          : null;
}

export function selectOuterCircles(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll(".graph-dot .outer-circle")
          : null;
}

export function selectOuterCirclesSelected(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll(".graph-dot .outer-circle.selected")
          : null;
}

export function selectInnerCircles(svg: DotsElt): DotSelection | null {
  return svg
          ? select(svg).selectAll(".graph-dot .inner-circle")
          : null;
}

