import React from "react";
import { line, curveLinear, select } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLineModel } from "./connecting-line-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { DotsElt } from "../../d3-types";
import { useGraphModelContext } from "../../models/graph-model";
import { lightenColor } from "../../../../utilities/color-utils";
import { usePointLocations } from "../../hooks/use-point-locations";

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
  const dataConfiguration = useDataConfigurationContext();
  const { _pointColors } = useGraphModelContext();
  const plotsCt = dataConfiguration?.numberOfPlots || 1;
  const color = _pointColors[plotsCt - 1];
  const adjustedColor = lightenColor(color, 0.5);
  const foundLinePoints = usePointLocations();
  drawPath(dotsRef.current as DotsElt, foundLinePoints, adjustedColor);
  return null;
});
