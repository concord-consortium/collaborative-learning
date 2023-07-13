import { kMaxNodeValues } from "../model/utilities/node";

function getPriorCases(index: number, dataSet: any, playhead: number){
  // kMaxNodeValues determines how many datapoints are plotted each time
  const offSet = 1;
  const maxValues = kMaxNodeValues + offSet;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead : maxValues;

  const cases = dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
  return cases;
}

export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number ){

  const priorCases = getPriorCases(playbackIndex, dataSet, playbackIndex);
  console.log("priorCases", priorCases);

  const nodeValues = priorCases.map((c: any) => {
    console.log("I need the attribute id for the node: ", node);
    console.log("Then, I use that attribute to get the particular value from the case", c);
  });

  const nv = nodeValues.reverse();


  const randomDummyValues = Array.from({length: 10}, () => Math.floor(Math.random() * 10));
  return randomDummyValues;
}
