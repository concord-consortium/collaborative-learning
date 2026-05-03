import React, { createContext, useContext } from "react";

/**
 * Context for the save indicator portal target.
 * The workspace heading renders a div and stores its ref here.
 * The SaveIndicator reads the ref and portals into it.
 */
export const SaveIndicatorPortalContext = createContext<React.RefObject<HTMLDivElement | null>>({ current: null });

export const useSaveIndicatorPortal = () => useContext(SaveIndicatorPortalContext);
