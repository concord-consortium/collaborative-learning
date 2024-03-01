import classNames from "classnames";
import { useCallback, useState } from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { TableContentModelType } from "../../../models/tiles/table/table-content";

export const useModelDataSet = (model: ITileModel, content: TableContentModelType) => {
  const dataSet = content.dataSet;
  const [columnChanges, setColumnChanges] = useState(0);
  const triggerColumnChange = useCallback(() => setColumnChanges(state => ++state), []);
  const [rowChanges, setRowChanges] = useState(0);
  const triggerRowChange = useCallback(() => setRowChanges(state => ++state), []);

  const setTableTitle = useCallback((title: string) => {
    (title != null) && model.setTitleOrContentTitle(title);
    triggerColumnChange();
  }, [model, triggerColumnChange]);

  const className = classNames("rdg-light", { "show-expressions": content.hasExpressions });

  return { dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange,
            className, onSetTableTitle: setTableTitle };
};
