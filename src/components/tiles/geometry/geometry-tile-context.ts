import { createContext, useContext } from "react";
import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { IActionHandlers } from "./geometry-shared";
import { GeometryTileMode, GeometryTileModes } from "./geometry-types";

export interface IGeometryTileContext {
  mode: GeometryTileMode;
  setMode: (mode: GeometryTileMode) => void;
  content: GeometryContentModelType|undefined;
  board: JXG.Board|undefined;
  handlers: IActionHandlers|undefined;
}

const defaultValue = {
  mode: GeometryTileModes[0],
  setMode: (mode: GeometryTileMode) => { },
  content: undefined,
  board: undefined,
  handlers: undefined
};

export const GeometryTileContext = createContext<IGeometryTileContext>(defaultValue);

export const useGeometryTileContext = () => useContext(GeometryTileContext);
