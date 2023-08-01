const caseIdPrefix = "caseId:";
const attributeIdPrefix = "-attributeId:";

export function getCellId(caseId: string, attributeId: string) {
  return `${caseIdPrefix}${caseId}${attributeIdPrefix}${attributeId}`;
}

export function decipherCellId(cellId: string) {
  const caseId = "";
}
