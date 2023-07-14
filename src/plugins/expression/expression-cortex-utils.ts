import { ComputeEngine } from "@concord-consortium/compute-engine";

// ComputeEngine doesn't export its Expression type so we use some typescript
// manipulation to pull out the return value of ComputeEngine.latexSyntax.parse
type Expression = ReturnType<ComputeEngine["latexSyntax"]["parse"]>;

function isMissingString(mathJSON: Expression) {
  return (typeof mathJSON === "object" && "str" in mathJSON && mathJSON?.str === 'missing') ||
    mathJSON === 'missing' ||
    mathJSON === "'missing'";
}

function isMissingError(mathJSON: Expression) {
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

export function findMissingElements(mathJSON: Expression): Expression[] {
  if (isMissingError(mathJSON)) {
    return [mathJSON];
  }

  if (Array.isArray(mathJSON)) {
    let missingElements: Expression[] = [];
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

export function replaceMissingElements(latex: string, missingElements: Expression[]) {
  const missingIndexes = [];
  for (const item of missingElements) {
    if (typeof item === "object" && !Array.isArray(item) &&
      item.sourceOffsets?.length === 2 &&
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
    parts.push('\\placeholder{}');
    prevIndex = missingIndex;
  }
  // Add the last part
  parts.push(latex.slice(prevIndex));
  return parts.join('');
}
