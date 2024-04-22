
export const kEmptyValueString = "__";

export function getNumDisplayStr(n: number | undefined ){
  return (n === undefined || isNaN(n)) ? kEmptyValueString : Number(n).toFixed(3).replace(/\.?0+$/, "");
}
