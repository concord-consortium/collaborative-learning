import React from "react";

/**
 * Context to let components know if the current document is read-only or read-write.
 */
export const ReadOnlyContext = React.createContext<boolean>(true);

