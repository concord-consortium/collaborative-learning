import { kMaxNodeValues } from "../model/utilities/node";
import { getAttributeIdForNode } from "../model/utilities/recording-utilities";

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

export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number, nodeIndex: number ){ //idx from over there <--
  const attributeId = getAttributeIdForNode(dataSet, nodeIndex);
  console.log("PB 1: node: ", node.id, node.name, "-> ", attributeId);


  const priorCases = getPriorCases(playbackIndex, dataSet, playbackIndex);
  console.log("PB 2: prior cases: \n ", priorCases);

  const calculatedRecentValues: any[] = [];

  priorCases.forEach((c: any) => {
    console.log("   ....case:          ", c);
    console.log("   & node ", node.id, node.name, attributeId);
    const valueOfNodeInCase = dataSet.getValue(c.__id__, attributeId);
    calculatedRecentValues.push(valueOfNodeInCase);
  });

  // const nodeValues = priorCases.map((c: any) => {
  //   console.log("case node: ", node.id, node.name);
  //   console.log("Then, I use that attribute to get the particular value from the case", c);
  // });

  //const nv = nodeValues.reverse();

  const randomDummyValues = Array.from({length: 10}, () => Math.floor(Math.random() * 10));

  console.log("HEY whats the diff: ", calculatedRecentValues, " vs ", randomDummyValues);


  //return randomDummyValues;
  return calculatedRecentValues;
}
