const cellIdRegEx = /^cell:{(.+)}:{(.+)}$/;

export function getCellId(caseId: string, attributeId: string) {
  return `cell:{${caseId}}:{${attributeId}}`;
}

export function decipherCellId(cellId: string) {
  const match = cellId.match(cellIdRegEx);
  if (match && match.length === 3) {
    const caseId = match[1];
    const attributeId = match[2];
    return { caseId, attributeId };
  }
  return {};
}
