
export const kEmptyValueString = "__";

export function getNumDisplayStr(n: number | undefined ){
  return (n === undefined || isNaN(n)) ? kEmptyValueString : Number(n).toFixed(3).replace(/\.?0+$/, "");
}

export function getNodeLetter(nodeType: string) {
  switch (nodeType) {
    case "Timer":
      return "t";
    case "Sensor":
      return "I"; // internally is "Sensor", but user now sees "Input"
    default:
      return nodeType.substring(0, 1);
  }
}
