import { DiagramHelper } from "@concord-consortium/diagram-view";
import { createContext, useContext } from "react";

export const DiagramHelperContext = createContext<DiagramHelper|undefined>(undefined);

export function useDiagramHelperContext() {
  return useContext(DiagramHelperContext);
}
