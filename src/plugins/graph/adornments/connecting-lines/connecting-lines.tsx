import { line, curveLinear, select } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLinesModel } from "./connecting-lines-model";
import { DotsElt } from "../../d3-types";
import { IDotsRef } from "../../graph-types";
import { isNumericAxisModel } from "../../imports/components/axis/models/axis-model";
import { usePointLocations } from "../../hooks/use-point-locations";

import { useGraphModelContext } from "../../models/graph-model";

import { lightenColor } from "../../../../utilities/color-utils";

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
interface IConnectLines {
  model: IConnectingLinesModel
  subPlotKey: Record<string, string>
  dotsRef: IDotsRef
}

export const ConnectingLines = observer(function ConnectingLines({dotsRef}: IConnectLines) {
  const graphModel = useGraphModelContext();
  const foundLinePoints = usePointLocations();
  // access the axis domains so that a render will be triggered when they change
  const xAxis = graphModel.getAxis("bottom");
  const xDomain = isNumericAxisModel(xAxis) ? xAxis.domain : undefined;
  const yAxis = graphModel.getAxis("left");
  const yDomain = isNumericAxisModel(yAxis) ? yAxis.domain : undefined;
  const domains = { xDomain, yDomain }; // eslint-disable-line unused-imports/no-unused-vars

  // TODO: these are essentially side effects which should be handled in a MobX reaction
  // installed by a useEffect() (which should also improve the render lag currently present).
  cleanUpPaths(dotsRef.current);
  //first clean up paths then render each line
  foundLinePoints.forEach((singleLinePoints, idx) => {
    const color = graphModel.pointColorAtIndex(idx);
    const adjustedColor = lightenColor(color, 0.5);
    drawPath(dotsRef.current as DotsElt, singleLinePoints, adjustedColor);
  });
  return null;
});
