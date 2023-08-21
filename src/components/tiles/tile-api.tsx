import { createContext } from "react";
import { Optional } from "utility-types";
import { IOffsetModel, ObjectBoundingBox } from "../../models/annotations/clue-object";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";

export type TileResizeEntry = Optional<ResizeObserverEntry,
                                        "borderBoxSize" | "contentBoxSize" | "devicePixelContentBoxSize">;
export interface ITileApi {
  getTitle?: () => string | undefined;
  hasSelection?: () => boolean;
  deleteSelection?: () => void;
  getSelectionInfo?: () => string;
  setSelectionHighlight?: (selectionInfo: string, isHighlighted: boolean) => void;
  isLinked?: () => boolean;
  getLinkIndex?: (index?: number) => number;
  getLinkedTiles?: () => string[] | undefined;
  getContentHeight?: () => number | undefined;
  exportContentAsTileJson?: (options?: ITileExportOptions) => string;
  handleDocumentScroll?: (x: number, y: number) => void;
  handleTileResize?: (entry: TileResizeEntry) => void;
  getObjectBoundingBox?: (objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
  getObjectDefaultOffsets?: (objectId: string, objectType?: string) => IOffsetModel;
}

export interface ITileApiInterface {
  register: (id: string, tileApi: ITileApi) => void;
  unregister: (id: string) => void;
  getTileApi: (id: string) => ITileApi;
  forEach: (callback: (api: ITileApi) => void) => void;
}

export type ITileApiMap = Record<string, ITileApi>;

export const TileApiInterfaceContext = createContext<ITileApiInterface | null>(null);

// set by the canvas and used by the toolbar
export type EditableTileApiInterfaceRef = React.MutableRefObject<ITileApiInterface | null>;
export const EditableTileApiInterfaceRefContext = createContext<EditableTileApiInterfaceRef | null>(null);
