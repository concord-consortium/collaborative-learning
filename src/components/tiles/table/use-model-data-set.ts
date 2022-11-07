import classNames from "classnames";
import { useCallback, useState } from "react";
import { TableContentModelType } from "../../../models/tiles/table/table-content";

export const useModelDataSet = (content: TableContentModelType) => {
  const dataSet = content.dataSet;
  const [columnChanges, setColumnChanges] = useState(0);
  const triggerColumnChange = useCallback(() => setColumnChanges(state => ++state), []);
  const [rowChanges, setRowChanges] = useState(0);
  const triggerRowChange = useCallback(() => setRowChanges(state => ++state), []);

  const setTableTitle = useCallback((title: string) => {
    (title != null) && content.setTableName(title);
    triggerColumnChange();
  }, [content, triggerColumnChange]);

  const className = classNames("rdg-light", { "show-expressions": content.hasExpressions });

  return { dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange,
            className, onSetTableTitle: setTableTitle };
};
