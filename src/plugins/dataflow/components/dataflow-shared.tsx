import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";

export interface IDataFlowActionHandlers {
  handleRequestTableLink: (tileInfo: ITileLinkMetadata) => void;
  handleRequestTableUnlink: (tileInfo: ITileLinkMetadata) => void;
}
