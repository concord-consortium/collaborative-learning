import { castArray, each } from "lodash";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { addCasesToDataSet, DataSet, ICaseCreation, IDataSet } from "../../data/data-set";
import {
  ICreateColumnsProperties, ICreateRowsProperties, ICreateTableProperties, IEarlyTableCreateChange, IRowProperties,
  isEarlyCreateColumnsChange, isEarlyCreateRowsChange, ITableChange, IUpdateColumnsProperties, IUpdateTableProperties
} from "./table-change";

export interface TableContentColumnImport {
  name: string;
  width?: number;
  // user-editable expression for y variable in terms of x variable by name
  // corresponds to rawExpression in the internal model
  expression?: string;
  values?: Array<number | string>;
}
export interface TableContentTableImport {
  type: "Table";
  name: string;
  columns?: TableContentColumnImport[];
  columnWidths?: Record<string, number>;
}

export function isTableImportSnapshot(snapshot: any): snapshot is TableContentTableImport {
  return (snapshot.type === "Table") && !!snapshot.columns;
}

export function convertImportToSnapshot(snapshot: TableContentTableImport):
  { dataSet: IDataSet, columnWidths: Record<string, number> }
{
  const columnWidths: Record<string, number> = {};
  const dataSet = DataSet.create();
  const columns = snapshot?.columns;
  if (!columns) {
    // Legacy snapshots included the dataset within the columns property.
    // Modern snapshots do not include most column information,
    // because that information is stored in separate shared models.
    // However, column widths must be stored in the table snapshot.
    const _columnWidths = snapshot?.columnWidths;
    if (_columnWidths) {
      for (const [attrId, width] of Object.entries(_columnWidths)) {
        columnWidths[attrId] = width;
      }
    }
    return { dataSet, columnWidths };
  }

  // set the name
  snapshot?.name && (dataSet.setName(snapshot?.name));

  // create the desired number of empty cases
  const caseCount = columns.reduce((max, col) => Math.max(max, col.values?.length || 0), 0);
  const cases: ICaseCreation[] = [];
  for (let i = 0; i < caseCount; ++i) {
    cases.push({});
  }
  (caseCount > 0) && addCasesToDataSet(dataSet, cases);

  // add the attributes (which will flesh out the cases internally)
  columns.forEach((col, index) => {
    const { name, expression: formula, values } = col;
    const id = uniqueId();
    dataSet.addAttributeWithID({ id, name, formula, values });
    if (col.width) {
      columnWidths[id] = col.width;
    }
  });

  return { dataSet, columnWidths };
}

function migrateChange(change: ITableChange | IEarlyTableCreateChange): ITableChange {
  if (isEarlyCreateColumnsChange(change)) {
    const { ids, props, ...others } = change;
    const idsProp = !ids || Array.isArray(ids) ? ids : [ids];
    const colProps = Array.isArray(props) ? props : [props];
    return { ids: idsProp, props: { columns: colProps }, ...others };
  }
  if (isEarlyCreateRowsChange(change)) {
    const { ids, props, ...others } = change;
    const idsProp = !ids || Array.isArray(ids) ? ids : [ids];
    const rowProps = Array.isArray(props) ? props : [props];
    return { ids: idsProp, props: { rows: rowProps }, ...others };
  }
  return change;
}

function applyCreate(dataSet: IDataSet, change: ITableChange) {
  switch (change.target) {
    case "table": {
      const props = change?.props as ICreateTableProperties;
      (props?.name != null) && dataSet.setName(props.name);
    }
    // fallthrough
    case "columns": {
      const props = change?.props as ICreateColumnsProperties;
      props?.columns?.forEach((col, index) => {
        const id = col.id || change.ids?.[index] || uniqueId();
        const { expression, rawExpression, ...otherCol } = col;
        dataSet.addAttributeWithID({ id, formula: rawExpression, ...otherCol });
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
      }
      break;
    }
  }
}

function applyUpdate(dataSet: IDataSet, change: ITableChange) {
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
        const attr = dataSet.attrFromID(colId);
        if (attr) {
          each(col, (value, prop) => {
            const _value = value as string;
            switch (prop) {
              case "name": {
                dataSet.setAttributeName(colId, _value);
                break;
              }
              // TODO: do we need to track canonical expressions?
              // case "expression":
              //   attr.formula.setCanonical(_value);
              //   break;
              case "rawExpression":
                attr.formula.setDisplayExpression(_value);
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
      }
      break;
    }
  }
}

function applyDelete(dataSet: IDataSet, change: ITableChange) {
  const ids = change && castArray(change.ids);
  switch (change.target) {
    case "columns":
      if (ids?.length) {
        ids.forEach(id => {
          dataSet.removeAttribute(id);
        });
      }
      break;
    case "rows":
      if (ids?.length) {
        dataSet.removeCases(ids);
      }
      break;
  }
}

function applyChange(dataSet: IDataSet, change: ITableChange) {
  switch (change.action) {
    case "create":
      return applyCreate(dataSet, change);
    case "update":
      return applyUpdate(dataSet, change);
    case "delete":
      return applyDelete(dataSet, change);
  }
}

export function applyChangesToDataSet(dataSet: IDataSet, changes: string[]) {
  changes.forEach(jsonChange => {
    const change = safeJsonParse<ITableChange>(jsonChange);
    if (change) {
      applyChange(dataSet, migrateChange(change));
    }
  });
}

export function convertChangesToSnapshot(changes: string[]) {
  const dataSet = DataSet.create();
  applyChangesToDataSet(dataSet, changes);

  const linksMap = new Set<string>();
  changes.forEach(jsonChange => {
    const change = safeJsonParse<ITableChange>(jsonChange);
    if (change && (change.target === "geometryLink")) {
      const { action, ids } = change;
      castArray(ids).forEach(id => {
        if (action === "create") {
          linksMap.add(id);
        }
        else if (action === "delete") {
          linksMap.delete(id);
        }
      });
    }
  });
  return { dataSet };
}

export function convertLegacyDataSet(snapshot: any) {
  const { dataSet, ...rest } = snapshot;
  if (dataSet) {
    return { importedDataSet: dataSet, ...rest };
  }
  return snapshot;
}
