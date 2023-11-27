import { select, Selection } from "d3";
import { IDataConfigurationModel } from "./models/data-configuration-model";

 // The data stored with each plot element (e.g. 'circle')
export type CaseData = { dataConfigID: string, plotNum: number, caseID: string };

export type DotsElt = SVGSVGElement | null;

// For proper typing of D3 callbacks, the initial selection must be typed appropriately.

// type arguments:
//  SVGCircleElement: type of element being selected
//  CaseData: type of data attached to selected element
//  SVGSVGElement: type of parent element selected by initial/global select
//  unknown: type of data attached to parent element (none in this case)
export type DotSelection = Selection<SVGCircleElement, CaseData, SVGSVGElement, unknown>;

// selects all `circle` elements
export function selectCircles(svg: DotsElt, dataConfiguration: IDataConfigurationModel): DotSelection | null {
  const dots: DotSelection | null = svg
          ? select(svg).selectAll(`circle.${dataConfiguration.id}`)
          : null;
  console.log('found', dots?.size(), 'for', dataConfiguration.id);
  return dots;
}

// selects all `.graph-dot` or `.graph-dot-highlighted` elements
export function selectDots(svg: DotsElt, selectedOnly = false, dataConfiguration: IDataConfigurationModel):
    DotSelection | null {
  const innerSelector = `.${dataConfiguration.id}` + (selectedOnly ? ".graph-dot-highlighted" : ".graph-dot");
  return svg
          ? select(svg).selectAll(innerSelector)
          : null;
}
