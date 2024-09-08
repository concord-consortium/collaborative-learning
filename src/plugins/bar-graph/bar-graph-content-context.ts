import { createContext, useContext } from "react";
import { BarGraphContentModelType } from "./bar-graph-content";

export const BarGraphModelContext = createContext<BarGraphContentModelType|null>({} as BarGraphContentModelType);

export const useBarGraphModelContext = () => useContext(BarGraphModelContext);
