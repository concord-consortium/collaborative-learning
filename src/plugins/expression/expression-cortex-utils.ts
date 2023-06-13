// FIXME: should use Expression from ComputeEngine, to get rid of the `any`s
// however it isn't exported. It is exported from "math-json", but I'm not sure
// how to import that. I also think math-json bundles everything instead of
// sharing with compute-engine so using both might cause problems
// Could hack this by creating a type based on the return type of
// `computeEngine.latexSyntax.parse`
function isMissingString(mathJSON: any) {
  return mathJSON?.str === 'missing' ||
    mathJSON === 'missing' ||
    mathJSON === "'missing'";
}

function isMissingError(mathJSON: any) {
  if (Array.isArray(mathJSON) &&
    mathJSON.length > 1 &&
    mathJSON[0] === 'Error' &&
    isMissingString(mathJSON[1])) {
    return true;
  }

  if (typeof mathJSON === 'object' &&
    "fn" in mathJSON &&
    mathJSON.fn.length === 3 &&
    mathJSON.fn[0] === 'Error' &&
    isMissingString(mathJSON.fn[1])) {
    return true;
  }

  return false;
}

export function findMissingElements(mathJSON: any): any[] {
  if (isMissingError(mathJSON)) {
    return [mathJSON];
  }

  if (Array.isArray(mathJSON)) {
    let missingElements: any[] = [];
    for (const item of mathJSON) {
      missingElements = [...missingElements, ...findMissingElements(item)];
    }
    return missingElements;
  }
  if (typeof mathJSON === 'object' && "fn" in mathJSON) {
    return findMissingElements(mathJSON.fn);
  }
  return [];
}

export function replaceMissingElements(latex: string, missingElements: any[]) {
  const missingIndexes = [];
  for (const item of missingElements) {
    if (item?.sourceOffsets?.length === 2 &&
      item.sourceOffsets[0] === item.sourceOffsets[1]) {
      missingIndexes.push(item.sourceOffsets[0]);
    }
  }

  // Sort the items numerically. By default sort converts values
  // to strings and sorts the strings which puts 10 before 2.
  missingIndexes.sort((a, b) => a - b);

  // string parts
  const parts: string[] = [];
  let prevIndex = 0;
  for (const missingIndex of missingIndexes) {
    parts.push(latex.slice(prevIndex, missingIndex));
    parts.push('\\error{\\placeholder{}}');
    prevIndex = missingIndex;
  }
  // Add the last part
  parts.push(latex.slice(prevIndex));
  return parts.join('');
}
