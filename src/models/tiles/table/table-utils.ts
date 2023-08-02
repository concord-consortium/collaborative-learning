const caseIdPrefix = "caseId:";
const attributeIdPrefix = "-attributeId:";

export function getCellId(caseId: string, attributeId: string) {
  return `${caseIdPrefix}${caseId}${attributeIdPrefix}${attributeId}`;
}

function isCellId(id: string) {
  return id.startsWith(caseIdPrefix) && id.includes(attributeIdPrefix);
}

export function decipherCellId(cellId: string) {
  if (!isCellId(cellId)) return {};
  
  const [casePart, attributeId] = cellId.split(attributeIdPrefix);
  const [, caseId] = casePart.split(caseIdPrefix);
  return { caseId, attributeId };
}
