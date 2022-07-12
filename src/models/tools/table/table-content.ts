import { Expression, Parser } from "expr-eval";
import { types, Instance, SnapshotOut, SnapshotIn } from "mobx-state-tree";
import { ITableChange } from "./table-change";
import { exportTableContentAsJson } from "./table-export";
import { convertChangesToSnapshot, convertImportToSnapshot, isTableImportSnapshot } from "./table-import";
import { isLinkableValue, canonicalizeValue } from "./table-model-types";
import { addLinkedTable, clearTableLinksFromGeometries, kLabelAttrName, removeLinkedTable } from "../table-links";
import { IDocumentExportOptions, IDefaultContentOptions } from "../tool-content-info";
import { ToolMetadataModel, ToolContentModel, toolContentModelHooks } from "../tool-types";
import { Attribute } from "../../data/attribute";
import { addCanonicalCasesToDataSet, IDataSet, ICaseCreation, ICase, DataSet } from "../../data/data-set";
import { canonicalizeExpression, kSerializedXKey } from "../../data/expression-utils";
import { Logger, LogEventName } from "../../../lib/logger";
import { getRowLabel, ILinkProperties } from "../table-link-types";
import { uniqueId } from "../../../utilities/js-utils";

export const kTableToolID = "Table";
export const kCaseIdName = "__id__";

export const kTableDefaultHeight = 160;

