import classNames from "classnames";
import { useCallback, useState } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { kRowHeight } from "./table-types";

export const useModelDataSet = (model: ToolTileModelType) => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const dataSet = useCurrent(getContent().dataSet);
  const [columnChanges, setColumnChanges] = useState(0);
  const triggerColumnChange = useCallback(() => setColumnChanges(state => ++state), []);
  const [rowChanges, setRowChanges] = useState(0);
  const triggerRowChange = useCallback(() => setRowChanges(state => ++state), []);

  const setTableTitle = useCallback((title: string) => {
    (title != null) && getContent().setTableName(title);
    triggerColumnChange();
  }, [getContent, triggerColumnChange]);

  const content = getContent();
  const className = classNames("rdg-light", { "show-expressions": content.hasExpressions });

  const headerRowHeight = content.hasExpressions ? 2 * kRowHeight : kRowHeight;
  return { dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange,
            className, headerRowHeight, onSetTableTitle: setTableTitle };
};
