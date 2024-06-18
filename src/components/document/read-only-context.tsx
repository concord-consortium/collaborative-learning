import React, { useContext } from "react";

/**
 * Context to let components know if the current document is read-only or read-write.
 */
export const ReadOnlyContext = React.createContext<boolean>(false);

export const useReadOnlyContext = () => useContext(ReadOnlyContext);

