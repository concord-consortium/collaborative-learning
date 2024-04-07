import { createContext, useContext } from "react";
import { Point, RectSize } from "../graph-types";

export interface ILocationSetterContext {
  set: (id: string, location: Point|undefined, size: RectSize|undefined) => void;
}

export const LocationSetterContext = createContext<ILocationSetterContext|undefined>(undefined);

export const useLocationSetterContext = () => useContext(LocationSetterContext);
