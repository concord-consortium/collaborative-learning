import { ICase, IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";

function getPriorCases(dataSet: IDataSet, playhead: number){
  const offset = 1;
  const maxValues = kMaxNodeValues + offset;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead + 1 : maxValues;
  return dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
}

export function calculatedRecentValues(dataSet: IDataSet, playbackIndex: number, attrId: string ){
  const vals: number[] = [];
  const priorCases = getPriorCases(dataSet, playbackIndex);
  priorCases.forEach((c: ICase | undefined) => {
    if (c) {
      const caseNodeValue = dataSet.getValue(c.__id__, attrId) as number;
      if (isFinite(caseNodeValue)) vals.push(caseNodeValue);
    }
  });
  return { "nodeValue": vals };
}
