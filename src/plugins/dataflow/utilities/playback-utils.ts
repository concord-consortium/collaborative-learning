

function getPriorCases(index: number, dataSet: any, playhead: number){
  // if we have less than 17 cases our region begins at 0
  const pastCalc = playhead - 17;
  const regionStart = playhead - 17 < 0 ? 0 : pastCalc;

  console.log("OK:, ",
      // "   startI: ", regionStart,
      // "   endI: ", playhead,
      "get the cases from ", regionStart, " to ", playhead
  );

  // const priorCases = [];
  // for (let i = index; i > 17; i--){
  //   const casee = dataSet.getCaseAtIndex(i);
  //   priorCases.push(casee);
  // }
  // //console.log("priorCases:", priorCases);
  // return priorCases.slice(0, 10);
}

export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number ){
  // console.log("||| lets calc recent values for node |",
  //   "\n        node:",          node,
  //   "\n       dataSet:",        dataSet,
  //   "\n       playbackIndex:",  playbackIndex
  // );

  // const attributeValuesInDataSet = dataSet.attributeValues;
  // console.log("||| attributeValuesInDataSet:", attributeValuesInDataSet);

  // const currentCase = dataSet.getCaseAtIndex(playbackIndex);
  // const {__id__} = currentCase;
  const priorCases = getPriorCases(playbackIndex, dataSet, playbackIndex);

  //console.log("\nzz priorCases:", priorCases);

  const randomDummyValues = Array.from({length: 10}, () => Math.floor(Math.random() * 10));
  return randomDummyValues;
}