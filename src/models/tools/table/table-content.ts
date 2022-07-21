import { Expression, Parser } from "expr-eval";
import { castArray, each } from "lodash";
import { types, IAnyStateTreeNode, Instance, SnapshotIn, SnapshotOut } from "mobx-state-tree";
import { exportTableContentAsJson } from "./table-export";
import { getRowLabel, kSerializedXKey, canonicalizeValue, isLinkableValue } from "./table-model-types";
import { IDocumentExportOptions, IDefaultContentOptions } from "../tool-content-info";
import { ToolMetadataModel, ToolContentModel, toolContentModelHooks } from "../tool-types";
import { addLinkedTable, removeLinkedTable } from "../table-links";
import { IDataSet, ICaseCreation, ICase, DataSet } from "../../data/data-set";
import { canonicalizeExpression } from "../../../components/tools/table-tool/expression-utils";
import {
  ICreateColumnsProperties, ICreateRowsProperties, ICreateTableProperties, ILinkProperties, IRowLabel, IRowProperties,
  ITableChange, ITableLinkProperties, IUpdateColumnsProperties, IUpdateTableProperties
} from "../../../models/tools/table/table-change";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { getGeometryContent } from "../geometry/geometry-content";
import { getTileContentById } from "../../../utilities/mst-utils";
import { Logger, LogEventName } from "../../../lib/logger";

export const kTableToolID = "Table";
export const kCaseIdName = "__id__";
export const kLabelAttrName = "__label__";

export const kTableDefaultHeight = 160;

// This is only used directly by tests
export function defaultTableContent(props?: IDefaultContentOptions) {
  return TableContentModel.create({
                            name: props?.title,
                            columns: [
                              { name: "x" },
                              { name: "y" }
                            ]
                          // This type cast could probably go away if MST was upgraded and
                          // types.snapshotProcessor(TableContentModel, ...) was used
                          } as SnapshotIn<typeof TableContentModel>);
}

export function getTableContent(target: IAnyStateTreeNode, tileId: string): TableContentModelType | undefined {
  const content = getTileContentById(target, tileId);
  return content && content as TableContentModelType;
}

interface IGetTableContentHeight {
  dataRows: number;
  rowHeight?: number;
  readOnly?: boolean;
  hasExpressions?: boolean;
  padding?: number;
}
export const getTableContentHeight = ({
  dataRows, rowHeight, readOnly, hasExpressions, padding
}: IGetTableContentHeight) => {
  const kDefaultRowHeight = 34;
  const kDefaultPadding = 10;
  const headerRows = 2 + (hasExpressions ? 1 : 0);
  const inputRows = readOnly ? 0 : 1;
  const kBorders = 2 * 2;
  const _padding = 2 * (padding || kDefaultPadding);
  return (headerRows + dataRows + inputRows) * (rowHeight || kDefaultRowHeight) + kBorders + _padding;
};

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

export interface TableContentColumnImport {
  name: string;
  // user-editable expression for y variable in terms of x variable by name
  // corresponds to rawExpression in the internal model
  expression?: string;
  values?: Array<number | string>;
}
export interface TableContentTableImport {
  type: "Table";
  name: string;
  columns?:TableContentColumnImport[];
}

export const TableMetadataModel = ToolMetadataModel
  .named("TableMetadata")
  .props({
    linkedGeometries: types.array(types.string),
    expressions: types.map(types.string),
    rawExpressions: types.map(types.string)
  })
  .volatile(self => ({
    parser: new Parser()
  }))
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
    },
    parseExpression(expr: string) {
      let result: Expression | undefined;
      try {
        result = self.parser.parse(expr);
      }
      catch(e) {
        // return undefined on error
      }
      return result;
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
      removeLinkedTable(self.id);
    },
    clearLinkedGeometries() {
      self.linkedGeometries.clear();
    },
    setExpression(colId: string, expression?: string) {
      if (expression) {
        self.expressions.set(colId, expression);
      }
      else {
        self.expressions.delete(colId);
      }
    },
    setRawExpression(colId: string, rawExpression?: string) {
      if (rawExpression) {
        self.rawExpressions.set(colId, rawExpression);
      }
      else {
        self.rawExpressions.delete(colId);
      }
    },
    clearExpression(colId: string) {
      self.rawExpressions.delete(colId);
      self.expressions.delete(colId);
    },
    clearRawExpressions(varName: string) {
      self.expressions.forEach((expression, colId) => {
        if (expression) {
          const parsedExpression = self.parseExpression(expression);
          if (parsedExpression && (parsedExpression.variables().indexOf(varName) >= 0)) {
            self.rawExpressions.delete(colId);
          }
        }
      });
    }
  }));
