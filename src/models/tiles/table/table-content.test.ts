import { IAnyType, types, castToSnapshot } from "mobx-state-tree";
import {
  FormulaManager
} from "@concord-consortium/codap-formulas-react17/models/formula/formula-manager";
import {
  createFormulaAdapters
} from "@concord-consortium/codap-formulas-react17/models/formula/formula-adapter-registry";
import {
  AttributeFormulaAdapter
} from "@concord-consortium/codap-formulas-react17/models/formula/attribute-formula-adapter";
import { kDefaultColumnWidth } from "../../../components/tiles/table/table-types";
import { createFormulaDataSetProxy } from "../../../models/data/formula-data-set-proxy";
import { SharedDataSet, SharedDataSetSnapshotType, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { IDataSet } from "../../data/data-set";
import { SharedModelType } from "../../shared/shared-model";
import { defaultTableContent, kTableTileType, TableContentModel, TableContentModelType,
  TableContentSnapshotType, TableMetadataModel } from "./table-content";
import { TableContentTableImport } from "./table-import";

// mock Logger calls
const mockLogTileChangeEvent = jest.fn();
jest.mock("../log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent()
}));

function getCaseNoId(dataSet: IDataSet, index: number) {
  const c = dataSet.getCaseAtIndex(index);
  c && (delete (c as any).__id__);
  return c;
}

function getCanonicalCaseNoId(dataSet: IDataSet, index: number) {
  const c = dataSet.getCanonicalCaseAtIndex(index);
  c && (delete (c as any).__id__);
  return c;
}

const TestTileContentModelContainer = types.model("TestTileContentModelContainer", {
  child: TableContentModel,
  dataSet: types.maybe(SharedDataSet)
});

const makeSharedModelManager = ( dataSet?: SharedDataSetType): ISharedModelManager => {
  let sharedDataSet = dataSet;
  return {
    isReady: true,
    getSharedModelProviders(model: SharedModelType){
      return [];
    },
    findFirstSharedModelByType<IT extends IAnyType>(sharedModelType: IT): IT["Type"] | undefined {
      return sharedDataSet;
    },
    getSharedModelLabel(model: SharedModelType) {
      return model.id;
    },
    getSharedModelsByType<IT extends IAnyType>(type: string): IT["Type"][] {
      return sharedDataSet ? [sharedDataSet] : [];
    },
    addTileSharedModel(tileContentModel, sharedModel) {
      sharedDataSet = sharedModel as SharedDataSetType;
    },
    removeTileSharedModel(tileContentModel, sharedModel) {
      sharedDataSet = undefined;
    },
    getTileSharedModels(tileContentModel) {
      return sharedDataSet ? [sharedDataSet] : [];
    },
    getTileSharedModelsByType(tileContentModel, modelType) {
      return sharedDataSet ? [sharedDataSet] : [];
    },
    getSharedModelDragDataForTiles(tileIds: string[]) {
      return [];
    },
    getSharedModelTiles(sharedModel) {
      return [];
    },
    getSharedModelTileIds(sharedModel) {
      // ignore linked tiles for now
      return [];
    },
    addSharedModel(sharedModel) {
      // ignore this for now
    },
  };
};

// Note: in the diagram tests this method also sets up an onSnapshot listener to automatically
// update the content when the shared model change.
const setupContainer = (content: TableContentModelType, dataSetSnapshot?: SharedDataSetSnapshotType) => {
  let dataSet: SharedDataSetType | undefined;
  if (dataSetSnapshot) {
    dataSet = SharedDataSet.create(dataSetSnapshot);
  }

  const sharedModelManager = makeSharedModelManager(dataSet);
  const formulaManager = new FormulaManager();
  const adapterApi = formulaManager.getAdapterApi();

  TestTileContentModelContainer.create(
    {child: castToSnapshot(content), dataSet},
    {sharedModelManager, formulaManager}
  );

  AttributeFormulaAdapter.register();
  formulaManager.addAdapters(createFormulaAdapters(adapterApi));
  if (dataSet) {
    const formulaDataSet = createFormulaDataSetProxy(dataSet!.dataSet);
    formulaManager.addDataSet(formulaDataSet);
  }
};

