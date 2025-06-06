import React, { createContext, useContext } from "react";

/**
 * Represents the current SVG scaling in effect in X and Y directions due to groups.
 */
export interface DrawingScale {
  scaleX: number;
  scaleY: number;
}

/**
 * React context for the current drawing scale. Default is no scale (1, 1).
 */
export const DrawingScaleContext = createContext<DrawingScale>({ scaleX: 1, scaleY: 1 });

/**
 * Hook to access the current drawing scale from context.
 */
export const useDrawingScale = () => useContext(DrawingScaleContext);

/**
 * Provider that multiplies the parent scale with the local scale and provides it to children.
 * @param scale - The local scale to apply (will be multiplied with parent scale)
 * @param children - The children to render
 */
export const DrawingScaleProvider:
    React.FC<{ scale: DrawingScale; children: React.ReactNode }> = ({ scale, children }) => {
  const parentScale = useDrawingScale();
  const combinedScale = {
    scaleX: parentScale.scaleX * scale.scaleX,
    scaleY: parentScale.scaleY * scale.scaleY,
  };
  return (
    <DrawingScaleContext.Provider value={combinedScale}>
      {children}
    </DrawingScaleContext.Provider>
  );
};
