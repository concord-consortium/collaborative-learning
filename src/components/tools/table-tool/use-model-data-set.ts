import { autorun } from "mobx";
import { useEffect, useRef, useState } from "react";
import { DataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

/*
  Table state is stored in content as a sequence of changes/actions.
  This code is responsible for tracking changes in content and maintaining a
  synchronized DataSet model for use by ReactDataGrid and other clients.
 */
export const useModelDataSet = (model: ToolTileModelType) => {
  const dataSet = useRef(DataSet.create());
  const syncedChanges = useRef(0);
  const [columnChanges, setColumnChanges] = useState(0);
  const triggerColumnChange = () => setColumnChanges(state => ++state);
  const [rowChanges, setRowChanges] = useState(0);
  const triggerRowChange = () => setRowChanges(state => ++state);
  useEffect(() => {
    const content = model.content as TableContentModelType;
    const disposer = autorun(() => {
      if (syncedChanges.current < content.changes.length) {
        const [hasColumnChanges, hasRowChanges] = content.applyChanges(dataSet.current, syncedChanges.current);
        hasColumnChanges && triggerColumnChange();
        hasRowChanges && triggerRowChange();
        syncedChanges.current = content.changes.length;
      }
    });
    return () => disposer();
  }, [model.content]);  // eslint-disable-line react-hooks/exhaustive-deps
  return { dataSet, columnChanges, triggerColumnChange, rowChanges };
};
