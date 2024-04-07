import { useEffect } from "react";
import { line, curveLinear, select } from "d3";
import { IConnectingLinesModel } from "./connecting-lines-model";
import { DotsElt } from "../../d3-types";
import { IDotsRef } from "../../graph-types";
import { isNumericAxisModel } from "../../imports/components/axis/models/axis-model";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { lightenColor } from "../../../../utilities/color-utils";
import { mstAutorun } from "../../../../utilities/mst-autorun";
import { IGraphModel } from "../../models/graph-model";
import { GraphLayout, useGraphLayoutContext } from "../../models/graph-layout";

function cleanUpPaths(el: DotsElt){
  const dotArea = select(el);
  const anyFoundPath = dotArea.selectAll("path");
  if (anyFoundPath) anyFoundPath.remove();
}

function drawPath(el: DotsElt, points: Iterable<[number, number]>, color: string) {
  const curve = line().curve(curveLinear);
  const dotArea = select(el);
  const newPath = dotArea.append("path");
  newPath
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .attr('d', curve(points))
    .attr('fill', 'none');
  // bring path group to the top/front within the svg
  const parentSvg = newPath.node()?.parentNode;
  parentSvg?.insertBefore(newPath.node() as Node, parentSvg.firstChild);
}

export const getPointLocations = (graphModel: IGraphModel, layout: GraphLayout) => {
  const result: Record<string, Iterable<[number, number]>> = {};
  // Outer loop over layer
  for (const layer of graphModel.layers) {
    const dataConfig = layer.config;
    if (dataConfig.attributeType("x") !== "numeric") continue; // Never connect categorical points
    const dataset = dataConfig.dataset;
    if (dataConfig && dataset && layout) {
      const caseIds = dataset.cases.map(c => c.__id__) ?? [];
      const xAttrID = dataConfig.xAttributeID;
      // Loop over plotNum (which series in the layer)
      for (let plotNum = 0; plotNum < dataConfig.yAttributeDescriptions.length; ++plotNum) {
        const yAttrID = dataConfig.yAttributeID(plotNum);
        if (dataConfig.attributeTypeForID(yAttrID) !== "numeric") continue; // categorical
        const series: [number, number][] = [];
        // Inner loop over cases in that series
        caseIds.forEach((caseId) => {
          const xValue = dataset.getNumeric(caseId, xAttrID);
          const yValue = dataset.getNumeric(caseId, yAttrID);
          if (xValue!==undefined && yValue!==undefined) {
            const xLoc = layout.getAxisMultiScale("bottom").getScreenCoordinate({ cell: 0, data: xValue });
            const yLoc = layout.getAxisMultiScale("left").getScreenCoordinate({ cell: 0, data: yValue });
            if (isFinite(xLoc) && isFinite(yLoc)) {
              series.push([xLoc, yLoc]);
            }
          }
        });
        result[yAttrID] = series;
      }
    }
  }
  return result;
};

interface IConnectLines {
  model: IConnectingLinesModel
  subPlotKey: Record<string, string>
  dotsRef: IDotsRef
}

export const ConnectingLines = function ConnectingLines({dotsRef}: IConnectLines) {
  const graphModel = useGraphModelContext();
  const layout = useGraphLayoutContext();

  useEffect(() => {

    mstAutorun(() => {
      const foundLinePoints = getPointLocations(graphModel, layout);
      // access the axis domains so that a render will be triggered when they change
      const xAxis = graphModel.getAxis("bottom");
      const xDomain = isNumericAxisModel(xAxis) ? xAxis.domain : undefined;
      const yAxis = graphModel.getAxis("left");
      const yDomain = isNumericAxisModel(yAxis) ? yAxis.domain : undefined;
      const domains = { xDomain, yDomain }; // eslint-disable-line unused-imports/no-unused-vars

      cleanUpPaths(dotsRef.current);
      //first clean up paths then render each line
      Object.keys(foundLinePoints).forEach(attributeId => {
        const singleLinePoints = foundLinePoints[attributeId];
        const color = graphModel.getColorForId(attributeId);
        const adjustedColor = lightenColor(color, 0.5);
        drawPath(dotsRef.current as DotsElt, singleLinePoints, adjustedColor);
      });
    },
    { name: "ConnectingLines" },
    graphModel);
  }, [dotsRef, graphModel, layout]);

  return null;
};
