import classNames from "classnames";
import { autorun } from "mobx";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { kRowHeight } from "./table-types";

/*
  Table state is stored in content as a sequence of changes/actions.
  This code is responsible for tracking changes in content and maintaining a
  synchronized DataSet model for use by ReactDataGrid and other clients.
 */
export const useModelDataSet = (model: ToolTileModelType) => {
  const dataSet = useRef(DataSet.create());
  const syncedChanges = useRef(0);
  const [columnChanges, setColumnChanges] = useState(0);
  const triggerColumnChange = useCallback(() => setColumnChanges(state => ++state), []);
  const [rowChanges, setRowChanges] = useState(0);
  const triggerRowChange = useCallback(() => setRowChanges(state => ++state), []);

  useEffect(() => {
    const _content = model.content as TableContentModelType;
    const disposer = autorun(() => {
      if (syncedChanges.current < _content.changes.length) {
        const [hasColumnChanges, hasRowChanges] = _content.applyChanges(dataSet.current, syncedChanges.current);
        hasColumnChanges && triggerColumnChange();
        hasRowChanges && triggerRowChange();
        syncedChanges.current = _content.changes.length;
      }
    });
    return () => disposer();
  }, [model.content]);  // eslint-disable-line react-hooks/exhaustive-deps

  const content = model.content as TableContentModelType;
  const className = classNames("rdg-light", { "show-expressions": content.hasExpressions });
  const rowHeight = kRowHeight;
  const headerRowHeight = content.hasExpressions ? 2 * rowHeight : rowHeight;
  return { dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange,
            className, rowHeight, headerRowHeight };
};
