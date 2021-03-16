import { useCallback } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { ILinkProperties, ITableChange } from "../../../models/tools/table/table-change";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { isLinkableValue, ITileLinkMetadata } from "../../../models/tools/table/table-model-types";
import { GeometryMetadataModelType, getGeometryContent, IAxisLabels } from "../../../models/tools/geometry/geometry-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { safeJsonParse, uniqueId, uniqueName } from "../../../utilities/js-utils";

export interface IContentChangeHandlers {
  onLinkTableTile: (tableTileInfo: ITileLinkMetadata) => void;
  onUnlinkTableTile: (tableTileInfo: ITileLinkMetadata) => void;
}

interface IProps {
  model: ToolTileModelType;
  dataSet?: IDataSet;
  readOnly?: boolean;
}
export const useContentChangeHandlers = ({
  model, dataSet, readOnly
}: IProps): IContentChangeHandlers => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as unknown as GeometryMetadataModelType, [modelRef]);

  /*
   * helper functions
   */
  // link information attached to individual table changes/actions
  const getGeometryActionLinks = useCallback((newClientId?: string): ILinkProperties | undefined => {
    const linkedClients = getContent().linkedTables;
    // if there are no linked clients, then we don't need to attach link info to the action
    if (!linkedClients?.length && !newClientId) return;
    // id is used to link actions across tiles
    const actionId = uniqueId();
    const newClientIds = newClientId ? [newClientId] : [];
    // return { id: actionId, tileIds: [...linkedClients, ...newClientIds] };
    return { id: actionId, tileIds: newClientIds};

  }, [getContent]);

//   const syncChangeToLinkedClient = useCallback((clientTileId: string, linkId: string) => {
//     const geometryContent = getContent();
//     // const lastChange: ITableChange | undefined = safeJsonParse(tableContent.changes[tableContent.changes.length - 1]);
//     // eventually we'll presumably need to support other clients
//     // const clientContent = getGeometryContent(getContent(), clientTileId);
//     // link information attached to individual client changes/actions
//     // const clientActionLinks = getContent().getClientLinks(linkId, dataSet);
//     // synchronize the table change to the linked client
//     // lastChange && clientContent?.syncLinkedChange(dataSet, lastChange, clientActionLinks);
//   // }, [dataSet, getContent]);
// }, [geometry, getContent]);


  // const syncLinkedClients = useCallback((tableActionLinks?: ILinkProperties) => {
  //   tableActionLinks?.tileIds.forEach(tileId => {
  //     syncChangeToLinkedClient(tileId, tableActionLinks.id);
  //   });
  // }, [syncChangeToLinkedClient]);

  // const validateCase = useCallback((aCase: ICaseCreation) => {
  //   const newCase: ICaseCreation = { __id__: uniqueId() };
  //   if (getContent().isLinked) {
  //     // validate linkable values
  //     dataSet.attributes.forEach(attr => {
  //       const value = aCase[attr.id];
  //       newCase[attr.id] = isLinkableValue(value) ? value : 0;
  //     });
  //     return newCase;
  //   }
  //   return { ...newCase, ...aCase };
  // }, [dataSet.attributes, getContent]);

  /*
   * content change functions
   */
  const linkTableTile = useCallback((tableTileInfo: ITileLinkMetadata) => {
    // if (!getContent().isValidForGeometryLink()) return;
    const axes: IAxisLabels = { x: "x", y: "y" };
    // add action to geometry content
    const geomActionLinks = getGeometryActionLinks(tableTileInfo.id);
    if (!geomActionLinks) return;
    getContent().addTableLink(tableTileInfo.id, axes);
    // sync change to the newly linked client - not all linked clients
    // syncChangeToLinkedClient(tableTileInfo.id, geomActionLinks.id);
  // }, [getContent, getGeomActionLinks, syncChangeToLinkedClient]);  }
  }, [getContent, getGeometryActionLinks]);


  const unlinkTableTile = useCallback((tableTileInfo: ITileLinkMetadata) => {
    const geomActionLinks = getGeometryActionLinks(tableTileInfo.id);
    if (!geomActionLinks) return;
    getContent().removeTableLink(tableTileInfo.id);
    // syncChangeToLinkedClient(tableTileInfo.id, geomActionLinks.id);
  // }, [getContent, getGeomActionLinks, syncChangeToLinkedClient]);
}, [getContent, getGeometryActionLinks]);


  return { onLinkTableTile: linkTableTile, onUnlinkTableTile: unlinkTableTile };
};
