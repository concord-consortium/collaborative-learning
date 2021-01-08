import { Parser } from "expr-eval";
import { castArray, each } from "lodash";
import { types, Instance, SnapshotOut, IAnyStateTreeNode } from "mobx-state-tree";
import { getRowLabel, kSerializedXKey, canonicalizeValue, isLinkableValue } from "./table-model-types";
import { registerToolContentInfo } from "../tool-content-info";
import { addLinkedTable } from "../table-links";
import { IDataSet, ICaseCreation, ICase, DataSet } from "../../data/data-set";
import { canonicalizeExpression } from "../../../components/tools/table-tool/expression-utils";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { getGeometryContent } from "../geometry/geometry-content";
import { JXGChange } from "../geometry/jxg-changes";
import { getTileContentById } from "../../../utilities/mst-utils";
import { Logger, LogEventName } from "../../../lib/logger";

export const kTableToolID = "Table";
export const kCaseIdName = "__id__";
export const kLabelAttrName = "__label__";

export const kTableDefaultHeight = 160;

export function defaultTableContent() {
  return TableContentModel.create({
                            type: "Table",
                            columns: [
                              { name: "x" },
                              { name: "y" }
                            ]
                          } as any);
}

export function getTableContent(target: IAnyStateTreeNode, tileId: string): TableContentModelType | undefined {
  const content = getTileContentById(target, tileId);
  return content && content as TableContentModelType;
}

export interface ITransferCase {
  id: string;
  label?: string;
  x: number;
  y: number;
}

export interface IRowLabel {
  id: string;
  label: string;
}

export interface IColumnProperties {
  name?: string;
  expression?: string;
  rawExpression?: string;
}

