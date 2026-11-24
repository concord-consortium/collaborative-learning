/**
 * The composite ids an annotation endpoint uses to name a thing inside a tile that has no id of
 * its own: a table cell, a graph dot. Both the client (which creates them) and the AI summarizer
 * (which reads them back out of a document's annotations) need the format, so it is defined here
 * rather than in either -- a regex copied into the summarizer is a second definition that nothing
 * keeps in step with this one.
 */

export function getCellId(caseId: string, attributeId: string) {
  return `cell:{${caseId}}:{${attributeId}}`;
}

const cellIdRegEx = /^cell:{(.+)}:{(.+)}$/;
export function decipherCellId(cellId: string) {
  const match = cellId.match(cellIdRegEx);
  if (match && match.length === 3) {
    const caseId = match[1];
    const attributeId = match[2];
    return { caseId, attributeId };
  }
  return {};
}

export function getDotId(caseId: string, xAttributeId: string, yAttributeId: string) {
  return `dot:{${caseId}}:{${xAttributeId}}:{${yAttributeId}}`;
}

const dotIdRegEx = /^dot:{(.+)}:{(.+)}:{(.+)}$/;
export function decipherDotId(dotId: string) {
  const match = dotId.match(dotIdRegEx);
  if (match && match.length === 4) {
    const caseId = match[1];
    const xAttributeId = match[2];
    const yAttributeId = match[3];
    return { caseId, xAttributeId, yAttributeId };
  }
  return {};
}
