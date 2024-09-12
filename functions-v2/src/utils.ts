export function isArrayEqual(array1: string[] | undefined, array2: string[]) {
  return array1?.length === array2.length && array1.every((value, index) => value === array2[index]);
}