export interface ILinkProperties {
  id: string;
  tileIds: string[];
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

export interface ICreateColumnsProperties {
  columns?: IColumnProperties[];
}

export type IUpdateColumnsProperties = IColumnProperties | IColumnProperties[];

export interface IUpdateTableProperties {
  name?: string;
}
export interface ICreateTableProperties extends IUpdateTableProperties, ICreateColumnsProperties {
}

export type IRowProperties = Record<string, string | number | null | undefined>;

export interface ICreateRowsProperties {
  rows: IRowProperties[];
  beforeId?: string | string[];
}

export type IUpdateRowsProperties = IRowProperties | IRowProperties[];

export type ITableChangeProperties = ICreateTableProperties | IUpdateTableProperties |
                                      ICreateColumnsProperties | IUpdateColumnsProperties |
                                      ICreateRowsProperties | IUpdateRowsProperties;

export interface ITableChange {
  action: "create" | "update" | "delete";
  target: "table" | "rows" | "columns" | "geometryLink";
  ids?: string | string[];
  props?: ITableChangeProperties;
  links?: ILinkProperties;
}

export const TableMetadataModel = types
  .model("TableMetadata", {
    id: types.string,
    linkedGeometries: types.array(types.string),
    expressions: types.map(types.string),
    rawExpressions: types.map(types.string)
  })
  .views(self => ({
    get isLinked() {
      return self.linkedGeometries.length > 0;
    },
    get linkCount() {
      return self.linkedGeometries.length;
    },
    get hasExpressions() {
      return Array.from(self.expressions.values()).some(expr => !!expr);
    },
    hasExpression(attrId: string) {
      return !!self.expressions.get(attrId);
    }
  }))
  .actions(self => ({
    addLinkedGeometry(id: string) {
      if (self.linkedGeometries.indexOf(id) < 0) {
        self.linkedGeometries.push(id);
      }
      addLinkedTable(self.id);
    },
    removeLinkedGeometry(id: string) {
      const index = self.linkedGeometries.indexOf(id);
      if (index >= 0) {
        self.linkedGeometries.splice(index, 1);
      }
    },
    clearLinkedGeometries() {
      self.linkedGeometries.clear();
    },
    setExpression(colId: string, expression: string) {
      self.expressions.set(colId, expression);
    },
    setRawExpression(colId: string, rawExpression: string) {
      self.rawExpressions.set(colId, rawExpression);
    },
    clearRawExpressions(varName: string) {
      const parser = new Parser();
      self.expressions.forEach((expression, colId) => {
        if (expression) {
          const parsedExpression = parser.parse(expression);
          if (parsedExpression.variables().indexOf(varName) > -1) {
            self.rawExpressions.delete(colId);
          }
        }
      });
    }
  }));
export type TableMetadataModelType = Instance<typeof TableMetadataModel>;

export const TableContentModel = types
  .model("TableContent", {
    type: types.optional(types.literal(kTableToolID), kTableToolID),
    isImported: false,
    changes: types.array(types.string)
  })
  .volatile(self => ({
    metadata: undefined as any as TableMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    const s = snapshot as any;
    // handle import format
    if (s?.columns) {
      return { isImported: true, changes: convertImportToChanges(s) };
    }
    // handle early change formats
    if (s?.changes?.length) {
      const { changes, ...snapOthers } = s;
      const parsedChanges = changes.map((change: string) => safeJsonParse(change));
      const isConversionRequired = parsedChanges.some((c: any) => {
              return c &&
                    ((c.action === "create") && (c.target === "columns") && !c.props.columns) ||
                    ((c.action === "create") && (c.target === "rows") && !c.props.rows);
            });
      if (!isConversionRequired) return snapshot;

      const newChanges: ITableChange[] = parsedChanges.map((c: any) => {
              if (c && (c.action === "create") && (c.target === "columns") && !c.props.columns) {
                const { props, ...others } = c;
                return { props: { columns: props }, ...others };
              }
              if (c && (c.action === "create") && (c.target === "rows") && !c.props.rows) {
                const { props, ...others } = c;
                return { props: { rows: props }, ...others };
              }
              return c;
            });
      const newStringChanges = newChanges.map(change => JSON.stringify(change));
      return { changes: newStringChanges, ...snapOthers };
    }
    return snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get isLinked() {
      return self.metadata.linkedGeometries.length > 0;
    },
    get hasExpressions() {
      return self.metadata.hasExpressions;
    }
  }))
  .views(self => ({
    /*
     * Returns link metadata for attaching to client (e.g. geometry) tool actions
     * that includes label information.
     */
    getClientLinks(linkId: string, dataSet: IDataSet): ITableLinkProperties {
      const labels: IRowLabel[] = [];

      // add label for x axis
      const xAttr = dataSet.attributes.length > 0 ? dataSet.attributes[0] : undefined;
      xAttr && labels.push({ id: "xAxis", label: xAttr.name });

      // add label for y axis
      let yLabel = "";
      for (let yIndex = 1; yIndex < dataSet.attributes.length; ++yIndex) {
        // concatenate column names for y axis label
        const yAttr = dataSet.attributes[yIndex];
        if (yAttr.name) {
          if (!yLabel) yLabel = yAttr.name;
          else yLabel += `, ${yAttr.name}`;
        }
      }
      yLabel && labels.push({ id: "yAxis", label: yLabel });

      // add label for each case, indexed by case ID
      labels.push(...dataSet.cases.map((aCase, i) => ({ id: aCase.__id__, label: getRowLabel(i) })));

      return { id: linkId, tileIds: [self.metadata.id], labels };
    },
    canUndo() {
      return false;
      // const hasUndoableChanges = self.changes.length > 1;
      // if (!hasUndoableChanges) return false;
      // const lastChange = hasUndoableChanges ? self.changes[self.changes.length - 1] : undefined;
      // const lastChangeParsed: ITableChange = lastChange && safeJsonParse(lastChange);
      // const lastChangeLinks = lastChangeParsed && lastChangeParsed.links;
      // if (!lastChangeLinks) return true;
      // const linkedTiles = lastChangeLinks ? lastChangeLinks.tileIds : undefined;
      // const linkedTile = linkedTiles && linkedTiles[0];
      // const tableContent = linkedTile ? self.getGeometryContent(linkedTile) : undefined;
      // return tableContent ? tableContent.canUndoLinkedChange(lastChangeParsed) : false;
    },
    canUndoLinkedChange(change: JXGChange) {
      return false;
      // const hasUndoableChanges = self.changes.length > 1;
      // if (!hasUndoableChanges) return false;
      // const lastChange = hasUndoableChanges ? self.changes[self.changes.length - 1] : undefined;
      // const lastChangeParsed = lastChange && safeJsonParse(lastChange);
      // const lastChangeLinks = lastChangeParsed && lastChangeParsed.links;
      // if (!lastChangeLinks) return false;
      // const tableActionLinkId = lastChangeLinks && lastChangeLinks.id;
      // const geometryActionLinkId = change.links && change.links.id;
      // return tableActionLinkId && geometryActionLinkId && (tableActionLinkId === geometryActionLinkId);
    }
  }))
  .actions(self => ({
    doPostCreate(metadata: TableMetadataModelType) {
      self.metadata = metadata;
    },
    willRemoveFromDocument() {
      self.metadata.linkedGeometries.forEach(geometryId => {
        const geometryContent = getGeometryContent(self, geometryId);
        geometryContent?.removeTableLink(undefined, self.metadata.id);
      });
      self.metadata.clearLinkedGeometries();
    },
    appendChange(change: ITableChange) {
      self.changes.push(JSON.stringify(change));

      const toolId = self.metadata?.id || "";
      Logger.logToolChange(LogEventName.TABLE_TOOL_CHANGE, change.action, change, toolId);
    }
  }))
  .actions(self => ({
    setTableName(name: string) {
      self.appendChange({
              action: "update",
              target: "table",
              props: { name }
            });
    },
    addAttribute(id: string, name: string, links?: ILinkProperties) {
      self.appendChange({
            action: "create",
            target: "columns",
            ids: [id],
            props: { columns: [{ name }] },
            links
          });
    },
    setAttributeName(id: string, name: string, links?: ILinkProperties) {
      self.appendChange({
              action: "update",
              target: "columns",
              ids: id,
              props: { name },
              links
            });
    },
    removeAttributes(ids: string[], links?: ILinkProperties) {
      self.appendChange({
              action: "delete",
              target: "columns",
              ids,
              links
            });
    },
    setExpression(id: string, expression: string, rawExpression: string, links?: ILinkProperties) {
      self.appendChange({
        action: "update",
        target: "columns",
        ids: id,
        props: { expression, rawExpression },
        links
      });
    },
    setExpressions(rawExpressions: Map<string, string>, xName: string, links?: ILinkProperties) {
      self.appendChange({
        action: "update",
        target: "columns",
        ids: Array.from(rawExpressions.keys()),
        props: Array.from(rawExpressions.values())
                    .map(rawExpr => ({
                      expression: canonicalizeExpression(rawExpr, xName),
                      rawExpression: rawExpr
                    })),
        links
      });
    },
    addCanonicalCases(cases: ICaseCreation[], beforeID?: string | string[], links?: ILinkProperties) {
      self.appendChange({
            action: "create",
            target: "rows",
            ids: cases.map(aCase => aCase.__id__ || uniqueId()),
            props: {
              rows: cases.map(aCase => {
                      const { __id__, ...others } = aCase;
                      return { ...others };
                    }),
              beforeId: beforeID
            },
            links
          });
    },
    setCanonicalCaseValues(caseValues: ICase[], links?: ILinkProperties) {
      const ids: string[] = [];
      const values = caseValues.map(aCase => {
                      const { __id__, ...others } = aCase;
                      ids.push(__id__);
                      return others;
                    });
      self.appendChange({
            action: "update",
            target: "rows",
            ids,
            props: values,
            links
      });
    },
    removeCases(ids: string[], links?: ILinkProperties) {
      self.appendChange({
            action: "delete",
            target: "rows",
            ids,
            links
          });
    },
    addGeometryLink(geometryId: string, links: ILinkProperties) {
      self.appendChange({
            action: "create",
            target: "geometryLink",
            ids: geometryId,
            links
      });
    },
    removeGeometryLinks(geometryIds: string | string[], links?: ILinkProperties) {
      self.appendChange({
            action: "delete",
            target: "geometryLink",
            ids: geometryIds,
            links
      });
    }
  }))
  .views(self => ({
    updateDatasetByExpressions(dataSet: IDataSet) {
      dataSet.attributes.forEach(attr => {
        const expression = self.metadata.expressions.get(attr.id);
        if (expression) {
          const xAttr = dataSet.attributes[0];
          const parser = new Parser();
          const parsedExpression = parser.parse(expression);
          for (let i = 0; i < attr.values.length; i++) {
            const xVal = xAttr.value(i) as number | string;
            if (xVal == null || xVal === "") {
              attr.setValue(i, undefined);
            } else {
              const expressionVal = parsedExpression.evaluate({[kSerializedXKey]: xVal});
              attr.setValue(i, isFinite(expressionVal) ? expressionVal : NaN);
            }
          }
        } else {
          for (let i = 0; i < attr.values.length; i++) {
            const val = attr.value(i);
            // Clean up displayed errors when an expression is deleted
            if (Number.isNaN(val as any)) {
              attr.setValue(i, undefined);
            }
          }
        }
      });

      return dataSet;
    }
  }))
  .views(self => ({
    applyCreate(dataSet: IDataSet, change: ITableChange, dataSetOnly = false) {
      switch (change.target) {
        case "table": {
          const props = change?.props as ICreateTableProperties;
          (props?.name != null) && dataSet.setName(props.name);
        }
        // fallthrough
        case "columns": {
          const props = change?.props as ICreateColumnsProperties;
          props?.columns?.forEach((col: any, index: number) => {
            const id = change.ids?.[index] || uniqueId();
            dataSet.addAttributeWithID({ id, ...col });
          });
          break;
        }
        case "rows": {
          const props = change?.props as ICreateRowsProperties;
          const rows = props?.rows?.map((row: any, index: number) => {
                        const id = change.ids?.[index] || uniqueId();
                        return { __id__: id, ...row };
                      });
          const beforeId = props?.beforeId;
          if (rows?.length) {
            dataSet.addCanonicalCasesWithIDs(rows, beforeId);
            self.updateDatasetByExpressions(dataSet);
          }
          break;
        }
        case "geometryLink":
          if (!dataSetOnly) {
            const geometryId = change.ids && change.ids as string;
            const geometryContent = geometryId && getGeometryContent(self, geometryId);
            geometryContent && self.metadata.addLinkedGeometry(geometryId!);
          }
          break;
      }
    },
    applyUpdate(dataSet: IDataSet, change: ITableChange, dataSetOnly = false) {
      const ids = castArray(change.ids);
      switch (change.target) {
        case "table": {
          const props = change.props as IUpdateTableProperties;
          (props?.name != null) && dataSet.setName(props.name);
          break;
        }
        case "columns": {
          const props = change.props as IUpdateColumnsProperties;
          const colProps = castArray(props);
          colProps?.forEach((col: any, colIndex) => {
            each(col, (value, prop) => {
              switch (prop) {
                case "name": {
                  const colId = ids[colIndex];
                  dataSet.setAttributeName(colId, value);
                  if (colIndex === 0) {
                    self.metadata.clearRawExpressions(kSerializedXKey);
                  }
                  break;
                }
                case "expression":
                  self.metadata.setExpression(ids[colIndex], value);
                  self.updateDatasetByExpressions(dataSet);
                  break;
                case "rawExpression":
                  self.metadata.setRawExpression(ids[colIndex], value);
                  break;
              }
            });
          });
          break;
        }
        case "rows": {
          const rowProps = change?.props && castArray(change.props);
          if (rowProps) {
            rowProps.forEach((row: any, rowIndex) => {
              dataSet.setCanonicalCaseValues([{ __id__: ids[rowIndex], ...row }]);
            });
            self.updateDatasetByExpressions(dataSet);
          }
          break;
        }
      }
    },
    applyDelete(dataSet: IDataSet, change: ITableChange, dataSetOnly = false) {
      const ids = change && castArray(change.ids);
      switch (change.target) {
        case "columns":
          if (ids?.length) {
            ids.forEach(id => dataSet.removeAttribute(id));
          }
          break;
        case "rows":
          if (ids?.length) {
            dataSet.removeCases(ids);
          }
          break;
        case "geometryLink":
          if (!dataSetOnly) {
            const geometryIds = castArray(change.ids);
            geometryIds.forEach(id => self.metadata.removeLinkedGeometry(id));
          }
          break;
      }
    }
  }))
  .views(self => ({
    applyChange(dataSet: IDataSet, change: ITableChange, dataSetOnly = false) {
      switch (change.action) {
        case "create":
          return self.applyCreate(dataSet, change, dataSetOnly);
        case "update":
          return self.applyUpdate(dataSet, change, dataSetOnly);
        case "delete":
          return self.applyDelete(dataSet, change, dataSetOnly);
      }
    }
  }))
  .views(self => ({
    applyChanges(dataSet: IDataSet, start = 0) {
      let hasColumnChanges = false;
      let hasRowChanges = false;
      for (let i = start; i < self.changes.length; ++i) {
        const change = safeJsonParse(self.changes[i]);
        if (change) {
          if ((change.target === "columns") || change.props?.columns) {
            hasColumnChanges = true;
            // most column changes (creation, deletion, expression changes) require re-rendering rows as well
            hasRowChanges = true;
          }
          if ((change.target === "rows") || change.props?.rows) {
            hasRowChanges = true;
          }
          self.applyChange(dataSet, change);
        }
      }
      return [hasColumnChanges, hasRowChanges];
    },
    applyChangesToDataSet(dataSet: IDataSet) {
      self.changes.forEach(jsonChange => {
        const change = safeJsonParse(jsonChange);
        if (change) {
          self.applyChange(dataSet, change, true);
        }
      });
    }
  }))
  .views(self => ({
    getSharedData(canonicalize = true) {
      const dataSet = DataSet.create();
      self.applyChangesToDataSet(dataSet);

      // add a __label__ attribute to returned dataSet (used by GeometryContent.addTableLink)
      const attrIds = dataSet.attributes.map(attr => attr.id);
      const kLabelId = uniqueId();
      dataSet.addAttributeWithID({ id: kLabelId, name: kLabelAttrName });
      for (let i = 0; i < dataSet.cases.length; ++i) {
        const caseId = dataSet.cases[i].__id__;
        const label = getRowLabel(i);
        const caseValues: ICase = { __id__: caseId, [kLabelId]: label };
        if (canonicalize) {
          attrIds.forEach(attrId => {
            const value = dataSet.getValue(caseId, attrId);
            caseValues[attrId] = canonicalizeValue(value);
          });
        }
        dataSet.setCanonicalCaseValues([caseValues]);
      }
      return dataSet;
    },
    isValidDataSetForGeometryLink(dataSet: IDataSet) {
      if ((dataSet.attributes.length < 2) || (dataSet.cases.length < 1)) return false;

      const attrIds = dataSet.attributes.map(attr => attr.id);
      for (const aCase of dataSet.cases) {
        if (!attrIds.every(attrId => isLinkableValue(dataSet.getValue(aCase.__id__, attrId)))) {
          return false;
        }
      }
      return true;
    },
    hasLinkableCases(dataSet: IDataSet) {
      if ((dataSet.attributes.length < 2) || (dataSet.cases.length < 1)) return false;

      const attrIds = dataSet.attributes.map(attr => attr.id);
      const isLinkableCaseValue = (value: number | string | null | undefined) =>
                                    (value != null) && (value !== "") && isFinite(Number(value));
      for (const aCase of dataSet.cases) {
        if (attrIds.every(attrId => isLinkableCaseValue(dataSet.getValue(aCase.__id__, attrId)))) {
          // we have at least one valid linkable case
          return true;
        }
      }
      return false;
    }
  }))
  .views(self => ({
    isValidForGeometryLink() {
      const dataSet = DataSet.create();
      self.applyChangesToDataSet(dataSet);
      return self.isValidDataSetForGeometryLink(dataSet);
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;

export function convertImportToChanges(snapshot: any) {
  const columns = snapshot?.columns as any[];
  if (!columns) return [] as string[];

  // create columns
  const changes: ITableChange[] = [];
  const tableName = snapshot?.name != null ? { name: snapshot.name } : undefined;
  const columnProps = columns.map((col: any) => ({ id: uniqueId(), name: col.name }));
  if (columnProps.length) {
    changes.push({ action: "create", target: "table", props: { columns: columnProps, ...tableName } });
  }

  // create rows
  const rowCount = columns.reduce((max, col) => {
                            const len = col.values?.length || 0;
                            return Math.max(max, len);
                          }, 0);
  const rows: any[] = [];
  for (let i = 0; i < rowCount; ++i) {
    const row: any = { __id__: uniqueId() };
    columnProps.forEach((col: any, colIndex) => {
      const values = columns[colIndex].values;
      if (col?.id && i < values.length) {
        row[col.id] = values[i];
      }
    });
    rows.push(row);
  }
  if (rows.length) {
    changes.push({ action: "create", target: "rows", props: { rows } });
  }
  return changes.map(change => JSON.stringify(change));
}

export function mapTileIdsInTableSnapshot(snapshot: SnapshotOut<TableContentModelType>,
                                          idMap: { [id: string]: string }) {
  snapshot.changes = snapshot.changes.map(changeJson => {
    const change: ITableChange = safeJsonParse(changeJson);
    if ((change.action === "create") && (change.target === "geometryLink")) {
      change.ids = idMap[change.ids as string];
    }
    if (change.links) {
      change.links.tileIds = change.links.tileIds.map(id => idMap[id]);
    }
    return JSON.stringify(change);
  });
  return snapshot;
}

registerToolContentInfo({
  id: kTableToolID,
  tool: "table",
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent,
  snapshotPostProcessor: mapTileIdsInTableSnapshot
});
