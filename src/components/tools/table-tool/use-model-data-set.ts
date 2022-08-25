import classNames from "classnames";
import { useCallback, useState } from "react";
import { measureTextLines } from "../hooks/use-measure-text";
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

  const textHeight = (cellId: string, text: string) => {
    if (text) {
      const height = measureTextLines(text, 80) * kRowHeight;
      return height;
    }
    return kRowHeight;
  };
  const rowHeight = (args: any) => {
    let height = kRowHeight;
    if (args.row) {
      for (const [cellId, text] of Object.entries(args.row)) {
        if (cellId !== '__context__' && cellId !== '__id__' && cellId !== '__index__') {
          height = Math.max(height, textHeight(cellId, text as string));
        }
      }
    }
    return height;
  };

  const headerRowHeight = content.hasExpressions ? 2 * kRowHeight : kRowHeight;
  return { dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange,
            className, rowHeight, headerRowHeight, onSetTableTitle: setTableTitle };
};