export type TableMetadataModelType = Instance<typeof TableMetadataModel>;

export const TableContentModel = ToolContentModel
  .named("TableContent")
  .props({
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
      const parsedChanges = changes.map((change: string) => safeJsonParse<ITableChange>(change));
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
    },
    parseExpression(expr: string) {
      return self.metadata.parseExpression(expr);
    }
  }))
  .views(self => ({
    /*
     * Returns link metadata for attaching to client (e.g. geometry) tool actions
     * that includes label information.
     */
    getClientLinks(linkId: string, dataSet: IDataSet): ITableLinkProperties {
      const labels: IRowLabel[] = [];

      // add axis labels
      const [xAxisLabel, yAxisLabel] = getAxisLabelsFromDataSet(dataSet);
      xAxisLabel && labels.push({ id: "xAxis", label: xAxisLabel });
      yAxisLabel && labels.push({ id: "yAxis", label: yAxisLabel });

      // add label for each case, indexed by case ID
      labels.push(...dataSet.cases.map((aCase, i) => ({ id: aCase.__id__, label: getRowLabel(i) })));

      return { id: linkId, tileIds: [self.metadata.id], labels };
    },
    getLinkedChange(linkId: string) {
      let parsedChange: ITableChange | undefined;
      const foundIndex = self.changes.findIndex(changeJson => {
        const change = safeJsonParse<ITableChange>(changeJson);
        const isFound = change?.links?.id === linkId;
        isFound && (parsedChange = change);
        return isFound;
      });
      return foundIndex >= 0 ? parsedChange : undefined;
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
    canUndoLinkedChange(/*change: JXGChange*/) {
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
  .actions(self => toolContentModelHooks({
    doPostCreate(metadata) {
      self.metadata = metadata as TableMetadataModelType;
    },
    willRemoveFromDocument() {
      self.metadata.linkedGeometries.forEach(geometryId => {
        const geometryContent = getGeometryContent(self, geometryId);
        geometryContent?.removeTableLink(undefined, self.metadata.id);
      });
      self.metadata.clearLinkedGeometries();
    }
  }))
  .actions(self => ({
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
    removeGeometryLink(geometryId: string, links?: ILinkProperties) {
      self.appendChange({
            action: "delete",
            target: "geometryLink",
            ids: geometryId,
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
          const parsedExpression = self.parseExpression(expression);
          for (let i = 0; i < attr.values.length; i++) {
            const xVal = xAttr.value(i) as number | string;
            if (xVal == null || xVal === "") {
              attr.setValue(i, undefined);
            } else if (!parsedExpression) {
              attr.setValue(i, NaN);
            } else {
              let expressionVal: number;
              try {
                expressionVal = parsedExpression.evaluate({[kSerializedXKey]: xVal});
              }
              catch(e) {
                expressionVal = NaN;
              }
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
          let hasExpressions = false;
          const props = change?.props as ICreateColumnsProperties;
          props?.columns?.forEach((col, index) => {
            const id = col.id || change.ids?.[index] || uniqueId();
            const { expression, rawExpression, ...otherCol } = col;
            hasExpressions ||= !!expression || !!rawExpression;
            dataSet.addAttributeWithID({ id, ...otherCol });
            rawExpression && self.metadata.setRawExpression(id, rawExpression);
            expression && self.metadata.setExpression(id, expression);
          });
          hasExpressions && self.updateDatasetByExpressions(dataSet);
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
          colProps?.forEach((col, colIndex) => {
            const colId = ids[colIndex];
            if (dataSet.attrFromID(colId)) {
              each(col, (value, prop) => {
                const _value = value as string;
                switch (prop) {
                  case "name": {
                    dataSet.setAttributeName(colId, _value);
                    if (colIndex === 0) {
                      self.metadata.clearRawExpressions(kSerializedXKey);
                    }
                    break;
                  }
                  case "expression":
                    self.metadata.setExpression(colId, _value);
                    self.updateDatasetByExpressions(dataSet);
                    break;
                  case "rawExpression":
                    self.metadata.setRawExpression(colId, _value);
                    break;
                }
              });
            }
            else {
              // encountered this situation during development, perhaps due to a prior bug
              console.warn(`TableContent.applyUpdate: skipping attempt to update non-existent column ${colId}:`,
                            JSON.stringify(col));
            }
          });
          break;
        }
        case "rows": {
          const rowProps: IRowProperties[] | undefined = change?.props && castArray(change.props as any);
          if (rowProps) {
            rowProps.forEach((row, rowIndex) => {
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
            ids.forEach(id => {
              dataSet.removeAttribute(id);
              // remove expressions from maps
              self.metadata.clearExpression(id);
            });
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
        const change = safeJsonParse<ITableChange>(self.changes[i]);
        if (change) {
          if ((change.target === "columns") || (change.props as ICreateColumnsProperties)?.columns) {
            hasColumnChanges = true;
            // most column changes (creation, deletion, expression changes) require re-rendering rows as well
            hasRowChanges = true;
          }
          if ((change.target === "rows") || (change.props as ICreateRowsProperties)?.rows) {
            hasRowChanges = true;
          }
          self.applyChange(dataSet, change);
        }
      }
      return [hasColumnChanges, hasRowChanges];
    },
    applyChangesToDataSet(dataSet: IDataSet) {
      self.changes.forEach(jsonChange => {
        const change = safeJsonParse<ITableChange>(jsonChange);
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
    },
    exportJson(options?: IDocumentExportOptions) {
      const dataSet = DataSet.create();
      self.applyChangesToDataSet(dataSet);
      return exportTableContentAsJson(self.metadata, dataSet);
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;

export function convertImportToChanges(snapshot: TableContentTableImport) {
  const columns = snapshot?.columns;
  if (!columns) return [] as string[];

  // create columns
  const changes: ITableChange[] = [];
  const tableName = snapshot?.name != null ? { name: snapshot.name } : undefined;
  let xName: string;
  const columnProps = columns.map((col, index) => {
                        const { name, expression: rawExpression } = col;
                        (index === 0) && (xName = name);
                        const expression = (index > 0) && xName && rawExpression
                                            ? canonicalizeExpression(rawExpression, xName)
                                            : undefined;
                        return { id: uniqueId(), name, rawExpression, expression };
                      });
  if (columnProps.length) {
    changes.push({ action: "create", target: "table", props: { columns: columnProps, ...tableName } });
  }

  // create rows
  const rowCount = columns.reduce((max, col) => {
                            const len = col.values?.length || 0;
                            return Math.max(max, len);
                          }, 0);
  const rows: Record<string, number | string>[] = [];
  for (let i = 0; i < rowCount; ++i) {
    const row: Record<string, number | string> = { __id__: uniqueId() };
    columnProps.forEach((col: any, colIndex) => {
      const hasExpression = col.expression;
      const values = hasExpression ? undefined : columns[colIndex].values;
      if (col?.id && values && (i < values?.length)) {
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
    const change = safeJsonParse<ITableChange>(changeJson);
    if ((change?.target === "geometryLink") && change.ids) {
      change.ids = Array.isArray(change.ids)
                    ? change.ids.map(id => idMap[id])
                    : idMap[change.ids];
    }
    if (change?.links) {
      change.links.tileIds = change.links.tileIds.map(id => idMap[id]);
    }
    return JSON.stringify(change);
  });
  return snapshot;
}
