import React from "react";
import { ITileModel } from "../../models/tiles/tile-model";

/**
 * Context to let children know about a container tile that they are in.
 */
export interface IContainerContextType {
  model: ITileModel | undefined;
  isLocked: boolean;
}

export const ContainerContext = React.createContext<IContainerContextType>({
  model: undefined,
  isLocked: false
});

export const useContainerContext = () => {
  return React.useContext(ContainerContext);
};