describe("TableContent", () => {

  it("can create empty/default TableContentModels", () => {
    const emptyTable = TableContentModel.create();
    expect(emptyTable.type).toBe(kTableTileType);
    expect(emptyTable.isImported).toBe(false);
    expect(emptyTable.dataSet.attributes.length).toBe(0);
    expect(emptyTable.dataSet.cases.length).toBe(0);
    expect(emptyTable.isUserResizable).toBe(true);

    const defaultTable = defaultTableContent();
    expect(defaultTable.type).toBe(kTableTileType);
    expect(defaultTable.isImported).toBe(false);
    expect(defaultTable.dataSet.attributes.length).toBe(0);
    expect(defaultTable.dataSet.cases.length).toBe(0);
    expect(defaultTable.isUserResizable).toBe(true);

    // expect(convertImportToChanges(undefined as any)).toEqual([]);
    // expect(convertImportToChanges({} as any)).toEqual([]);
  });

  it("creates a default shared dataset with 2 columns", () => {
    const defaultTable = defaultTableContent();
    const metadata = TableMetadataModel.create({ id: "test-metadata" });
    defaultTable.doPostCreate!(metadata);

    setupContainer(defaultTable);
    expect(defaultTable.dataSet.attributes.length).toBe(2);
    expect(defaultTable.dataSet.cases.length).toBe(0);
  });

  it("can import an authored table without data", () => {
    const kTableTitle = "Table Title";
    const importData: TableContentTableImport = {
            type: "Table",
            name: kTableTitle,
            columns: [
              { name: "xCol" },
              { name: "yCol" }
            ]
          };
    const table = TableContentModel.create(importData as any);
    expect(table.type).toBe(kTableTileType);
    expect(table.isImported).toBe(true);
    expect(table.dataSet.name).toBe(kTableTitle);
    expect(table.dataSet.attributes.length).toBe(2);
    expect(table.dataSet.cases.length).toBe(0);
  });

  const colWidth = 200;
  const biggerColWidth = 500;
  it("can import column widths using the new export format", () => {
    const kTableTitle = "Table Title";
    const importData: TableContentTableImport = {
      type: "Table",
      columnWidths: {
        "col1": colWidth,
        "col2": biggerColWidth
      },
      name: kTableTitle
    };
    const table = TableContentModel.create(importData);
    expect(table.type).toBe(kTableTileType);
    expect(table.columnWidth("col1")).toBe(colWidth);
    expect(table.columnWidth("col2")).toBe(biggerColWidth);
  });

  it("can import an authored table with data", () => {
    const kTableTitle = "Table Title";
    const importData: TableContentTableImport = {
            type: "Table",
            name: kTableTitle,
            columns: [
              { name: "xCol", values: ["x1", "x2"] },
              { name: "yCol", values: ["y1", "y2", "y3"] }
            ]
          };
    const table = TableContentModel.create(importData as any);
    expect(table.type).toBe(kTableTileType);
    expect(table.isImported).toBe(true);
    expect(table.dataSet.name).toBe(kTableTitle);
    expect(table.dataSet.attributes.length).toBe(2);
    expect(table.dataSet.cases.length).toBe(3);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: "x1", yCol: "y1" });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: "x2", yCol: "y2" });
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ xCol: "", yCol: "y3" });
  });

  it("can import an authored table with column widths", () => {
    const importData: TableContentTableImport = {
      type: "Table",
      name: "Table Title",
      columns: [
        { name: "xCol", values: ["x1", "x2"] },
        { name: "yCol", width: colWidth, values: ["y1", "y2", "y3"] }
      ]
    };
    const table = TableContentModel.create(importData);
    expect(table.type).toBe(kTableTileType);
    const xCol = table.dataSet.attrFromName("xCol");
    expect(xCol).not.toBeUndefined();
    if (xCol) {
      expect(table.columnWidth(xCol.id)).toEqual(kDefaultColumnWidth);
    }
    const yCol = table.dataSet.attrFromName("yCol");
    expect(yCol).not.toBeUndefined();
    if (yCol) {
      expect(table.columnWidth(yCol.id)).toEqual(colWidth);
      table.setColumnWidth(yCol.id, biggerColWidth);
      expect(table.columnWidth(yCol.id)).toEqual(biggerColWidth);
    }
  });

  it("can load a table with a shared data set", () => {
    const tableSnapshot: TableContentSnapshotType = {
      type: "Table",
    };
    const dataSetSnapshot: SharedDataSetSnapshotType = {
      type: "SharedDataSet",
      dataSet: {
        attributes: [
          { name: "xCol", values: [1,2]},
          { name: "yCol", values: [3,4]}
        ],
        cases: [
          {}, {}
        ]
      }
    };
    const table = TableContentModel.create(tableSnapshot);
    const metadata = TableMetadataModel.create({ id: "test-metadata" });
    table.doPostCreate!(metadata);

    setupContainer(table, dataSetSnapshot);

    expect(table.sharedModel).toBeDefined();
    const xCol = table.dataSet.attrFromName("xCol");
    expect(xCol).toBeDefined();
    if (xCol) {
      expect(table.columnWidth(xCol.id)).toEqual(kDefaultColumnWidth);
    }
    const yCol = table.dataSet.attrFromName("yCol");
    expect(yCol).toBeDefined();
    if (yCol) {
      expect(table.columnWidth(yCol.id)).toEqual(kDefaultColumnWidth);
    }
    expect(table.dataSet.cases.length).toBe(2);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, yCol: 3 });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, yCol: 4 });
  });

  it("can load a table with formulas", async () => {
    const tableSnapshot: TableContentSnapshotType = {
      type: "Table",
    };
    const dataSetSnapshot: SharedDataSetSnapshotType = {
      type: "SharedDataSet",
      dataSet: {
        attributes: [
          { name: "xCol", values: [1,2]},
          { name: "yCol", values: [2,4],
            formula: { display: "xCol*2" }
          }
        ],
        cases: [
          {}, {}
        ]
      }
    };
    const table = TableContentModel.create(tableSnapshot);
    const metadata = TableMetadataModel.create({ id: "test-metadata" });
    table.doPostCreate!(metadata);
    // The table won't know about the expressions until it has a dataset
    expect(table.hasExpressions).toBe(false);

    setupContainer(table, dataSetSnapshot);

    expect(table.dataSet.cases.length).toBe(2);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, yCol: 2 });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, yCol: 4 });

    expect(table.hasExpressions).toBe(true);
    const yCol = table.dataSet.attrFromName("yCol");
    expect(yCol).toBeDefined();
    expect(yCol!.formula).toBeDefined();
    expect(yCol!.formula!.display).toBe("xCol*2");
  });

  // This should not happen via the UI, but the data could get corrupted
  // or it could be manually edited
  it("can load a table with invalid formulas", async () => {
    const tableSnapshot: TableContentSnapshotType = {
      type: "Table",
    };
    const dataSetSnapshot: SharedDataSetSnapshotType = {
      type: "SharedDataSet",
      dataSet: {
        attributes: [
          { name: "xCol", values: [1,2]},
          { name: "yCol", values: [2,4],
            formula: { display: "xCol+$1" }
          }
        ],
        cases: [
          {}, {}
        ]
      }
    };
    const table = TableContentModel.create(tableSnapshot);
    const metadata = TableMetadataModel.create({ id: "test-metadata" });
    table.doPostCreate!(metadata);
    // The metadata has not expression info until the table has a dataset
    expect(table.hasExpressions).toBe(false);

    setupContainer(table, dataSetSnapshot);

    // Give the formula system a chance to process the formulas
    // FIXME: need a deterministic way to wait for the formulas to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(table.dataSet.cases.length).toBe(2);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, yCol: "❌ Undefined symbol $1" });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, yCol: "❌ Undefined symbol $1" });

    expect(table.hasExpressions).toBe(true);
    const yCol = table.dataSet.attrFromName("yCol");
    expect(yCol).toBeDefined();
    expect(yCol!.formula).toBeDefined();
    expect(yCol!.formula!.display).toBe("xCol+$1");

    // FIXME: this part of the test started failing after the formula system was updated.
    // metadata.updateDatasetByExpressions(table.dataSet);
    //
    // expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, yCol: NaN });
    // expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, yCol: NaN });
  });

  it("can convert original change format", () => {
    const oldChanges = [
            {
              action: "create",
              target: "columns",
              ids: ["xCol", "yCol"],
              props: [
                { name: "x" },
                { name: "y" }
              ]
            },
            {
              action: "create",
              target: "rows",
              props: [
                { __id__: "row1", xCol: "x1", yCol: "y1" },
                { __id__: "row2", xCol: "x2", yCol: "y2" },
                { __id__: "row3", yCol: "y3" }
              ]
            },
            {
              action: "update",
              target: "rows",
              props: [
                { __id__: "row3", yCol: "y3" }
              ]
            }
          ];
    const snapshot = { changes: oldChanges.map(change => JSON.stringify(change)) };
    const table = TableContentModel.create(snapshot);
    expect(table.type).toBe(kTableTileType);
    expect(table.isImported).toBe(false);
    expect(table.dataSet.attributes.length).toBe(2);
    expect(table.dataSet.cases.length).toBe(3);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ x: "x1", y: "y1" });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ x: "x2", y: "y2" });
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ y: "y3" });
    expect(getCanonicalCaseNoId(table.dataSet, 0)).toEqual({ xCol: "x1", yCol: "y1" });
    expect(getCanonicalCaseNoId(table.dataSet, 1)).toEqual({ xCol: "x2", yCol: "y2" });
    expect(getCanonicalCaseNoId(table.dataSet, 2)).toEqual({ yCol: "y3" });
  });

  it("can import current change format", () => {
    const kTitle = "Current Title";
    const changes = [
            {
              action: "create",
              target: "table",
              ids: ["xCol", "yCol"],
              props: {
                name: kTitle,
                columns: [
                  { name: "x" },
                  { name: "y" }
                ]
              }
            },
            {
              action: "create",
              target: "rows",
              props: {
                rows: [
                  { __id__: "row1", xCol: "x1", yCol: "y1" },
                  { __id__: "row2", xCol: "x2", yCol: "y2" },
                  { __id__: "row3", yCol: "y3" }
                ]
              }
            }
          ];
    const snapshot = { changes: changes.map(change => JSON.stringify(change)) };
    const table = TableContentModel.create(snapshot);
    expect(table.type).toBe(kTableTileType);
    expect(table.isImported).toBe(false);
    expect(table.dataSet.attributes.length).toBe(2);
    expect(table.dataSet.cases.length).toBe(3);
    expect(getCaseNoId(table.dataSet, 0)).toEqual({ x: "x1", y: "y1" });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ x: "x2", y: "y2" });
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ y: "y3" });
    expect(getCanonicalCaseNoId(table.dataSet, 0)).toEqual({ xCol: "x1", yCol: "y1" });
    expect(getCanonicalCaseNoId(table.dataSet, 1)).toEqual({ xCol: "x2", yCol: "y2" });
    expect(getCanonicalCaseNoId(table.dataSet, 2)).toEqual({ yCol: "y3" });
  });

  it("can append changes and apply them to a DataSet", () => {
    const changes = [
            {
              action: "create",
              target: "columns",
              ids: ["xCol", "yCol", "zCol"],
              props: {
                columns: [
                  { name: "x" },
                  { name: "y" },
                  { name: "z" }
                ]
              }
            },
            {
              action: "create",
              target: "rows",
              props: {
                rows: [
                  { __id__: "row1", xCol: "x1", yCol: "y1" },
                  { __id__: "row2", xCol: "x2", yCol: "y2" },
                  { __id__: "row3", yCol: "y3" }
                ]
              }
            }
          ];
    const snapshot = { changes: changes.map(change => JSON.stringify(change)) };
    const table = TableContentModel.create(snapshot);
    const metadata = TableMetadataModel.create({ id: "table-1" });
    table.doPostCreate!(metadata);
    table.setAttributeName("zCol", "newZ");
    expect(table.dataSet.attrFromID("zCol")?.name).toBe("newZ");

    table.setCanonicalCaseValues([{ __id__: "row3", xCol: "x3" }]);
    expect(getCanonicalCaseNoId(table.dataSet, 2)).toEqual({ xCol: "x3", yCol: "y3" });

    table.removeCases(["row1"]);
    expect(table.dataSet.cases.length).toBe(2);
    expect(table.dataSet.getCase("row1")).toBeUndefined();

    table.removeAttributes(["zCol"]);
    expect(table.dataSet.attributes.length).toBe(2);
    expect(table.dataSet.attrFromID("zCol")).toBeUndefined();
    expect(table.dataSet.attrFromName("newZ")).toBeUndefined();

    table.addCanonicalCases([{ __id__: "row4", xCol: "x4", yCol: "y4" }]);
    expect(table.dataSet.cases.length).toBe(3);
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ x: "x4", y: "y4"});
  });

  // FIXME: in this test the formula is not applied after the
  // expression is set. This is because the formula system is not
  // enabled. In other tests this happens in setupContainer.
  it.skip("can apply changes with expressions to a DataSet", async () => {
    const changes = [
            {
              action: "create",
              target: "columns",
              ids: ["xCol", "y1Col", "y2Col"],
              props: {
                columns: [
                  { name: "x" },
                  { name: "y1" },
                  { name: "y2" }
                ]
              }
            },
            {
              action: "create",
              target: "rows",
              props: {
                rows: [
                  { __id__: "row1", xCol: 1 },
                  { __id__: "row2", xCol: 2 },
                  { __id__: "row3", xCol: 3 }
                ]
              }
            }
          ];
    const snapshot = { changes: changes.map(change => JSON.stringify(change)) };
    const table = TableContentModel.create(snapshot);
    const metadata = TableMetadataModel.create({ id: "table-1" });
    table.doPostCreate!(metadata);
    // Commented out because setExpression no longer takes two arguments
    // table.setExpression("y1Col", kSerializedXKey, "x");
    table.setExpression("y2Col", "foo");

    expect(table.dataSet.attributes.length).toBe(3);
    expect(table.dataSet.cases.length).toBe(3);
    expect(table.dataSet.getValue("row1", "y1Col")).toBe(1);
    expect(table.dataSet.getValue("row2", "y1Col")).toBe(2);
    expect(table.dataSet.getValue("row3", "y1Col")).toBe(3);
    expect(table.dataSet.getValue("row1", "y2Col")).toBeNaN();
    expect(table.dataSet.getValue("row2", "y2Col")).toBeNaN();
    expect(table.dataSet.getValue("row3", "y2Col")).toBeNaN();
  });

  // FIXME: formulas do not handle fractional values like 1/2 correctly.
  it.skip("various formulas handle various input types", () => {
    const tableSnapshot: TableContentSnapshotType = {
      type: "Table",
    };
    const dataSetSnapshot: SharedDataSetSnapshotType = {
      type: "SharedDataSet",
      dataSet: {
        attributes: [
          { name: "xCol", values: [1,2,"1/2","a"]},
          { name: "yCol", values: [0,0,    0,  0],
            formula: { display: "xCol*2" }
          },
          { name: "zCol", values: [0,0,    0,  0],
            formula: { display: "xCol" }
          }
        ],
        cases: [
          {}, {}, {}, {}
        ]
      }
    };
    const table = TableContentModel.create(tableSnapshot);
    const metadata = TableMetadataModel.create({ id: "test-metadata" });
    table.doPostCreate!(metadata);
    // The metadata has not expression info until the table has a dataset
    expect(table.hasExpressions).toBe(false);

    setupContainer(table, dataSetSnapshot);

    expect(table.dataSet.cases.length).toBe(4);

    expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1,     yCol: 2,   zCol: 1   });
    expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2,     yCol: 4,   zCol: 2   });
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ xCol: "1/2", yCol: 1,   zCol: 0.5 });
    // Internally the formula engine can handle string inputs to formulas, however
    // CLUE will return NaN for any non numeric input or non numeric output
    expect(getCaseNoId(table.dataSet, 3)).toEqual({ xCol: "a",   yCol: NaN, zCol: NaN });
  });
});
