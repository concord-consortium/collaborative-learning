import { Expression, Parser } from "expr-eval";
import { reaction } from "mobx";
import { addDisposer, Instance, SnapshotIn, types, getType, getSnapshot } from "mobx-state-tree";
import { ITableChange } from "./table-change";
import { exportTableContentAsJson } from "./table-export";
import {
  convertChangesToSnapshot, convertImportToSnapshot, convertLegacyDataSet, isTableImportSnapshot
} from "./table-import";
import { getCellId } from "./table-utils";
import { IDocumentExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../tile-model-hooks";
import { getTileModel } from "../tile-model";
import { TileContentModel } from "../tile-content";
import { IClueTileObject } from "../../annotations/clue-object";
import { addCanonicalCasesToDataSet, IDataSet, ICaseCreation, ICase, DataSet } from "../../data/data-set";
import { kSharedDataSetType, SharedDataSet, SharedDataSetType } from "../../shared/shared-data-set";
import { updateSharedDataSetColors } from "../../shared/shared-data-set-colors";
import { SharedModelType } from "../../shared/shared-model";
import { kMinColumnWidth } from "../../../components/tiles/table/table-types";
import { canonicalizeExpression, kSerializedXKey } from "../../data/expression-utils";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../log/log-tile-change-event";
import { uniqueId } from "../../../utilities/js-utils";
import { createDefaultDataSet } from "../../../plugins/dataflow/model/utilities/create-default-data-set";

export const kTableTileType = "Table";
export const kCaseIdName = "__id__";

export const kTableDefaultHeight = 160;

// This is only used directly by tests
export function defaultTableContent(props?: IDefaultContentOptions) {
  return TableContentModel.create({
                            type: "Table",
                            // TODO: this name property is used in
                            // convertImportToSnapshot to set the name of the
                            // dataSet. This approach for creating and naming a
                            // dataset should be improved. It is difficult to
                            // reason about. Other tiles do not use the title
                            // of the props and they get unique names. So perhaps
                            // the table tile can do something similar.
                            name: props?.title,
                            columnWidths: {}
                          // This type cast could probably go away if MST was upgraded and
                          // types.snapshotProcessor(TableContentModel, ...) was used
                          } as SnapshotIn<typeof TableContentModel>);
}

export const TableMetadataModel = TileMetadataModel
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
      self.expressions.forEach((expression, _colId) => {
        const colId = String(_colId);
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
            // Internally the formula engine can handle strings in some cases.
            // CLUE only allows formulas to produce numeric values so we
            // always get the numeric value of a cell. If the value isn't
            // numeric numVal will return NaN.
            const xVal = xAttr.numValue(i);
            if (xVal == null) {
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

export const TableContentModel = TileContentModel
  .named("TableContent")
  .props({
    type: types.optional(types.literal(kTableTileType), kTableTileType),
    isImported: false,
    // Used to store the dataset when importing legacy formats
    importedDataSet: types.optional(DataSet, () => DataSet.create()),
    columnWidths: types.map(types.number)
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
  // TODO When importing a table, we were preprocessing, postprocessing, then preprocessing again the snapshot
  // all before we passed the data off to a sharedDataSet. Removing the importedDataSet in postProcessSnapshot
  // meant a loss of all data on import. This quick fix is not ideal but will solve the immediate
  // problem until we can figure out why we're doing an extra preprocess->postprocess round trip.
  // .postProcessSnapshot(snapshot => {
  //   const { importedDataSet, ...rest } = snapshot;
  //   return { ...rest };
  // })
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
    }
  }))
  .views(self => ({
    get linkedTiles(): string[] {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const tileIds = sharedModelManager?.getSharedModelTileIds(self.sharedModel) ?? [];
      return tileIds.filter(id => id !== self.metadata.id);
    },
  }))
  .views(self => ({
    get dataSet() {
      if (self.sharedModel) {
        return self.sharedModel.dataSet;
      }
      return self.importedDataSet;
    },
    columnWidth(attrId: string) {
      return self.columnWidths.get(attrId) || kMinColumnWidth;
    },
    get isUserResizable() {
      return true;
    },
    get isLinked() {
      return self.linkedTiles.length > 0;
    },
    get hasExpressions() {
      return self.metadata.hasExpressions;
    },
    parseExpression(expr: string) {
      return self.metadata.parseExpression(expr);
    },
    get tileSnapshotForCopy() {
      const snapshot = getSnapshot(self);
      return snapshot;
    },
    canUndo() {
      return false;
    },
    canUndoLinkedChange() {
      return false;
    }
  }))
  .views(self => ({
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.dataSet.name;
    },
    get annotatableObjects(): IClueTileObject[] {
      const objects: IClueTileObject[] = [];
      const objectType = "cell";
      self.dataSet.cases.forEach(c => {
        self.dataSet.attributes.forEach(attribute => {
          const objectId = getCellId(c.__id__, attribute.id);
          objects.push({ objectId, objectType });
        });
      });
      return objects;
    },
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata) {
      self.metadata = metadata as TableMetadataModelType;
    },
    setContentTitle(title: string) {
      self.dataSet.setName(title);
    }
  }))
  .actions(self => ({
    clearImportedDataSet() {
      self.importedDataSet = DataSet.create();
    },
    logChange(change: ITableChange) {
      const tileId = self.metadata?.id || "";
      logTileChangeEvent(LogEventName.TABLE_TOOL_CHANGE, { operation: change.action, change, tileId });
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

          // Originally this code was in doPostCreate. When shared datasets were implemented in
          // CLUE 3.0.0 this code was disabled.
          // - The `attr.formula.synchronize` is skipped, because it would add a new undo/redo entry.
          //   I think this synchronizing was here to handle backwards compatibility. Since it hadn't
          //   been running for many months it seems safe to skip it. There is a chance that some old
          //   document with an out of sync formula might be loaded. I'm not sure what will happen in
          //   that case.
          // - the updateDatasetByExpressions is skipped for the same reason. It would modify the dataset
          //   which would generate multiple undo/redo entries. Currently it seems the table is responsible
          //   for computing the formula and updating the dataset values. Because the table formula code
          //   was broken for a while, there will be documents where the values are out of sync with the
          //   formula. Without the updateDatasetByExpressions these out of sync values will not be
          //   updated.
          // A change to make here is to move this out of metadata just use volatile on the table
          // content model. And possibly even better would be to move the formula calculation out of the
          // table.

          // Initialize our metadata with this shared dataset
          if (self.dataSet.attributes.length >= 2) {

            // const xAttr = self.dataSet.attributes[0];
            // const xName = xAttr.name;
            self.dataSet.attributes.forEach((attr, i) => {
              if (i > 0) {
                // attr.formula.synchronize(xName);
                if (attr.formula.display) {
                  self.metadata.setRawExpression(attr.id, attr.formula.display);
                }
                if (attr.formula.canonical) {
                  self.metadata.setExpression(attr.id, attr.formula.canonical);
                }
             }
            });
          }

          // if (self.metadata.hasExpressions) {
          //   self.metadata.updateDatasetByExpressions(self.dataSet);
          // }
        }
        else {
          if (!sharedDataSet) {
            // The table doesn't have a shared model. This could happen because it
            // was just added to the document or because the table was unlinked from its
            // dataset. This unlinking can happen if the DataFlow tile unlinks the table.
            // In this case a new dataset will be created and linked.
            const tileModel = getTileModel(self);
            const dataSet = DataSet.create(!self.importedDataSet.isEmpty
              ? getSnapshot(self.importedDataSet) : createDefaultDataSet(tileModel?.title));
            self.clearImportedDataSet();
            sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
            // Unset title of the tile so that the name of the dataset will be displayed.
            tileModel?.setTitle(undefined);
          }

          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, sharedDataSet);
        }

        // update the colors
        const dataSets = sharedModelManager.getSharedModelsByType(kSharedDataSetType) as SharedDataSetType[];
        updateSharedDataSetColors(dataSets);
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // console.warn("updateAfterSharedModelChanges hasn't been implemented for table content.");
    },
    setColumnWidth(attrId: string, width: number) {
      self.columnWidths.set(attrId, width);
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
    },
    // isValidForGeometryLink() {
    //   return self.isValidDataSetForGeometryLink(self.dataSet);
    // },
    exportJson(options?: IDocumentExportOptions) {
      return exportTableContentAsJson(self.metadata, self.dataSet, self.columnWidth);
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;
export type TableContentSnapshotType = SnapshotIn<typeof TableContentModel>;
