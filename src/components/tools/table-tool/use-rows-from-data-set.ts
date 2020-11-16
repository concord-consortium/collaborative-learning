import { useMemo } from "react";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, TRow } from "./grid-types";

export const useRowsFromDataSet = (dataSet: IDataSet, rowChanges: number, context: IGridContext) => {
  return useMemo(() => {
    rowChanges; // eslint-disable-line no-unused-expressions
    return dataSet.getCanonicalCasesAtIndices()
                  .map((row, i) => ({
                    __index__: i + 1,
                    __context__: context,
                    ...row })) as TRow[];
  }, [context, dataSet, rowChanges]);
};
