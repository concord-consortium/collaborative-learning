import { Expression, Parser } from "expr-eval";
import { reaction } from "mobx";
import { addDisposer, Instance, SnapshotIn, types, getType, getSnapshot } from "mobx-state-tree";
import { ITableChange } from "./table-change";
import { exportTableContentAsJson } from "./table-export";
import {
  convertChangesToSnapshot, convertImportToSnapshot, convertLegacyDataSet, isTableImportSnapshot
} from "./table-import";
import { IDocumentExportOptions, IDefaultContentOptions } from "../tool-content-info";
import { ToolMetadataModel, ToolContentModel, toolContentModelHooks } from "../tool-types";
import { addCanonicalCasesToDataSet, IDataSet, ICaseCreation, ICase, DataSet } from "../../data/data-set";
import { SharedDataSet, SharedDataSetType } from "../shared-data-set";
import { SharedModelType } from "../shared-model";
import { canonicalizeExpression, kSerializedXKey } from "../../data/expression-utils";
import { Logger, LogEventName } from "../../../lib/logger";
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
    // Used to store the dataset when importing legacy formats
    importedDataSet: types.optional(DataSet, () => DataSet.create())
  })
  .volatile(self => ({
    metadata: undefined as any as TableMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    const s = snapshot as any;
    if (isTableImportSnapshot(s)) {
      return convertLegacyDataSet({ isImported: true, ...convertImportToSnapshot(s) });
    }
    if (s?.changes) {
      return convertLegacyDataSet(convertChangesToSnapshot(s.changes));
    }
    return convertLegacyDataSet(snapshot);
  })
  .postProcessSnapshot(snapshot => {
    const { importedDataSet, ...rest } = snapshot;
    return { ...rest };
  })
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      //
      // For now we are checking the type ourselves, and we are assuming the shared model we want
      // is the first one.
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedDataSet) {
        return undefined;
      }
      return firstSharedModel as SharedDataSetType;
    },
    // Returns a list of ids, currently not implemented
    get linkedGeometries(): string[] {
      return [];
    }
  }))
  .views(self => ({
    get dataSet() {
      if (self.sharedModel) {
        return self.sharedModel.dataSet;
      }
      return self.importedDataSet;
    },
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
    }
  }))
  .actions(self => ({
    clearImportedDataSet() {
      self.importedDataSet = DataSet.create();
    },
    logChange(change: ITableChange) {
      const toolId = self.metadata?.id || "";
      Logger.logToolChange(LogEventName.TABLE_TOOL_CHANGE, change.action, change, toolId);
    }
  }))
  .actions(self => ({
    afterAttach() {
      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        const sharedDataSet = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedDataSet, self.metadata.id)
          : undefined;

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        return { sharedModelManager, sharedDataSet, tileSharedModels };
      },
      // reaction/effect
      ({sharedModelManager, sharedDataSet, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        if (sharedDataSet && tileSharedModels?.includes(sharedDataSet)) {
          // The shared model has already been registered by a client, but as the
          // "owner" of the data, we synchronize it with our local content.
          if (!self.importedDataSet.isEmpty) {
            sharedDataSet.dataSet = DataSet.create(getSnapshot(self.importedDataSet));
            self.clearImportedDataSet();
          }
        }
        else {
          if (!sharedDataSet) {
            // The document doesn't have a shared model yet
            const dataSet = DataSet.create(!self.importedDataSet.isEmpty
              ? getSnapshot(self.importedDataSet) : undefined);
            self.clearImportedDataSet();
            sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
          }

          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, sharedDataSet);
        }
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      console.warn("updateAfterSharedModelChanges hasn't been implemented for table content.");

      // TODO This was moved from doPostCreate and might need to be rethought.
      // if (self.dataSet.attributes.length >= 2) {
      //   const xAttr = self.dataSet.attributes[0];
      //   const xName = xAttr.name;
      //   self.dataSet.attributes.forEach((attr, i) => {
      //     if (i > 0) {
      //       attr.formula.synchronize(xName);
      //       if (attr.formula.display) {
      //         self.metadata.setRawExpression(attr.id, attr.formula.display);
      //       }
      //       if (attr.formula.canonical) {
      //         self.metadata.setExpression(attr.id, attr.formula.canonical);
      //       }
      //     }
      //   });
      // }

      // if (self.metadata.hasExpressions) {
      //   self.metadata.updateDatasetByExpressions(self.dataSet);
      // }
    },
    setTableName(name: string) {
      self.dataSet.setName(name);

      self.logChange({ action: "update", target: "table", props: { name } });
    },
    addAttribute(id: string, name: string) {
      self.dataSet.addAttributeWithID({ id, name });
      self.metadata.updateDatasetByExpressions(self.dataSet);

      self.logChange({ action: "create", target: "columns", ids: [id], props: { columns: [{ name }] } });
    },
    setAttributeName(id: string, name: string) {
      const attr = self.dataSet.attrFromID(id);
      if (attr) {
        attr.setName(name);
        // if the name of the "x" column is changed, formulas must be updated
        if (self.dataSet.attrIndexFromID(id) === 0) {
          self.metadata.clearRawExpressions(kSerializedXKey);
        }
      }

      self.logChange({ action: "update", target: "columns", ids: id, props: { name } });
    },
    removeAttributes(ids: string[]) {
      ids.forEach(id => self.dataSet.removeAttribute(id));
      self.metadata.updateDatasetByExpressions(self.dataSet);

      self.logChange({ action: "delete", target: "columns", ids });
    },
    setExpression(id: string, expression: string, rawExpression: string) {
      self.dataSet.attrFromID(id)?.setFormula(rawExpression, expression);
      self.metadata.updateExpressions(id, rawExpression, expression, self.dataSet);

      self.logChange({ action: "update", target: "columns", ids: id, props: { expression, rawExpression } });
    },
    setExpressions(rawExpressions: Map<string, string>, xName: string) {
      rawExpressions.forEach((rawExpression, id) => {
        const attr = self.dataSet.attrFromID(id);
        if (attr) {
          const expression = canonicalizeExpression(rawExpression, xName);
          attr.setFormula(rawExpression, expression);

          self.metadata.updateExpressions(id, rawExpression, expression, self.dataSet);
        }
      });

      self.logChange({
        action: "update",
        target: "columns",
        ids: Array.from(rawExpressions.keys()),
        props: Array.from(rawExpressions.values())
                    .map(rawExpr => ({
                      expression: canonicalizeExpression(rawExpr, xName),
                      rawExpression: rawExpr
                    }))
      });
    },
    addCanonicalCases(cases: ICaseCreation[], beforeID?: string | string[]) {
      addCanonicalCasesToDataSet(self.dataSet, cases, beforeID);
      self.metadata.updateDatasetByExpressions(self.dataSet);

      self.logChange({
            action: "create",
            target: "rows",
            ids: cases.map(aCase => aCase.__id__ || uniqueId()),
            props: {
              rows: cases.map(aCase => {
                      const { __id__, ...others } = aCase;
                      return { ...others };
                    }),
              beforeId: beforeID
            }
          });
    },
    setCanonicalCaseValues(caseValues: ICase[]) {
      self.dataSet.setCanonicalCaseValues(caseValues);
      self.metadata.updateDatasetByExpressions(self.dataSet);

      const ids: string[] = [];
      const values = caseValues.map(aCase => {
                      const { __id__, ...others } = aCase;
                      ids.push(__id__);
                      return others;
                    });
      self.logChange({ action: "update", target: "rows", ids, props: values });
    },
    removeCases(ids: string[]) {
      self.dataSet.removeCases(ids);

      self.logChange({ action: "delete", target: "rows", ids });
    }
  }))
  .views(self => ({
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
    // isValidForGeometryLink() {
    //   return self.isValidDataSetForGeometryLink(self.dataSet);
    // },
    exportJson(options?: IDocumentExportOptions) {
      return exportTableContentAsJson(self.metadata, self.dataSet);
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;
