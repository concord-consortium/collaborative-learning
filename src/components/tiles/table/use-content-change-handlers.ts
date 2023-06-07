import { useCallback } from "react";
import { getTableContentHeight } from "./table-utils";
import { useCurrent } from "../../../hooks/use-current";
import { ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { isLinkableValue } from "../../../models/tiles/table/table-model-types";
import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";
import { ITileModel } from "../../../models/tiles/tile-model";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { TColumn, TRow } from "./table-types";
import { getTileContentById } from "../../../utilities/mst-utils";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { getTileContentInfo } from "../../../models/tiles/tile-content-info";

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
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
}

interface IProps {
  model: ITileModel;
  dataSet: IDataSet;
  rows: TRow[];
  readOnly?: boolean;
  rowHeight: (args: any) => number;
  headerHeight: () => number;
  getTitleHeight: () => number;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
  triggerColumnChange: () => void;
  triggerRowChange: () => void;
}
export const useContentChangeHandlers = ({
  model, dataSet, rows, readOnly, rowHeight, headerHeight, getTitleHeight, onRequestRowHeight, triggerColumnChange,
  triggerRowChange
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
      rows, readOnly, rowHeight, headerHeight, getTitleHeight, hasExpressions: getContent().hasExpressions
    });
    onRequestRowHeight({ height });
  }, [rows, getContent, rowHeight, headerHeight, getTitleHeight, onRequestRowHeight, readOnly]);

  /*
   * content change functions
   */
  const setTableTitle = useCallback((title: string) => {
    if (readOnly) return;
    (title != null) && model.setTitle(title);
    triggerColumnChange();
  }, [model, readOnly, triggerColumnChange]);

  const setColumnName = useCallback((column: TColumn, columnName: string) => {
    if (readOnly) return;
    dataSet.setAttributeName(column.key, columnName);
    requestRowHeight();
  }, [readOnly, dataSet, requestRowHeight]);

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
    requestRowHeight();
  }, [readOnly, getContent, triggerRowChange, requestRowHeight]);

  const removeRows = useCallback((rowIds: string[]) => {
    if (readOnly) return;
    getContent().removeCases(rowIds);
  }, [readOnly, getContent]);

  const linkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const consumerTile = getTileContentById(getContent(), tileInfo.id);
    if (!readOnly && consumerTile) {
      const sharedModelManager = consumerTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        // If the consumer tile does not support multiple shared data sets, remove it from
        // any existing shared data set before linking.
        if (!getTileContentInfo(consumerTile.type)?.supportsMultipleDataSets) {
          const existingSharedTable = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileInfo.id);
          if (existingSharedTable) {
            sharedModelManager?.removeTileSharedModel(consumerTile, existingSharedTable);
          }
        }
        const sharedTable = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, modelRef.current.id);
        sharedTable && sharedModelManager?.addTileSharedModel(consumerTile, sharedTable);
      }
    }
  }, [getContent, readOnly, modelRef]);

  const unlinkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const consumerTile = getTileContentById(getContent(), tileInfo.id);
    if (!readOnly && consumerTile) {
      const sharedModelManager = consumerTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        const sharedTable = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, modelRef.current.id);
        sharedTable && sharedModelManager?.removeTileSharedModel(consumerTile, sharedTable);
      }
    }
  }, [getContent, readOnly, modelRef]);

  return { onSetTableTitle: setTableTitle, onSetColumnName: setColumnName, onSetColumnExpressions: setColumnExpressions,
          onAddColumn: addColumn, onRemoveColumn: removeColumn, requestRowHeight,
          onAddRows: addRows, onUpdateRow: updateRow, onRemoveRows: removeRows,
          onLinkTile: linkTile, onUnlinkTile: unlinkTile };
};
