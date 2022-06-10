import { useCallback, useRef } from "react";

const defaultFont = "italic 14px Lato, sans-serif";

export const measureText =
  (text:string, canvas:HTMLCanvasElement, cache:Record<string, number> = {}, font:string = defaultFont) => {
  const context = canvas.getContext("2d");
  context && font && (context.font = font);
  cache[text] = cache[text] || (context ? Math.ceil(10 * context.measureText(text).width) / 10 : 0);
  return cache[text];
};

export const useMeasureText = (font: string = defaultFont) => {
  const cache = useRef<Record<string, number>>({});
  const canvas = useRef(document.createElement("canvas"));
  return useCallback((text: string) => {
    return measureText(text, canvas.current, cache.current, font);
  }, [font]);
};
