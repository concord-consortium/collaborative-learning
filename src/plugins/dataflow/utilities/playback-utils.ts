import { kMaxNodeValues } from "../model/utilities/node";

function getPriorCases(index: number, dataSet: any, playhead: number){
  // if we have less than 17 cases our region begins at 0
  const offSet = 1; // I'm 99% sure we need this but math is hard
  const maxValues = kMaxNodeValues + offSet;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;

  console.log("PB: 1 get the cases from ", regionStart, " to ", playhead);

  // const fetchUs = [];
  // for (let i = regionStart; i < playhead; i++) {
  //   fetchUs.push(i);
  // }

  //console.log("PB: 2 which are indices: fetchUs:", fetchUs);

  // thought we needed the playhead here but I think we just need the regionStart
  //const cases = dataSet.getCasesAtIndices(regionStart, playhead);

  const numberOfCasesToGet = playhead < maxValues ? playhead : maxValues;

  const cases = dataSet.getCasesAtIndices(regionStart, numberOfCasesToGet);
  return cases;
}

export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number ){

  const priorCases = getPriorCases(playbackIndex, dataSet, playbackIndex);

  console.log("PB: 2 and now we have our priorCases:", priorCases, "\n");
  console.log("\n");

  const randomDummyValues = Array.from({length: 10}, () => Math.floor(Math.random() * 10));
  return randomDummyValues;
}
