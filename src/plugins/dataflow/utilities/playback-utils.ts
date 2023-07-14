import { kMaxNodeValues } from "../model/utilities/node";
import { getAttributeIdForNode } from "../model/utilities/recording-utilities";

function getPriorCases(index: number, dataSet: any, playhead: number){
  // kMaxNodeValues determines how many datapoints are plotted each time
  const offset = 1;
  const maxValues = kMaxNodeValues + offset;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead : maxValues;

  const cases = dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
  return cases;
}

export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number, nodeIndex: number ){
  const attributeId = getAttributeIdForNode(dataSet, nodeIndex);
  const priorCases = getPriorCases(playbackIndex, dataSet, playbackIndex);
  const calculatedRecentValues: any[] = [];
  priorCases.forEach((c: any) => {
    const valueOfNodeInCase = dataSet.getValue(c.__id__, attributeId);
    calculatedRecentValues.push(valueOfNodeInCase);
  });
  return calculatedRecentValues;
}
