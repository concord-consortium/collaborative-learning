import { createContext } from "react";
import { EditFacet } from "./data-card-types";

export interface IDataCardToolbarContext {
  currEditAttrId: string;
  currEditFacet: EditFacet;
}

export const DataCardToolbarContext = createContext<IDataCardToolbarContext | null>(null);
