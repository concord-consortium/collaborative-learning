import { types, Instance } from "mobx-state-tree";
import { IDataSet, ICaseCreation, ICase } from "../../data/data-set";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { assign, castArray, each } from "lodash";

export const kTableToolID = "Table";

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

export interface ITableProperties {
  [prop: string]: any;
}

export interface ITableChange {
  action: "create" | "update" | "delete";
  target: "rows" | "columns";
  ids?: string | string[];
  props?: ITableProperties | ITableProperties[];
  others?: ITableProperties;
}

export const TableContentModel = types
  .model("TableContent", {
    type: types.optional(types.literal(kTableToolID), kTableToolID),
    isImported: false,
    changes: types.array(types.string)
  })
  .preProcessSnapshot(snapshot => {
    if (snapshot && (snapshot as any).columns) {
      return { isImported: true, changes: convertImportToChanges(snapshot) };
    }
    return snapshot;
  })
  .actions(self => ({
    appendChange(change: ITableChange) {
      self.changes.push(JSON.stringify(change));
    }
  }))
  .actions(self => ({
    setAttributeName(attributeId: string, name: string) {
      self.appendChange({
              action: "update",
              target: "columns",
              ids: attributeId,
              props: { name }
            });
    },
    addCanonicalCases(cases: ICaseCreation[], beforeID?: string | string[]) {
      self.appendChange({
            action: "create",
            target: "rows",
            ids: cases.map(aCase => aCase.__id__ || uniqueId()),
            props: cases.map(aCase => {
                    const { __id__, ...others } = aCase;
                    return { ...others };
                  }),
            others: { beforeId: beforeID }
          });
    },
    setCanonicalCaseValues(caseValues: ICase) {
      const { __id__, ...values } = caseValues;
      self.appendChange({
            action: "update",
            target: "rows",
            ids: __id__,
            props: values
      });
    },
    removeCases(ids: string[]) {
      self.appendChange({
            action: "delete",
            target: "rows",
            ids
          });
    }
  }))
  .actions(self => ({
    applyCreate(dataSet: IDataSet, change: ITableChange) {
      switch (change.target) {
        case "columns":
          const columns = change && change.props;
          columns && columns.forEach((col: any) => {
            const { id, ...others } = col;
            dataSet.addAttributeWithID({ id: id || uniqueId(), ...others });
          });
          break;
        case "rows":
          const rows = change && change.props &&
                        change.props.map((row: any, index: number) => {
                          const id = change.ids && change.ids[index] || uniqueId();
                          return { __id__: id, ...row };
                        });
          if (rows && rows.length) {
            dataSet.addCanonicalCasesWithIDs(rows);
          }
          break;
      }
    },
    applyUpdate(dataSet: IDataSet, change: ITableChange) {
      const ids = castArray(change.ids);
      switch (change.target) {
        case "columns":
          const colProps = change && change.props && castArray(change.props);
          colProps && colProps.forEach((col: any, colIndex) => {
            each(col, (value, prop) => {
              switch (prop) {
                case "name":
                  dataSet.setAttributeName(ids[colIndex], value);
                  break;
              }
            });
          });
          break;
        case "rows":
          const rowProps = change && change.props && castArray(change.props);
          rowProps && rowProps.forEach((row: any, rowIndex) => {
            dataSet.setCanonicalCaseValues([{ __id__: ids[rowIndex], ...row }]);
          });
          break;
      }
    },
    applyDelete(dataSet: IDataSet, change: ITableChange) {
      const ids = change && castArray(change.ids);
      switch (change.target) {
        case "columns":
          if (ids && ids.length) {
            ids.forEach(id => dataSet.removeAttribute(id));
          }
          break;
        case "rows":
          if (ids && ids.length) {
            dataSet.removeCases(ids);
          }
          break;
      }
    }
  }))
  .actions(self => ({
    applyChange(dataSet: IDataSet, change: ITableChange) {
      switch (change.action) {
        case "create":
          return self.applyCreate(dataSet, change);
        case "update":
          return self.applyUpdate(dataSet, change);
        case "delete":
          return self.applyDelete(dataSet, change);
      }
    }
  }))
  .actions(self => ({
    applyChanges(dataSet: IDataSet, start: number = 0) {
      for (let i = start; i < self.changes.length; ++i) {
        const change = safeJsonParse(self.changes[i]);
        if (change) {
          self.applyChange(dataSet, change);
        }
      }
    }
  }));

export type TableContentModelType = Instance<typeof TableContentModel>;

export function convertImportToChanges(snapshot: any) {
  const columns = snapshot.columns as any[];
  if (!columns) return [] as string[];

  // create columns
  const changes: ITableChange[] = [];
  const columnProps = columns.map((col: any) => ({ id: uniqueId(), name: col.name }));
  if (columnProps.length) {
    changes.push({ action: "create", target: "columns", props: columnProps });
  }

  // create rows
  const rowCount = columns.reduce((max, col) => {
                            const len = col.values && col.values.length || 0;
                            return Math.max(max, len);
                          }, 0);
  const rows: any[] = [];
  for (let i = 0; i < rowCount; ++i) {
    const row: any = { __id__: uniqueId() };
    columnProps.forEach((col: any, colIndex) => {
      const values = columns[colIndex].values;
      if (col && col.id && i < values.length) {
        row[col.id] = values[i];
      }
    });
    rows.push(row);
  }
  if (rows.length) {
    changes.push({ action: "create", target: "rows", props: rows });
  }
  return changes.map(change => JSON.stringify(change));
}
