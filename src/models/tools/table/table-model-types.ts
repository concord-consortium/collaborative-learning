
export const kSerializedXKey = "__x__";

export interface ITileLinkMetadata {
  id: string;
  title?: string
}

export function isLinkableValue(value: number | string | null | undefined) {
  return value == null || Number.isNaN(value as any) || isFinite(Number(value));
}

export function canonicalizeValue(value: number | string | undefined) {
  if (value == null || value === "") return undefined;
  const num = Number(value);
  return isFinite(num) ? num : undefined;
}

export function getRowLabel(index: number, prefix = "p") {
  return `${prefix}${index + 1}`;
}

export const linkedPointId = (caseId: string, attrId: string) => `${caseId}:${attrId}`;
export const legacyLinkedPointId = (caseId: string) => caseId;
export const splitLinkedPointId = (id: string) => id.split(":");
