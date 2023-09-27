import { IAnyStateTreeNode } from "mobx-state-tree";
import { GeometryContentModelType } from "./geometry/geometry-content";
import { kGeometryTileType } from "./geometry/geometry-types";
import { kTableTileType, TableContentModelType } from "./table/table-content";
import { getRowLabel, ILinkProperties, IRowLabel, ITableLinkProperties } from "./table-link-types";
import { IDataSet } from "../data/data-set";
import { getTileContentById } from "../../utilities/mst-utils";

// cf. https://mattferderer.com/use-sass-variables-in-typescript-and-javascript
import styles from "./table-links.scss";

export const kLabelAttrName = "__label__";

export function getAxisLabelsFromDataSet(dataSet: IDataSet): [string | undefined, string | undefined] {
  // label for x axis
  const xAttr = dataSet.attributes.length > 0 ? dataSet.attributes[0] : undefined;
  const xLabel = xAttr?.name;

  // label for y axis
  let yLabel = undefined;
  for (let yIndex = 1; yIndex < dataSet.attributes.length; ++yIndex) {
    // concatenate column names for y axis label
    const yAttr = dataSet.attributes[yIndex];
    if (yAttr.name && (yAttr.name !== kLabelAttrName)) {
      if (!yLabel) yLabel = yAttr.name;
      else yLabel += `, ${yAttr.name}`;
    }
  }
  return [xLabel, yLabel];
}

// map from tableId to documentId
const sTableDocumentMap: Map<string, string> = new Map();

export function getTableDocument(tableId: string) {
  return sTableDocumentMap.get(tableId);
}

export function addTableToDocumentMap(documentId: string, tableId: string) {
  sTableDocumentMap.set(tableId, documentId);
}

export function removeTableFromDocumentMap(tableId: string) {
  sTableDocumentMap.delete(tableId);
}

// FIXME: this should use the shared datasets to figure out the correct
// color. Since datasets can be provided by different tiles these colors
// should not be specific to tables. Look for `link-color-` in the style
// sheets.
export function getTableLinkColors(tableId?: string) {
  const colors = [
          { fill: styles.linkColor0Light, stroke: styles.linkColor0Dark },
          { fill: styles.linkColor1Light, stroke: styles.linkColor1Dark },
          { fill: styles.linkColor2Light, stroke: styles.linkColor2Dark },
          { fill: styles.linkColor3Light, stroke: styles.linkColor3Dark },
          { fill: styles.linkColor4Light, stroke: styles.linkColor4Dark },
          { fill: styles.linkColor5Light, stroke: styles.linkColor5Dark }
        ];
  const linkIndex = 0;
  return linkIndex >= 0
          ? colors[linkIndex % colors.length]
          : undefined;
}

export function isLinkableTable(client: IAnyStateTreeNode, tableId: string) {
  const content = getTileContentById(client, tableId);
  return content?.type === kTableTileType;
}

export function getTableContent(requester: IAnyStateTreeNode, tableId: string) {
  const content = getTileContentById(requester, tableId);
  return content?.type === kTableTileType ? content as TableContentModelType : undefined;
}

export function getGeometryContent(requester: IAnyStateTreeNode, geometryId: string) {
  const content = getTileContentById(requester, geometryId);
  return content?.type === kGeometryTileType ? content as GeometryContentModelType : undefined;
}

/*
  * Returns link metadata for attaching to client (e.g. geometry) tool actions
  * that includes label information.
  */
export function getTableClientLinks(requester: IAnyStateTreeNode, tableId: string): ITableLinkProperties {
  const labels: IRowLabel[] = [];
  const content = getTileContentById(requester, tableId);
  const tableContent = content && content as TableContentModelType;
  if (!tableContent) return { tileIds: [], labels };

  const dataSet = tableContent.dataSet;

  // add axis labels
  const [xAxisLabel, yAxisLabel] = getAxisLabelsFromDataSet(dataSet);
  xAxisLabel && labels.push({ id: "xAxis", label: xAxisLabel });
  yAxisLabel && labels.push({ id: "yAxis", label: yAxisLabel });

  // add label for each case, indexed by case ID
  labels.push(...dataSet.cases.map((aCase, i) => ({ id: aCase.__id__, label: getRowLabel(i) })));

  return { tileIds: [tableContent.metadata.id], labels };
}

/*
  * Returns link metadata for attaching to client (e.g. table) tool actions.
  */
export function getGeometryClientLinks(requester: IAnyStateTreeNode, geometryId: string): ILinkProperties {
  return { tileIds: [geometryId] };
}

export function syncTableChangeToLinkedClient(tableContent: TableContentModelType, clientTileId: string) {
  // eventually we'll presumably need to support other clients
  const clientContent = getTileContentById(tableContent, clientTileId);
  const geometryContent = clientContent && clientContent as GeometryContentModelType;
  // link information attached to individual client changes/actions
  const clientActionLinks = getTableClientLinks(tableContent, tableContent.metadata.id);
  // synchronize the table change to the linked client
  geometryContent?.syncLinkedChange(tableContent.dataSet, clientActionLinks);
}
