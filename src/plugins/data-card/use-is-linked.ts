import { createContext, useContext } from "react";

export const IsLinkedContext = createContext(false);

export function useIsLinked() {
  return useContext(IsLinkedContext);
}
