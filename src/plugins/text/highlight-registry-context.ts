import React from "react";

export interface IHighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type HighlightRegistryFn = (id: string, box: IHighlightBox) => void;

export const HighlightRegistryContext = React.createContext<HighlightRegistryFn | null>(null);
