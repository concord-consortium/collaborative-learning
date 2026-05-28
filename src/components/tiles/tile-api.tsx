import { createContext, ReactElement } from "react";
import { action, makeObservable, observable } from "mobx";
import { Optional } from "utility-types";
import type { EscapeHandlerResult, FocusContentContext, TabHandlerResult }
  from "@concord-consortium/accessibility-tools/hooks";
import { IOffsetModel, ObjectBoundingBox } from "../../models/annotations/clue-object";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { ITileModel } from "../../models/tiles/tile-model";
import { SharedModelType } from "../../models/shared/shared-model";
import { IDocumentContentAddTileOptions } from "../../models/document/document-content-types";

export type TileResizeEntry = Optional<ResizeObserverEntry,
                                        "borderBoxSize" | "contentBoxSize" | "devicePixelContentBoxSize">;

interface IGetObjectButtonSVGParams {
  classes?: string;
  handleClick: (e: React.MouseEvent) => void;
  objectId: string;
  objectType?: string;
  translateTilePointToScreenPoint?: (point: [x: number, y: number]) => [x: number, y: number] | undefined;
}
// Focus trap elements returned by tile-specific implementations
export interface ITileFocusableElements {
  contentElement?: HTMLElement;  // main content area (editor, grid, canvas, etc.)
  titleElement?: HTMLElement;    // tile title input if visible
  // Custom focus method for content (e.g., Slate's ReactEditor.focus). The
  // FocusContentContext carries entryMode so direction-aware implementations
  // (e.g. XY Plot's reverse-Tab targeting the dots-group) can pick the right end.
  focusContent?: (context: FocusContentContext) => boolean;
  // Optional secondary controls bar above the main content (e.g. dataflow's
  // Sampling Rate / Record area). Visited as its own slot between title and
  // content. Walked focusable-by-focusable like content (in tabWithinSlots).
  topbarElement?: HTMLElement;
  // Optional inline secondary toolbar (e.g. dataflow's Add-Block palette). Visited
  // as its own slot in the trap cycle, between content and the standard floating
  // toolbar, so its internal roving-tabindex is a single tab stop with arrow nav.
  paletteElement?: HTMLElement;
  // Per-tile override for which slots route Tab within them. The outer
  // FocusTrapController reads this and applies it to its strategy (e.g. XY
  // Plot opts palette in because its legend has heterogeneous controls).
  tabWithinSlots?: string[];
  // Per-slot Escape interceptors. Return "handled" to suppress the trap's
  // exit (e.g. let an inline editor cancel instead). "exit" / omit → exit.
  escapeHandlers?: Record<string, (e: KeyboardEvent) => EscapeHandlerResult>;
  // Per-slot Tab interceptors. Return "handled" if the handler moved focus
  // (caller's responsibility to preventDefault); "exit" advances the slot.
  // Any slot listed here owns its own tabindex — the trap won't touch its
  // descendants' tabindex on mount.
  tabHandlers?: Record<string, (e: KeyboardEvent, reverse: boolean) => TabHandlerResult>;
  // Drag handle element for keyboard tile pick-up. Visited between toolbar and
  // resize in the focus trap cycle. Uses tabIndex={-1} like resize — the trap
  // controls when it receives focus.
  dragHandleElement?: HTMLElement;
}

export interface ITileApi {
  isLinked?: () => boolean;
  getLinkedTiles?: () => string[] | undefined;
  getContentHeight?: () => number | undefined;
  exportContentAsTileJson?: (options?: ITileExportOptions) => string;
  handleDocumentScroll?: (x: number, y: number) => void;
  handleTileResize?: (entry: TileResizeEntry) => void;
  // Tile-specific focusable elements for focus trap navigation
  getFocusableElements?: () => ITileFocusableElements | undefined;
  // Annotation functions
  getObjectBoundingBox?: (objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
  getObjectButtonSVG?: (params: IGetObjectButtonSVGParams) => ReactElement | undefined;
  getObjectDefaultOffsets?: (objectId: string, objectType?: string) => IOffsetModel;
  getObjectNodeRadii?: (objectId: string, objectType?: string) =>
    { centerRadius?: number, highlightRadius?: number } | undefined;
  getTileDimensions?: () => { width: number, height: number };
  getViewTransform?: () => { offsetX: number, offsetY: number, zoom: number } | undefined;
}

export interface ITileApiInterface {
  register: (id: string, tileApi: ITileApi) => void;
  unregister: (id: string) => void;
  getTileApi: (id: string) => ITileApi;
  forEach: (callback: (api: ITileApi) => void) => void;
}

export const TileApiInterfaceContext = createContext<ITileApiInterface | null>(null);

/**
 * An observable registry of tile API instances
 */
export class TileApiInterface implements ITileApiInterface {
  private tileApiMap = observable.map<string, ITileApi>();

  constructor() {
    makeObservable(this);
  }

  @action
  register(id: string, tileApi: ITileApi) {
    this.tileApiMap.set(id, tileApi);
  }

  @action
  unregister(id: string) {
    this.tileApiMap.delete(id);
  }

  getTileApi(id: string) {
    return this.tileApiMap.get(id)!;
  }

  forEach(callback: (api: ITileApi) => void) {
    this.tileApiMap.forEach(api => callback(api));
  }
}

// set by the canvas and used by the toolbar
export type EditableTileApiInterfaceRef = React.MutableRefObject<ITileApiInterface | null>;
export const EditableTileApiInterfaceRefContext = createContext<EditableTileApiInterfaceRef | null>(null);

export const TileModelContext = createContext<ITileModel | null>(null);

// Callback for toolbar to register its DOM element with tile-component.
// This avoids a querySelector across the FloatingPortal boundary.
export type RegisterToolbarCallback = (el: HTMLElement | null) => void;
export const RegisterToolbarContext = createContext<RegisterToolbarCallback | null>(null);

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
  addTileAfter: (tileType: string, target: ITileModel, sharedModels?: SharedModelType[],
                 options?: IDocumentContentAddTileOptions) => void;
}
export const AddTilesContext = createContext<IAddTilesContext | null>(null);
