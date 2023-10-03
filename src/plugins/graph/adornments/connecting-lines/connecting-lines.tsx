import { line, curveLinear, select } from "d3";
import { observer } from "mobx-react-lite";
import { IConnectingLinesModel } from "./connecting-lines-model";
import { DotsElt } from "../../d3-types";
import { IDotsRef } from "../../graph-types";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { usePointLocations } from "../../hooks/use-point-locations";

import { useGraphModelContext } from "../../models/graph-model";
import { lightenColor } from "../../../../utilities/color-utils";

interface IProps {
  model: IConnectingLinesModel
  subPlotKey: Record<string, string>
  dotsRef: IDotsRef
}

function drawPath(el: DotsElt, points: Iterable<[number, number]>, color: string) {
  // console.log("\t🏭 drawPath");

  // console.log("📁 connecting-lines.tsx ------------------------");
  const rightSide = el?.classList.contains("graph-2");
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

  if (rightSide){
    // console.log("📁connecting-lines.tsx-------------------------");
    // console.log("\t🏭drawPath");
    // console.log("\t🥩el:", el); //SVGElement
    // console.log("\t🥩points:", points);
    // console.log("\t🥩color:", color);
    // console.log("\t🔪dotArea:", dotArea); //D3 selection
    // console.log("\tanyFoundPath:", anyFoundPath);
  }
}

export const ConnectingLines = observer(function CoingLines({dotsRef}: IProps) {
  const rightSide = dotsRef.current?.classList.contains("graph-2") || false;
  const dataConfiguration = useDataConfigurationContext();
  const graphModel = useGraphModelContext();
  const { _pointColors } = useGraphModelContext();
  const plotsCt = dataConfiguration?.numberOfPlots || 1;
  const color = graphModel.pointColorAtIndex(plotsCt);
  const adjustedColor = lightenColor(color, 0.5);
  const foundLinePoints = usePointLocations(rightSide);

  if(rightSide){
    // console.log("📁connecting-lines.tsx-------------------------");
    // console.log("\t🏭<ConnectingLines>");

    // console.log("\t🥩props:dotsRef: ,", dotsRef);
    // console.log("\t🔪dataConfiguration: ,", dataConfiguration);
    // console.log("\t🔪foundLinePoints:", foundLinePoints);
    // console.log("\t🔪adjustedColor:", adjustedColor);
  }

  drawPath(dotsRef.current as DotsElt, foundLinePoints, adjustedColor);

  //test Drawing another line//-----------added--------------------------------------
  const testPoints = [[100, 100], [700, 150]] as Iterable<[number, number]>;
  // drawPath(dotsRef.current as DotsElt, testPoints, "#000000");
  //-----------added--------------------------------------

  return null;
});

