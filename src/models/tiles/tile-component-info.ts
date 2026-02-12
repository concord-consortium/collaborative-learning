import React, { SVGProps } from "react";
import { ITileProps } from "../../components/tiles/tile-component";

export interface ITileComponentInfo {
  type: string;
  Component: React.ComponentType<ITileProps>;
  tileEltClass: string;
  Icon?: React.FC<SVGProps<SVGSVGElement>>;
  /**
   * This is used by the sort work tab along with the displayName to
   * make a header for the group of documents with this tile
   *
   * TODO: it would be better if this would at least default to the main
   * toolbar icon so in many cases we wouldn't need two icons.
   */
  HeaderIcon?: React.FC<SVGProps<SVGSVGElement>>;
  /**
   * By default the tool tile wrapper TileComponent will handle the selection of the
   * the tile when it gets a mouse down or touch start.
   *
   * If the tool wants to manage its own selection by calling ui.setSelectedTile,
   * it should set tileHandlesOwnSelection to true. This will prevent TileComponent
   * from trying to set the selection.
   */
  tileHandlesOwnSelection?: boolean;
  /**
   * If true, the tile does not render its title visually in the UI.
   * Used by the read-aloud service to avoid announcing hidden titles.
   */
  hiddenTitle?: boolean;
}

const gTileComponentInfoMap = new Map<string, ITileComponentInfo>();

export function registerTileComponentInfo(tileComponentInfo: ITileComponentInfo) {
  // toLowerCase() for legacy support of tool names
  gTileComponentInfoMap.set(tileComponentInfo.type.toLowerCase(), tileComponentInfo);
}

export function getTileComponentKeys() {
  return Array.from(gTileComponentInfoMap.keys());
}

// Tool id, e.g. kDrawingTileType, kGeometryTileType, etc.
// undefined is supported so callers do not need to check the id before passing it in
export function getTileComponentInfo(type?: string) {
  // toLowerCase() for legacy support of tool names
  return type ? gTileComponentInfoMap.get(type.toLowerCase()) : undefined;
}
