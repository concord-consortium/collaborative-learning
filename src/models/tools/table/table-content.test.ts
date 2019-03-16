import { defaultTableContent, kTableToolID, TableContentModel, convertImportToChanges,
  TableMetadataModel } from "./table-content";
import { DataSet } from "../../data/data-set";
import { safeJsonParse } from "../../../utilities/js-utils";
import { values } from "lodash";

describe("TableContent", () => {

  it("can create empty/default TableContentModels", () => {
    const emptyTable = TableContentModel.create();
    expect(emptyTable.type).toBe(kTableToolID);
    expect(emptyTable.isImported).toBe(false);
    expect(emptyTable.changes.length).toBe(0);
    expect(emptyTable.isUserResizable).toBe(true);

    const defaultTable = TableContentModel.create(defaultTableContent());
    expect(defaultTable.type).toBe(kTableToolID);
    expect(defaultTable.isImported).toBe(true);
    expect(defaultTable.changes.length).toBe(1);
    expect(emptyTable.isUserResizable).toBe(true);
  });

  it("can import authored data", () => {
    const importData: any = {
            type: "Table",
            columns: [
              { name: "xCol", values: ["x1", "x2"] },
              { name: "yCol", values: ["y1", "y2", "y3"] }
            ]
          };
    const table = TableContentModel.create(importData);
    expect(table.type).toBe(kTableToolID);
    expect(table.isImported).toBe(true);
    expect(table.changes.length).toBe(2);

    const change1 = safeJsonParse(table.changes[0]);
    expect(change1).toBeDefined();
    expect(change1.action).toBe("create");
    expect(change1.target).toBe("columns");
    expect(change1.props).toBeDefined();
    expect(change1.props.columns).toBeDefined();
    expect(change1.props.columns.length).toBe(2);
    expect(change1.props.columns[0].name).toBe("xCol");
    expect(change1.props.columns[1].name).toBe("yCol");

    const change2 = safeJsonParse(table.changes[1]);
    expect(change2).toBeDefined();
    expect(change2.action).toBe("create");
    expect(change2.target).toBe("rows");
    expect(change2.props).toBeDefined();
    expect(change2.props.rows).toBeDefined();
    expect(change2.props.rows.length).toBe(3);
    expect(change2.props.rows[0].__id__).toBeDefined();
    expect(values(change2.props.rows[0]).indexOf("x1") >= 0).toBe(true);
    expect(values(change2.props.rows[0]).indexOf("y1") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("x2") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("y2") >= 0).toBe(true);
    expect(values(change2.props.rows[2]).indexOf("x3") >= 0).toBe(false);
    expect(values(change2.props.rows[2]).indexOf("y3") >= 0).toBe(true);

    expect(convertImportToChanges(undefined as any)).toEqual([]);
    expect(convertImportToChanges({})).toEqual([]);
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
    expect(table.type).toBe(kTableToolID);
    expect(table.isImported).toBe(false);
    expect(table.changes.length).toBe(3);

    const change1 = safeJsonParse(table.changes[0]);
    expect(change1).toBeDefined();
    expect(change1.action).toBe("create");
    expect(change1.target).toBe("columns");
    expect(change1.ids).toEqual(["xCol", "yCol"]);
    expect(change1.props).toBeDefined();
    expect(change1.props.columns).toBeDefined();
    expect(change1.props.columns.length).toBe(2);
    expect(change1.props.columns[0]).toEqual({ name: "x" });
    expect(change1.props.columns[1]).toEqual({ name: "y" });

    const change2 = safeJsonParse(table.changes[1]);
    expect(change2).toBeDefined();
    expect(change2.action).toBe("create");
    expect(change2.target).toBe("rows");
    expect(change2.props).toBeDefined();
    expect(change2.props.rows).toBeDefined();
    expect(change2.props.rows.length).toBe(3);
    expect(change2.props.rows[0].__id__).toBeDefined();
    expect(values(change2.props.rows[0]).indexOf("x1") >= 0).toBe(true);
    expect(values(change2.props.rows[0]).indexOf("y1") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("x2") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("y2") >= 0).toBe(true);
    expect(values(change2.props.rows[2]).indexOf("x3") >= 0).toBe(false);
    expect(values(change2.props.rows[2]).indexOf("y3") >= 0).toBe(true);
  });

  it("can read current change format", () => {
    const changes = [
            {
              action: "create",
              target: "columns",
              ids: ["xCol", "yCol"],
              props: {
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
    expect(table.type).toBe(kTableToolID);
    expect(table.isImported).toBe(false);
    expect(table.changes.length).toBe(2);

    const change1 = safeJsonParse(table.changes[0]);
    expect(change1).toBeDefined();
    expect(change1.action).toBe("create");
    expect(change1.target).toBe("columns");
    expect(change1.ids).toEqual(["xCol", "yCol"]);
    expect(change1.props).toBeDefined();
    expect(change1.props.columns).toBeDefined();
    expect(change1.props.columns.length).toBe(2);
    expect(change1.props.columns[0]).toEqual({ name: "x" });
    expect(change1.props.columns[1]).toEqual({ name: "y" });

    const change2 = safeJsonParse(table.changes[1]);
    expect(change2).toBeDefined();
    expect(change2.action).toBe("create");
    expect(change2.target).toBe("rows");
    expect(change2.props).toBeDefined();
    expect(change2.props.rows).toBeDefined();
    expect(change2.props.rows.length).toBe(3);
    expect(change2.props.rows[0].__id__).toBeDefined();
    expect(values(change2.props.rows[0]).indexOf("x1") >= 0).toBe(true);
    expect(values(change2.props.rows[0]).indexOf("y1") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("x2") >= 0).toBe(true);
    expect(values(change2.props.rows[1]).indexOf("y2") >= 0).toBe(true);
    expect(values(change2.props.rows[2]).indexOf("x3") >= 0).toBe(false);
    expect(values(change2.props.rows[2]).indexOf("y3") >= 0).toBe(true);
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
    table.doPostCreate(metadata);
    table.setAttributeName("zCol", "newZ");
    expect(table.changes.length).toBe(3);
    const change3 = safeJsonParse(table.changes[2]);
    expect(change3.action).toBe("update");
    expect(change3.target).toBe("columns");
    expect(change3.ids).toBe("zCol");
    expect(change3.props).toEqual({ name: "newZ" });

    table.setCanonicalCaseValues([{ __id__: "row3", xCol: "x3" }]);
    expect(table.changes.length).toBe(4);
    const change4 = safeJsonParse(table.changes[3]);
    expect(change4.action).toBe("update");
    expect(change4.target).toBe("rows");
    expect(change4.props).toEqual([{ xCol: "x3" }]);

    table.removeCases(["row1"]);
    expect(table.changes.length).toBe(5);
    const change5 = safeJsonParse(table.changes[4]);
    expect(change5.action).toBe("delete");
    expect(change5.target).toBe("rows");
    expect(change5.ids).toEqual(["row1"]);

    table.removeAttributes(["zCol"]);
    expect(table.changes.length).toBe(6);
    const change6 = safeJsonParse(table.changes[5]);
    expect(change6.action).toBe("delete");
    expect(change6.target).toBe("columns");
    expect(change6.ids).toEqual(["zCol"]);

    table.addCanonicalCases([{ __id__: "row4", xCol: "x4", yCol: "y4" }]);
    expect(table.changes.length).toBe(7);
    const change7 = safeJsonParse(table.changes[6]);
    expect(change7.action).toBe("create");
    expect(change7.target).toBe("rows");
    expect(change7.ids).toEqual(["row4"]);

    const dataSet = DataSet.create();
    table.applyChanges(dataSet);
    expect(dataSet.attributes.length).toBe(2);
    expect(dataSet.cases.length).toBe(3);

    const dataSet2 = DataSet.create();
    table.applyChanges(dataSet2, 0);
    expect(dataSet2.attributes.length).toBe(2);
    expect(dataSet2.cases.length).toBe(3);
  });
});
