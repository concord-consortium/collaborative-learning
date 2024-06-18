import { createContext, useContext } from "react";
import { IGraphModel } from "../models/graph-model";

export const GraphModelContext = createContext<IGraphModel>({} as IGraphModel);

export const useGraphModelContext = () => useContext(GraphModelContext);
