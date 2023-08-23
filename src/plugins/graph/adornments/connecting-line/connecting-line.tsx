import React from "react";
import { line, curveLinear, select } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLineModel } from "./connecting-line-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { DotsElt } from "../../d3-types";

import "./connecting-line.scss";

interface IProps {
  model: IConnectingLineModel
  subPlotKey: Record<string, string>
}

/**
 *  drawPath(dotsRef.current, linePoints, pointColor);
 *  linePoints looks like
 */

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

export const ConnectingLine = observer(function ConnectingLine({model}: IProps) {
  console.log("| ConnectingLine, got props?:", model);
  const dataConfig = useDataConfigurationContext();
  // const casesInPlot = dataConfig?.subPlotCases(subPlotKey)?.length ?? 0;
  // const classFromKey = model.classNameFromKey(subPlotKey);

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