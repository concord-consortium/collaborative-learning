import React, { SVGProps } from "react";
import { IToolTileProps } from "../../components/tiles/tile-component";

export interface IToolComponentInfo {
  id: string;
  Component: React.ComponentType<IToolTileProps>;
  toolTileClass: string;
  Icon?: React.FC<SVGProps<SVGSVGElement>>;
  /**
   * By default the tool tile wrapper ToolTileComponent will handle the selection of the
   * the tile when it gets a mouse down or touch start.
   *
   * If the tool wants to manage its own selection by calling ui.setSelectedTile,
   * it should set tileHandlesOwnSelection to true. This will prevent ToolTileComponent
   * from trying to set the selection.
   */
  tileHandlesOwnSelection?: boolean;
}

const gToolComponentInfoMap = new Map<string, IToolComponentInfo>();

export function registerToolComponentInfo(toolComponentInfo: IToolComponentInfo) {
  // toLowerCase() for legacy support of tool names
  gToolComponentInfoMap.set(toolComponentInfo.id.toLowerCase(), toolComponentInfo);
}

// Tool id, e.g. kDrawingToolID, kGeometryToolID, etc.
// undefined is supported so callers do not need to check the id before passing it in
export function getToolComponentInfo(id?: string) {
  // toLowerCase() for legacy support of tool names
  return id ? gToolComponentInfoMap.get(id.toLowerCase()) : undefined;
}
