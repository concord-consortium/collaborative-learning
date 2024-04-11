export const kEmptyValueString = "__";

export function getNumDisplayStr(n: number){
  return isNaN(n) ? kEmptyValueString : Number(n).toFixed(3).replace(/\.?0+$/, "");
}
