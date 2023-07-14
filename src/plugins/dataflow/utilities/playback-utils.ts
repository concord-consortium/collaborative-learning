import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { getAttributeIdForNode } from "../model/utilities/recording-utilities";

function getPriorCases(dataSet: IDataSet, playhead: number){
  // kMaxNodeValues determines how many datapoints are plotted each time
  const offset = 1;
  const maxValues = kMaxNodeValues + offset;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead : maxValues;
  return dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
}

export function getRecentValuesForNode(dataSet: IDataSet, playbackIndex: number, attrId: string ){
  const priorCases = getPriorCases(dataSet, playbackIndex);
  const calculatedRecentValues: number[] = [];
  priorCases.forEach((c: any) => {
    const caseNodeValue = dataSet.getValue(c.__id__, attrId) as number;
    if (isFinite(caseNodeValue)) calculatedRecentValues.push(caseNodeValue);
  });
  return calculatedRecentValues;
}

