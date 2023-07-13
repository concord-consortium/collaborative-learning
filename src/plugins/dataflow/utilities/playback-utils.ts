export function getRecentValuesForNode(node: any, dataSet: any, playbackIndex: number ){
  console.log("| lets calc recent values for node |",
    "\n          node:", node,
    "\n       dataSet:", dataSet,
    "\n playbackIndex:", playbackIndex
  );


  const randomDummyValues = Array.from({length: 10}, () => Math.floor(Math.random() * 10));
  return randomDummyValues;
}