import { createContext, ReactElement } from "react";
import { Optional } from "utility-types";
import { IOffsetModel, ObjectBoundingBox } from "../../models/annotations/clue-object";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { ITileModel } from "../../models/tiles/tile-model";
import { SharedModelType } from "../../models/shared/shared-model";

export type TileResizeEntry = Optional<ResizeObserverEntry,
                                        "borderBoxSize" | "contentBoxSize" | "devicePixelContentBoxSize">;
interface IGetObjectButtonSVGParams {
  classes?: string;
  handleClick: () => void;
  objectId: string;
  objectType?: string;
  translateTilePointToScreenPoint?: (point: [x: number, y: number]) => [x: number, y: number] | undefined;
}
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
  // Annotation functions
  getObjectBoundingBox?: (objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
  getObjectButtonSVG?: (params: IGetObjectButtonSVGParams) => ReactElement | undefined;
  getObjectDefaultOffsets?: (objectId: string, objectType?: string) => IOffsetModel;
  getObjectNodeRadii?: (objectId: string, objectType?: string) =>
    { centerRadius?: number, highlightRadius?: number } | undefined;
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

export const TileModelContext = createContext<ITileModel | null>(null);

export interface IAddTilesContext {
  /**
   * Add a new tile in a new row after the target tile.
   *
   * @param tileType type of the new tile
   * @param target tile after which the new tile will be added
   * @param sharedModels shared models to link to the new tile
   *
   * The shared models passed here will be configured for the tile before the
   * tile tries to add its own default shared models. Tiles add these default shared models
   * in a reaction in their afterAttach. This behavior prevents the tile from adding extra shared
   * models that are not needed. The tile's reaction will see the existing shared models and
   * decide the best thing to do.
   *
   * This shared model behavior is due to a complex ordering of when the new tile is added
   * to the tree, when afterAttach is called by MST, delayed reactions after action batches, and
   * the fact that all tiles check if the shared model manager is ready before doing anything.
   * A small obscure change in the code could cause the passed shared models to be configured
   * after the reaction runs.
   *
   * TODO: The configuration of shared models should be improved so we can get this behavior in a
   * more obvious way.
   */
  addTileAfter: (tileType: string, target: ITileModel, sharedModels?: SharedModelType[]) => void;
}
export const AddTilesContext = createContext<IAddTilesContext | null>(null);
