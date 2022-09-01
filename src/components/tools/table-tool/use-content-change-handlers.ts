import { useCallback } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { ITileLinkMetadata } from "../../../models/tools/table-link-types";
import { requestGeometryLinkToTable, requestGeometryUnlinkFromTable } from "../../../models/tools/table-links";
import { getTableContentHeight, TableContentModelType } from "../../../models/tools/table/table-content";
import { isLinkableValue } from "../../../models/tools/table/table-model-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { TColumn, TRow } from "./table-types";

export interface IContentChangeHandlers {
  onSetTableTitle: (title: string) => void;
  onSetColumnName: (column: TColumn, columnName: string) => void;
  onSetColumnExpressions: (rawExpressions: Map<string, string>, xName: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  requestRowHeight: () => void;
  onAddRows: (newCases: ICaseCreation[]) => void;
  onUpdateRow: (caseValues: ICase) => void;
  onRemoveRows: (rowIds: string[]) => void;
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
  onUnlinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}

interface IProps {
  model: ToolTileModelType;
  dataSet: IDataSet;
  rows: TRow[];
  readOnly?: boolean;
  rowHeight: (args: any) => number;
  headerHeight: () => number;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
  triggerColumnChange: () => void;
  triggerRowChange: () => void;
}
export const useContentChangeHandlers = ({
  model, dataSet, rows, readOnly, rowHeight, headerHeight, onRequestRowHeight, triggerColumnChange, triggerRowChange
}: IProps): IContentChangeHandlers => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);

  /*
   * helper functions
   */
  const validateCase = useCallback((aCase: ICaseCreation) => {
    const newCase: ICaseCreation = { __id__: uniqueId() };
    if (getContent().isLinked) {
      // validate linkable values
      dataSet.attributes.forEach(attr => {
        const value = aCase[attr.id];
        newCase[attr.id] = isLinkableValue(value) ? value : 0;
      });
      return newCase;
    }
    return { ...newCase, ...aCase };
  }, [dataSet.attributes, getContent]);

  const requestRowHeight = useCallback(() => {
    const height = getTableContentHeight({
                    rows, readOnly, rowHeight, headerHeight, hasExpressions: getContent().hasExpressions
                  });
    onRequestRowHeight({ height });
  }, [rows, getContent, rowHeight, headerHeight, onRequestRowHeight, readOnly]);

  /*
   * content change functions
   */
  const setTableTitle = useCallback((title: string) => {
    if (readOnly) return;
    (title != null) && getContent().setTableName(title);
    triggerColumnChange();
  }, [getContent, readOnly, triggerColumnChange]);

  const setColumnName = useCallback((column: TColumn, columnName: string) => {
    if (readOnly) return;
    getContent().setAttributeName(column.key, columnName);
  }, [readOnly, getContent]);

  const setColumnExpressions = useCallback((rawExpressions: Map<string, string>, xName: string) => {
    if (readOnly) return;
    getContent().setExpressions(rawExpressions, xName);
    requestRowHeight();
  }, [readOnly, getContent, requestRowHeight]);

  const addColumn = useCallback(() => {
    if (readOnly) return;
    const attrId = uniqueId();
    const attrName = uniqueName("y", (name: string) => !dataSet.attrFromName(name));
    getContent().addAttribute(attrId, attrName);
  }, [dataSet, getContent, readOnly]);

  const removeColumn = useCallback((colId: string) => {
    if (readOnly) return;
    getContent().removeAttributes([colId]);
  }, [getContent, readOnly]);

  const addRows = useCallback((newCases: ICaseCreation[]) => {
    if (readOnly) return;
    const cases = newCases.map(aCase => validateCase(aCase));
    getContent().addCanonicalCases(cases, undefined);
    requestRowHeight();
  }, [readOnly, getContent, requestRowHeight, validateCase]);

  const updateRow = useCallback((caseValues: ICase) => {
    if (readOnly) return;
    getContent().setCanonicalCaseValues([caseValues]);
    triggerRowChange();
  }, [readOnly, getContent, triggerRowChange]);

  const removeRows = useCallback((rowIds: string[]) => {
    if (readOnly) return;
    getContent().removeCases(rowIds);
  }, [readOnly, getContent]);

  const linkGeometryTile = useCallback((geomTileInfo: ITileLinkMetadata) => {
    !readOnly && requestGeometryLinkToTable(getContent(), geomTileInfo.id);
  }, [getContent, readOnly]);

  const unlinkGeometryTile = useCallback((geomTileInfo: ITileLinkMetadata) => {
    !readOnly && requestGeometryUnlinkFromTable(getContent(), geomTileInfo.id);
  }, [getContent, readOnly]);

  return { onSetTableTitle: setTableTitle, onSetColumnName: setColumnName, onSetColumnExpressions: setColumnExpressions,
          onAddColumn: addColumn, onRemoveColumn: removeColumn, requestRowHeight,
          onAddRows: addRows, onUpdateRow: updateRow, onRemoveRows: removeRows,
          onLinkGeometryTile: linkGeometryTile, onUnlinkGeometryTile: unlinkGeometryTile };
};
