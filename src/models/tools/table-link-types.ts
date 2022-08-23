export interface ITileLinkMetadata {
  id: string;
  title?: string
}

export interface ILinkProperties {
  // id: string;
  tileIds: string[];
}

export interface IRowLabel {
  id: string;
  label: string;
}

export interface ITableLinkProperties extends ILinkProperties {
  // labels should be included when adding/removing rows,
  // so that clients can synchronize any label changes
  labels?: IRowLabel[];
}

export function getRowLabelFromLinkProps(links: ITableLinkProperties, rowId: string) {
  const found = links.labels?.find(entry => entry.id === rowId);
  return found?.label;
}

export function getRowLabel(index: number, prefix = "p") {
  return `${prefix}${index + 1}`;
}

export const linkedPointId = (caseId: string, attrId: string) => `${caseId}:${attrId}`;
export const legacyLinkedPointId = (caseId: string) => caseId;
export const splitLinkedPointId = (id: string) => id.split(":");
