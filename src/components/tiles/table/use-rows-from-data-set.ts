import { useMemo } from "react";
import classNames from "classnames";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, TRow } from "./table-types";

interface IUseRowsFromDataSet {
  dataSet: IDataSet;
  readOnly: boolean;
  inputRowId: string;
  rowChanges: number;
  context: IGridContext;
}

const canonicalize = (dataSet: IDataSet, row: TRow) => {
  // ReactDataGrid currently doesn't like editing undefined values,
  // so we convert them to empty strings when building rows.
  if (row) {
    dataSet.attributes.forEach(attr => {
      if (row[attr.id] == null) {
        row[attr.id] = "";
      }
    });
  }
  return row;
};

export const useRowsFromDataSet = ({ dataSet, readOnly, inputRowId, rowChanges, context }: IUseRowsFromDataSet) => {
  return useMemo(() => {
    const rowKeyGetter = (row: TRow) => row.__id__;
    const rowClass = (row: TRow) => {
      const rowId = row.__id__;
      return classNames({
        highlighted: dataSet.isCaseHighlighted(rowId),
        "input-row": rowId === inputRowId
      });
    };
    const _rows = dataSet.getCanonicalCasesAtIndices();
    const rows = _rows.map((_case, i) => canonicalize(dataSet, {
                          __index__: i + 1,
                          __context__: context,
                          ..._case } as TRow));
    !readOnly && rows.push(canonicalize(dataSet, { __id__: inputRowId, __context__: context }));
    rowChanges; // eslint-disable-line no-unused-expressions
    return { rows, rowKeyGetter, rowClass };
  }, [context, dataSet, inputRowId, readOnly, rowChanges]);
};
