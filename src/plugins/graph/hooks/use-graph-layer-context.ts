import { createContext, useContext } from "react";
import { IGraphLayerModel } from "../models/graph-layer-model";

export const GraphLayerContext = createContext<IGraphLayerModel>({} as IGraphLayerModel);

export const useGraphLayerContext = () => useContext(GraphLayerContext);
