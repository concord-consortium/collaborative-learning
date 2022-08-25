import { useCallback } from "react";
import { defaultFont } from "../../constants";

const canvas = document.createElement("canvas");
const cache: Record<string, Record<string, number>> = {};

export const measureText = (text:string, font = defaultFont) => {
  const context = canvas.getContext("2d");
  context && font && (context.font = font);
  cache[font] = cache[font] || {};
  cache[font][text] = cache[font][text] || (context ? Math.ceil(10 * context.measureText(text).width) / 10 : 0);
  return cache[font][text];
};

export const useMeasureText = (font = defaultFont) => {
  return useCallback((text: string) => {
    return measureText(text, font);
  }, [font]);
};

export const measureTextLines = (text: string, width: number, font = defaultFont) => {
  const context = canvas.getContext("2d");
  if (!context) { return 1; }
  context && font && (context.font = font);
  let lines = 1;
  let startOfLine = 0;
  let startOfWord = 0;
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // We haven't hit a line break yet
    if (context.measureText(text.slice(startOfLine, currentIndex)).width < width) {
      if (text[currentIndex] === " ") {
        startOfWord = currentIndex + 1;
      }
      currentIndex++;
    // We hit the edge of the line
    } else {
      // The line is one big word so we can't break it
      if (startOfWord === startOfLine) {
        while (currentIndex < text.length) {
          // We found a new word, so start a new line with it
          if (text[currentIndex] === " ") {
            startOfLine = startOfWord = ++currentIndex;
            break;
          // We haven't found the end of the long word, keep looking
          } else {
            currentIndex++;
          }
        }
      // We've encountered other words on this line, start the next line at the beginning of the last word
      } else {
        startOfLine = startOfWord;
      }
      if (currentIndex < text.length) {
        lines++;
      }
    }
  }
  return lines;
};