// This is only used directly by tests
export function defaultTableContent(props?: IDefaultContentOptions) {
  return TableContentModel.create({
                            type: "Table",
                            name: props?.title,
                            columns: [
                              { name: "x" },
                              { name: "y" }
                            ]
                          // This type cast could probably go away if MST was upgraded and
                          // types.snapshotProcessor(TableContentModel, ...) was used
                          } as SnapshotIn<typeof TableContentModel>);
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

export const TableMetadataModel = ToolMetadataModel
  .named("TableMetadata")
  .props({
    expressions: types.map(types.string),
    rawExpressions: types.map(types.string)
  })
  .volatile(self => ({
    parser: new Parser()
  }))
  .views(self => ({
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
  }))
  .views(self => ({
    updateDatasetByExpressions(dataSet: IDataSet) {
      dataSet.attributes.forEach(attr => {
        const expression = self.expressions.get(attr.id);
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
  .actions(self => ({
    updateExpressions(id: string, rawExpression: string, expression: string, dataSet: IDataSet) {
      self.setRawExpression(id, rawExpression);
      self.setExpression(id, expression);
      self.updateDatasetByExpressions(dataSet);
    }
  }));
export interface TableMetadataModelType extends Instance<typeof TableMetadataModel> {}

export const TableContentModel = ToolContentModel
  .named("TableContent")
  .props({
    type: types.optional(types.literal(kTableToolID), kTableToolID),
    isImported: false,
    dataSet: types.optional(DataSet, () => DataSet.create()),
    linkedGeometries: types.array(types.string)
  })
  .volatile(self => ({
    metadata: undefined as any as TableMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    const s = snapshot as any;
    if (isTableImportSnapshot(s)) {
      return { isImported: true, ...convertImportToSnapshot(s) };
    }
    if (s?.changes) {
      return convertChangesToSnapshot(s.changes);
    }
    return snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get isLinked() {
      return self.linkedGeometries.length > 0;
    },
    get hasExpressions() {
      return self.metadata.hasExpressions;
    },
    parseExpression(expr: string) {
      return self.metadata.parseExpression(expr);
    }
  }))
  .views(self => ({
    canUndo() {
      return false;
    },
    canUndoLinkedChange() {
      return false;
    }
  }))
  .actions(self => toolContentModelHooks({
    doPostCreate(metadata) {
      self.metadata = metadata as TableMetadataModelType;

      if (self.dataSet.attributes.length >= 2) {
        const xAttr = self.dataSet.attributes[0];
        const xName = xAttr.name;
        self.dataSet.attributes.forEach((attr, i) => {
          if (i > 0) {
            attr.formula.synchronize(xName);
            if (attr.formula.display) {
              self.metadata.setRawExpression(attr.id, attr.formula.display);
            }
            if (attr.formula.canonical) {
              self.metadata.setExpression(attr.id, attr.formula.canonical);
            }
          }
        });
      }

      if (self.metadata.hasExpressions) {
        self.metadata.updateDatasetByExpressions(self.dataSet);
      }
    },
    willRemoveFromDocument() {
      clearTableLinksFromGeometries(self, self.metadata.id, self.linkedGeometries);
      self.linkedGeometries.clear();
    },
  }))
  .actions(self => ({
    appendChange(change: ITableChange) {
      // self.changes.push(JSON.stringify(change));

      const toolId = self.metadata?.id || "";
      Logger.logToolChange(LogEventName.TABLE_TOOL_CHANGE, change.action, change, toolId);
    }
  }))
  .actions(self => ({
    setTableName(name: string) {
      self.dataSet.name = name;

      self.appendChange({
              action: "update",
              target: "table",
              props: { name }
            });
    },
    addAttribute(id: string, name: string, links?: ILinkProperties) {
      self.dataSet.addAttributeWithID({ id, name });
      self.metadata.updateDatasetByExpressions(self.dataSet);

      self.appendChange({
            action: "create",
            target: "columns",
            ids: [id],
            props: { columns: [{ name }] },
            links
          });
    },
    setAttributeName(id: string, name: string, links?: ILinkProperties) {
      const attr = self.dataSet.attrFromID(id);
      if (attr) {
        attr.name = name;
        // if the name of the "x" column is changed, formulas must be updated
        if (self.dataSet.attrIndexFromID(id) === 0) {
          self.metadata.clearRawExpressions(kSerializedXKey);
        }
      }

      self.appendChange({
              action: "update",
              target: "columns",
              ids: id,
              props: { name },
              links
            });
    },
    removeAttributes(ids: string[], links?: ILinkProperties) {
      ids.forEach(id => self.dataSet.removeAttribute(id));
      self.metadata.updateDatasetByExpressions(self.dataSet);

      self.appendChange({
              action: "delete",
              target: "columns",
              ids,
              links
            });
    },
    setExpression(id: string, expression: string, rawExpression: string, links?: ILinkProperties) {
      self.dataSet.attrFromID(id)?.setFormula(rawExpression, expression);
      self.metadata.updateExpressions(id, rawExpression, expression, self.dataSet);

      self.appendChange({
        action: "update",
        target: "columns",
        ids: id,
        props: { expression, rawExpression },
        links
      });
    },
    setExpressions(rawExpressions: Map<string, string>, xName: string, links?: ILinkProperties) {
      rawExpressions.forEach((rawExpression, id) => {
        const attr = self.dataSet.attrFromID(id);
        if (attr) {
          const expression = canonicalizeExpression(rawExpression, xName);
          attr.setFormula(rawExpression, expression);

          self.metadata.updateExpressions(id, rawExpression, expression, self.dataSet);
        }
      });

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
      addCanonicalCasesToDataSet(self.dataSet, cases, beforeID);
      self.metadata.updateDatasetByExpressions(self.dataSet);

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
      self.dataSet.setCanonicalCaseValues(caseValues);
      self.metadata.updateDatasetByExpressions(self.dataSet);

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
      self.dataSet.removeCases(ids);

      self.appendChange({
            action: "delete",
            target: "rows",
            ids,
            links
          });
    },
    addGeometryLink(geometryId: string) {
      self.linkedGeometries.push(geometryId);
      self.appendChange({ action: "create", target: "geometryLink", ids: geometryId });
    },
    removeGeometryLink(geometryId: string) {
      self.linkedGeometries.remove(geometryId);
      self.appendChange({
            action: "delete",
            target: "geometryLink",
            ids: geometryId
      });
    }
  }))
  .views(self => ({
    getSharedData(canonicalize = true) {
      const dataSet = DataSet.create(self.dataSet);

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
      return self.isValidDataSetForGeometryLink(self.dataSet);
    },
    exportJson(options?: IDocumentExportOptions) {
      return exportTableContentAsJson(self.metadata, self.dataSet);
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;

export function mapTileIdsInTableSnapshot(snapshot: SnapshotOut<TableContentModelType>,
                                          idMap: { [id: string]: string }) {
  // snapshot.changes = snapshot.changes.map(changeJson => {
  //   const change = safeJsonParse<ITableChange>(changeJson);
  //   if ((change?.target === "geometryLink") && change.ids) {
  //     change.ids = Array.isArray(change.ids)
  //                   ? change.ids.map(id => idMap[id])
  //                   : idMap[change.ids];
  //   }
  //   if (change?.links) {
  //     change.links.tileIds = change.links.tileIds.map(id => idMap[id]);
  //   }
  //   return JSON.stringify(change);
  // });
  return snapshot;
}
