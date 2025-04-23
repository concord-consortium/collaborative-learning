import React from "react";

/**
 * Context to let children know if they are inside a locked container.
 */
export const LockedContainerContext = React.createContext<boolean>(false);

export const useLockedContainerContext = () => {
  return React.useContext(LockedContainerContext);
};
