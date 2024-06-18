
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

/**
 * Return nodeValue[0] unless nodeValue is invalid.
 * nodeValue is invalid if it is undefined, or if
 * nodeValue[0] is null, undefined or NaN.
 *
 * @param nodeValue
 * @returns
 */
export function getValueOrZero(nodeValue?: (number | null | undefined)[]) {
  if (!nodeValue || nodeValue[0] == null || isNaN(nodeValue[0])) {
    return 0;
  }
  return nodeValue[0];
}
