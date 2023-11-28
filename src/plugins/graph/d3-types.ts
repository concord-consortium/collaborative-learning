import { select, Selection } from "d3";
import { IDataConfigurationModel } from "./models/data-configuration-model";
import { IGraphModel } from "./models/graph-model";

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

// selects all all g elements, which contain inner and outer circles, for a DataConfiguration
export function selectGraphDots(svg: DotsElt, dataConfiguration: IDataConfigurationModel): DotSelection | null {
  return svg
          ? select(svg).selectAll(`g.graph-dot.${dataConfiguration.id}`)
          : null;
}

export function selectOuterCircles(svg: DotsElt, dataConfiguration: IDataConfigurationModel): DotSelection | null {
  return svg
          ? select(svg).selectAll(`g.graph-dot.${dataConfiguration.id} .outer-circle`)
          : null;
}

export function selectOuterCirclesSelected(svg: DotsElt,
    dataConfiguration: IDataConfigurationModel): DotSelection | null {
  return svg
          ? select(svg).selectAll(`g.graph-dot.${dataConfiguration.id} .outer-circle.selected`)
          : null;
}


export function selectInnerCircles(svg: DotsElt, dataConfiguration: IDataConfigurationModel): DotSelection | null {
  return svg
          ? select(svg).selectAll(`g.graph-dot.${dataConfiguration.id} .inner-circle`)
          : null;
}

// selects all `circle` elements that match NO data configuration in the given graph
export function selectOrphanCircles(svg: DotsElt, graphModel: IGraphModel): DotSelection | null {
  const configIds = graphModel.layers.map(layer => layer.config.id );
  const circles: DotSelection | null = svg ? select(svg).selectAll('g.graph-dot') : null;
  const selection: DotSelection | null = circles
    ? circles.filter((datum) => { return !configIds.includes((datum as CaseData).dataConfigID); })
    : null;
  console.log('Orphan circles:', selection);
  return selection;
}
