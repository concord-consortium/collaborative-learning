import { useCallback, useRef } from "react";

export const useMeasureText = (font: string) => {
  const cache = useRef<Record<string, number>>({});
  const canvas = useRef(document.createElement("canvas"));
  const context = canvas.current.getContext("2d");
  context && font && (context.font = font);
  return useCallback((text: string) => {
    const _context = canvas.current.getContext("2d");
    return cache.current[text] ||
            (_context
              ? cache.current[text] = Math.ceil(10 * _context.measureText(text).width) / 10
              : 0);
  }, []);
};
