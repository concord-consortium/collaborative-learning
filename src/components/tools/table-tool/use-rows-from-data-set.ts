import { useMemo } from "react";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, TRow } from "./grid-types";

interface IUseRowsFromDataSet {
  dataSet: IDataSet;
  readOnly: boolean;
  inputRowId: string;
  rowChanges: number;
  context: IGridContext;
}
export const useRowsFromDataSet = ({ dataSet, readOnly, inputRowId, rowChanges, context }: IUseRowsFromDataSet) => {
  return useMemo(() => {
    const rowKeyGetter = (row: TRow) => row.__id__;
    const rowClass = (row: TRow) => row.__id__ === inputRowId ? "input-row" : undefined;
    const rows = dataSet.getCanonicalCasesAtIndices()
                        .map((row, i) => ({
                          __index__: i + 1,
                          __context__: context,
                          ...row })) as TRow[];
    !readOnly && rows.push({ __id__: inputRowId, __context__: context });
    rowChanges; // eslint-disable-line no-unused-expressions
    return { rows, rowKeyGetter, rowClass };
  }, [context, dataSet, inputRowId, readOnly, rowChanges]);
};
