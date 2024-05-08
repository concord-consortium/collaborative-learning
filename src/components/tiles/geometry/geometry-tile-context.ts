import { createContext, useContext } from "react";
import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { IActionHandlers } from "./geometry-shared";

export interface IGeometryTileContext {
  content: GeometryContentModelType|undefined;
  board: JXG.Board|undefined;
  handlers: IActionHandlers|undefined;
}

const defaultValue = { content: undefined, board: undefined, handlers: undefined };

export const GeometryTileContext = createContext<IGeometryTileContext>(defaultValue);

export const useGeometryTileContext = () => useContext(GeometryTileContext);
