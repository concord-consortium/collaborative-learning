import React from "react";
import { line, curveLinear, select, ScaleLinear, ScaleBand } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLineModel } from "./connecting-line-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { DotsElt } from "../../d3-types";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { useDataSetContext } from "../../imports/hooks/use-data-set-context";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";
import { useGraphModelContext } from "../../models/graph-model";
import { lightenColor } from "../../../../utilities/color-utils";

import "./connecting-line.scss";

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

export const ConnectingLine = observer(function ConnectingLine({dotsRef}: IProps) {
  // TODO: get this out to a hook?
  const dataConfiguration = useDataConfigurationContext();
  const layout = useGraphLayoutContext();
  const dataset = useDataSetContext();
  const { _pointColors } = useGraphModelContext();
  const numExtraPrimaryBands = dataConfiguration?.numRepetitionsForPlace('bottom') ?? 1;
  const numExtraSecondaryBands = dataConfiguration?.numRepetitionsForPlace('left') ?? 1;
  const yAttrIDs = dataConfiguration?.yAttributeIDs || [];
  const hasY2 = dataConfiguration?.hasY2Attribute;
  const v2Scale = layout.getAxisScale("rightNumeric") as ScaleNumericBaseType;
  const yScaleY = layout.getAxisScale("left") as ScaleNumericBaseType;
  const plotsCt = dataConfiguration?.numberOfPlots || 1;

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
      yScale = (hasY2 && plotNum === plotsCt - 1 ? v2Scale : yScaleY) as ScaleLinear<number, number>,
      rightSplitID = dataConfiguration?.attributeID('rightSplit') ?? '',
      rightCoordValue = dataset?.getStrValue(anID, rightSplitID) ?? '',
      rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>,
      rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue)) || 0);
    return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
  };

  const xSeries: number[] = [];
  const ySeries: number[] = [];

  caseIds?.forEach((caseId) => {
    xSeries.push(getScreenX(caseId));
    ySeries.push(getScreenY(caseId));
  });

  const color = _pointColors[plotsCt - 1];
  const adjustedColor = lightenColor(color, 0.5);

  const linePoints = xSeries.map((x, i) => [x, ySeries[i]]) as Iterable<[number, number]>;
  drawPath(dotsRef.current as DotsElt, linePoints, adjustedColor);

  return null;
});
