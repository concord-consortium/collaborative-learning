import React from "react";
import { line, curveLinear, select, ScaleLinear, ScaleBand } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLineModel } from "./connecting-line-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { DotsElt } from "../../d3-types";

import "./connecting-line.scss";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { useGraphModelContext } from "../../models/graph-model";
import { useDataSetContext } from "../../imports/hooks/use-data-set-context";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";

interface IProps {
  model: IConnectingLineModel
  subPlotKey: Record<string, string>
  dotsRef: React.RefObject<SVGGElement>
}

function drawPath(el: DotsElt, points: Iterable<[number, number]>, color: string) {
  const curve = line().curve(curveLinear);
  const dotArea = select(el);
  const anyFoundPath = dotArea.selectAll("path");
  if (anyFoundPath) anyFoundPath.remove();
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



export const ConnectingLine = observer(function ConnectingLine({model, subPlotKey, dotsRef}: IProps) {
  // TODO: get this out to a hook?

  const dataConfiguration = useDataConfigurationContext();
  const layout = useGraphLayoutContext();
  const graphModel = useGraphModelContext();
  const dataset = useDataSetContext();
  const numExtraPrimaryBands = dataConfiguration?.numRepetitionsForPlace('bottom') ?? 1;
  const numExtraSecondaryBands = dataConfiguration?.numRepetitionsForPlace('left') ?? 1;
  const yAttrIDs = dataConfiguration?.yAttributeIDs || [];
  const hasY2Attribute = dataConfiguration?.hasY2Attribute;
  const v2Scale = layout.getAxisScale("rightNumeric") as ScaleNumericBaseType;
  const yScaleY = layout.getAxisScale("left") as ScaleNumericBaseType;
  const numberOfPlots = dataConfiguration?.numberOfPlots || 1;

  const caseIds = dataset?.cases.map(c => c.__id__);

  const getScreenX = (anID: string) => {
    const xAttrID = dataConfiguration?.attributeID('x') ?? '',
      xValue = dataset?.getNumeric(anID, xAttrID) ?? NaN,
      xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>,
      topSplitID = dataConfiguration?.attributeID('topSplit') ?? '',
      topCoordValue = dataset?.getStrValue(anID, topSplitID) ?? '',
      topScale = layout.getAxisScale('top') as ScaleBand<string>;
    return xScale(xValue) / numExtraPrimaryBands + (topScale(topCoordValue) || 0);
  };

  const getScreenY = (anID: string, plotNum = 0) => {
    const yAttrID = yAttrIDs[plotNum],
      yValue = dataset?.getNumeric(anID, yAttrID) ?? NaN,
      yScale = (hasY2Attribute && plotNum === numberOfPlots - 1 ? v2Scale : yScaleY) as
        ScaleLinear<number, number>,
      rightSplitID = dataConfiguration?.attributeID('rightSplit') ?? '',
      rightCoordValue = dataset?.getStrValue(anID, rightSplitID) ?? '',
      rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>,
      rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue)) || 0);
    return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
  };

  console.log("| ConnectingLine |",
    "\n model:      ", JSON.parse(JSON.stringify(model)),
    "\n dataConfig: ", JSON.parse(JSON.stringify(dataConfiguration)),
    "\n layout:     ", JSON.parse(JSON.stringify(layout)),
    "\n graphModel: ", JSON.parse(JSON.stringify(graphModel)),
    "\n dataset:    ", JSON.parse(JSON.stringify(dataset)),
    "\n caseIds:    ", JSON.parse(JSON.stringify(caseIds)),
    "\n\n",
  );

  const xSeries: number[] = [];
  const ySeries: number[] = [];

  caseIds?.forEach((anID, index) => {
    xSeries.push(getScreenX(anID));
    ySeries.push(getScreenY(anID));
  });

  console.log(">> xSeries: ", xSeries);
  console.log(">> ySeries: ", ySeries);
  console.log(">> \n\n");
  const linePoints = xSeries.map((x, i) => [x, ySeries[i]]) as Iterable<[number, number]>;


  console.log(">> dotsRef: ", dotsRef);
  drawPath(dotsRef.current as any, linePoints, "red");

  return (
    <g className="connecting-line"></g>
  );
});

/**
 * data configuration will have array of cases, and attr values
 * then will have to pull points from the graph
 * might be a good hook useDotPositions could gain the dot positions from the layout and data config
 * and then return an arrat of ordered pairs
 * it should be connecting-lines, not connecting-line
 */
