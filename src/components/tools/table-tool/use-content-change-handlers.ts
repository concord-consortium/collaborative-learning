import { useCallback } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { ILinkProperties, ITileLinkMetadata } from "../../../models/tools/table-link-types";
import { syncTableChangeToLinkedClient } from "../../../models/tools/table-links";
import { getTableContentHeight, TableContentModelType } from "../../../models/tools/table/table-content";
import { isLinkableValue } from "../../../models/tools/table/table-model-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { TColumn } from "./table-types";

export interface IContentChangeHandlers {
  onSetTableTitle: (title: string) => void;
  onSetColumnName: (column: TColumn, columnName: string) => void;
  onSetColumnExpressions: (rawExpressions: Map<string, string>, xName: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  onAddRows: (newCases: ICaseCreation[]) => void;
  onUpdateRow: (caseValues: ICase) => void;
  onRemoveRows: (rowIds: string[]) => void;
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
  onUnlinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}

interface IProps {
  model: ToolTileModelType;
  dataSet: IDataSet;
  readOnly?: boolean;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
  triggerColumnChange: () => void;
  triggerRowChange: () => void;
}
export const useContentChangeHandlers = ({
  model, dataSet, readOnly, onRequestRowHeight, triggerColumnChange, triggerRowChange
}: IProps): IContentChangeHandlers => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);

  /*
   * helper functions
   */
  // link information attached to individual table changes/actions
  const getTableActionLinks = useCallback((newClientId?: string): ILinkProperties | undefined => {
    const linkedClients = getContent().linkedGeometries;
    // if there are no linked clients, then we don't need to attach link info to the action
    if (!linkedClients?.length && !newClientId) return;
    const newClientIds = newClientId ? [newClientId] : [];
    return { tileIds: [...linkedClients, ...newClientIds] };
  }, [getContent]);

  const syncLinkedClients = useCallback((tableActionLinks?: ILinkProperties) => {
    tableActionLinks?.tileIds.forEach(tileId => {
      syncTableChangeToLinkedClient(getContent(), tileId);
    });
  }, [getContent]);

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
                    dataRows: dataSet.cases.length, readOnly, hasExpressions: getContent().hasExpressions
                  });
    onRequestRowHeight({ height });
  }, [dataSet.cases.length, getContent, onRequestRowHeight, readOnly]);

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
    const tableActionLinks = getTableActionLinks();
    getContent().setAttributeName(column.key, columnName, tableActionLinks);
    syncLinkedClients(tableActionLinks);
  }, [readOnly, getTableActionLinks, getContent, syncLinkedClients]);

  const setColumnExpressions = useCallback((rawExpressions: Map<string, string>, xName: string) => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    getContent().setExpressions(rawExpressions, xName, tableActionLinks);
    requestRowHeight();
    syncLinkedClients(tableActionLinks);
  }, [readOnly, getTableActionLinks, getContent, requestRowHeight, syncLinkedClients]);

  const addColumn = useCallback(() => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    const attrId = uniqueId();
    const attrName = uniqueName("y", (name: string) => !dataSet.attrFromName(name));
    getContent().addAttribute(attrId, attrName, tableActionLinks);
    syncLinkedClients(tableActionLinks);
  }, [dataSet, getContent, getTableActionLinks, readOnly, syncLinkedClients]);

  const removeColumn = useCallback((colId: string) => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    getContent().removeAttributes([colId], tableActionLinks);
    syncLinkedClients(tableActionLinks);
  }, [getContent, getTableActionLinks, readOnly, syncLinkedClients]);

  const addRows = useCallback((newCases: ICaseCreation[]) => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    const cases = newCases.map(aCase => validateCase(aCase));
    getContent().addCanonicalCases(cases, undefined, tableActionLinks);
    requestRowHeight();
    syncLinkedClients(tableActionLinks);
  }, [readOnly, getTableActionLinks, getContent, requestRowHeight, syncLinkedClients, validateCase]);

  const updateRow = useCallback((caseValues: ICase) => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    getContent().setCanonicalCaseValues([caseValues], tableActionLinks);
    syncLinkedClients(tableActionLinks);
    triggerRowChange();
  }, [readOnly, getTableActionLinks, getContent, syncLinkedClients, triggerRowChange]);

  const removeRows = useCallback((rowIds: string[]) => {
    if (readOnly) return;
    const tableActionLinks = getTableActionLinks();
    getContent().removeCases(rowIds, tableActionLinks);
    syncLinkedClients(tableActionLinks);
  }, [readOnly, getTableActionLinks, getContent, syncLinkedClients]);

  const linkGeometryTile = useCallback((geomTileInfo: ITileLinkMetadata) => {
    if (!getContent().isValidForGeometryLink()) return;

    // add action to table content
    const tableActionLinks = getTableActionLinks(geomTileInfo.id);
    if (!tableActionLinks) return;
    getContent().addGeometryLink(geomTileInfo.id);
    // sync change to the newly linked client - not all linked clients
    syncTableChangeToLinkedClient(getContent(), geomTileInfo.id);
  }, [getContent, getTableActionLinks]);

  const unlinkGeometryTile = useCallback((geomTileInfo: ITileLinkMetadata) => {
    const tableActionLinks = getTableActionLinks(geomTileInfo.id);
    if (!tableActionLinks) return;
    getContent().removeGeometryLink(geomTileInfo.id);
    syncTableChangeToLinkedClient(getContent(), geomTileInfo.id);
  }, [getContent, getTableActionLinks]);

  return { onSetTableTitle: setTableTitle, onSetColumnName: setColumnName, onSetColumnExpressions: setColumnExpressions,
          onAddColumn: addColumn, onRemoveColumn: removeColumn,
          onAddRows: addRows, onUpdateRow: updateRow, onRemoveRows: removeRows,
          onLinkGeometryTile: linkGeometryTile, onUnlinkGeometryTile: unlinkGeometryTile };
};
