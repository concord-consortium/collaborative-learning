import { IAnyType, types, castToSnapshot } from "mobx-state-tree";
import { defaultTableContent, kTableTileType, TableContentModel, TableContentModelType,
  TableMetadataModel } from "./table-content";
import { TableContentTableImport } from "./table-import";
import { IDataSet } from "../../data/data-set";
import { kSerializedXKey } from "../../data/expression-utils";
import { kDefaultColumnWidth } from "../../../components/tiles/table/table-types";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ISharedModelManager } from "../../..//models/shared/shared-model-manager";

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

const makeSharedModelManager = (): ISharedModelManager => {
  let sharedDataSet: SharedDataSetType | undefined;
  return {
    isReady: true,
    findFirstSharedModelByType<IT extends IAnyType>(sharedModelType: IT): IT["Type"] | undefined {
      return sharedDataSet;
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
const setupContainer = (content: TableContentModelType) => {
  const sharedModelManager = makeSharedModelManager();
  TestTileContentModelContainer.create(
    { child: castToSnapshot(content) },
    { sharedModelManager }
  );
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

  // Table Remodel 8/9/2022
  // Loading expressions stopped working, and we ran out of time to fix it.
  // We hope to reimplement these tests sometime in the future.
  //
  // it("can import multi-column authored data with expressions", () => {
  //   const kTableTitle = "Table Title";
  //   const importData: TableContentTableImport = {
  //           type: "Table",
  //           name: kTableTitle,
  //           columns: [
  //             { name: "xCol", values: [1, 2, 3] },
  //             { name: "y1", values: ["y-1", "y-2", "y-3"] },
  //             { name: "y2", expression: "xCol + 1" }
  //           ]
  //         };
  //   const table = TableContentModel.create(importData);
  //   const metadata = TableMetadataModel.create({ id: "table-1" });
  //   table.doPostCreate?.(metadata);

  //   expect(table.type).toBe(kTableTileType);
  //   expect(table.isImported).toBe(true);
  //   expect(table.dataSet.name).toBe(kTableTitle);
  //   expect(table.dataSet.attributes.length).toBe(3);
  //   expect(table.dataSet.cases.length).toBe(3);
  //   const y2Attr = table.dataSet.attrFromName("y2");
  //   expect(y2Attr?.formula.display).toBe("xCol + 1");
  //   expect(y2Attr?.formula.canonical).toBe("(__x__ + 1)");

  //   expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, y1: "y-1", y2: 2 });
  //   expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, y1: "y-2", y2: 3 });
  //   expect(getCaseNoId(table.dataSet, 2)).toEqual({ xCol: 3, y1: "y-3", y2: 4 });
  // });

  // it("can import multi-column authored data with invalid expressions", () => {
  //   const kTableTitle = "Table Title";
  //   const importData: TableContentTableImport = {
  //           type: "Table",
  //           name: kTableTitle,
  //           columns: [
  //             { name: "xCol", values: [1, 2, 3] },
  //             { name: "y", expression: "xCol + $1" }  // <== parse error
  //           ]
  //         };
  //   const table = TableContentModel.create(importData);
  //   const metadata = TableMetadataModel.create({ id: "table-1" });
  //   table.doPostCreate!(metadata);

  //   expect(table.type).toBe(kTableTileType);
  //   expect(table.isImported).toBe(true);
  //   const _yAttr = table.dataSet.attrFromName("y");
  //   expect(_yAttr?.formula.display).toBe("xCol + $1");
  //   expect(_yAttr?.formula.canonical).toBe("__x__ + $1");

  //   expect(getCaseNoId(table.dataSet, 0)).toEqual({ xCol: 1, y: NaN });
  //   expect(getCaseNoId(table.dataSet, 1)).toEqual({ xCol: 2, y: NaN });
  //   expect(getCaseNoId(table.dataSet, 2)).toEqual({ xCol: 3, y: NaN });
  // });

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
    expect(getCaseNoId(table.dataSet, 2)).toEqual({ x: "x4", y: "y4" });
  });

  it("can apply changes with expressions to a DataSet", () => {
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
    table.setExpression("y1Col", kSerializedXKey, "x");
    table.setExpression("y2Col", "foo", "foo");

    expect(table.dataSet.attributes.length).toBe(3);
    expect(table.dataSet.cases.length).toBe(3);
    expect(table.dataSet.getValue("row1", "y1Col")).toBe(1);
    expect(table.dataSet.getValue("row2", "y1Col")).toBe(2);
    expect(table.dataSet.getValue("row3", "y1Col")).toBe(3);
    expect(table.dataSet.getValue("row1", "y2Col")).toBeNaN();
    expect(table.dataSet.getValue("row2", "y2Col")).toBeNaN();
    expect(table.dataSet.getValue("row3", "y2Col")).toBeNaN();
  });
});
