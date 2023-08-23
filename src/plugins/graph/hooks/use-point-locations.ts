import {useEffect} from "react";
import {IDotsRef} from "../graph-types";
import {IGraphModel} from "../models/graph-model";

export interface IUsePointLocationsProps {
  graphModel?: IGraphModel,
  dotsRef: IDotsRef
}

// const getScreenX = (anID: string) => {
//   const xAttrID = dataConfiguration?.attributeID('x') ?? '',
//     xValue = dataset?.getNumeric(anID, xAttrID) ?? NaN,
//     xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>,
//     topSplitID = dataConfiguration?.attributeID('topSplit') ?? '',
//     topCoordValue = dataset?.getStrValue(anID, topSplitID) ?? '',
//     topScale = layout.getAxisScale('top') as ScaleBand<string>;
//   return xScale(xValue) / numExtraPrimaryBands + (topScale(topCoordValue) || 0);
// };

// const getScreenY = (anID: string, plotNum = 0) => {
//   const yAttrID = yAttrIDs[plotNum],
//     yValue = dataset?.getNumeric(anID, yAttrID) ?? NaN,
//     yScale = (hasY2Attribute && plotNum === numberOfPlots - 1 ? v2Scale : yScaleRef.current) as
//       ScaleLinear<number, number>,
//     rightSplitID = dataConfiguration?.attributeID('rightSplit') ?? '',
//     rightCoordValue = dataset?.getStrValue(anID, rightSplitID) ?? '',
//     rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>,
//     rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue)) || 0);
//   return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
// };

export const usePointLocations = ({graphModel, dotsRef}: IUsePointLocationsProps) => {
  useEffect(() => {
    console.log("usePointLocations - can I get points from this: ", graphModel, dotsRef);
  }, [graphModel, dotsRef]);
};
