import { useCallback } from "react";
import { defaultFont } from "../../constants";

const canvas = document.createElement("canvas");
const cache: Record<string, Record<string, number>> = {};

export const measureTextExtent = (text: string, font = defaultFont) => {
  const context = canvas.getContext("2d");
  context && font && (context.font = font);
  const metrics = context?.measureText(text) ?? { width: 0, fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0 };
  return { width: metrics.width, height: metrics.fontBoundingBoxDescent + metrics.fontBoundingBoxAscent };
};

export const measureText = (text:string, font = defaultFont) => {
  cache[font] = cache[font] || {};
  cache[font][text] = cache[font][text] || Math.ceil(10 * measureTextExtent(text).width) / 10;
  return cache[font][text];
};

export const useMeasureText = (font = defaultFont) => {
  return useCallback((text: string) => {
    return measureText(text, font);
  }, [font]);
};

// Removes leading and trailing whitespace and replaces all other white space with a single space
const trimWhitespace = (text:string) => {
  return text.trim().replace(/\s\s+/g, ' ');
};

// Caches values for measuring lines. First key is font, second is text, third is width, fourth is maxLines.
const lineCache: Record<string, Record<string, Record<number, Record<number, number>>>> = {};

// Approximates the number of lines a given string will take when rendered in a div of the given width
export const measureTextLines = (text: string, width: number, font = defaultFont, maxLines = 100) => {
  lineCache[font] = lineCache[font] || {};
  lineCache[font][text] = lineCache[font][text] || {};
  lineCache[font][text][width] = lineCache[font][text][width] || {};
  
  if (!(maxLines in lineCache[font][text][width])) {
    const trimmedText = trimWhitespace(text);
    let lines = 1;
    let startOfLine = 0;
    let startOfWord = 0;
    let currentIndex = 0;
    while (currentIndex < trimmedText.length) {
      // Lines should never start with a space
      if (trimmedText[startOfLine] === " ") {
        startOfLine++;
        currentIndex++;
        startOfWord++;
      }

      if (measureText(trimmedText.slice(startOfLine, currentIndex), font) < width) {
        // We haven't hit a line break yet
        if (trimmedText[currentIndex] === " ") {
          startOfWord = currentIndex + 1;
        }
        currentIndex++;
      } else {
        // We hit the end of the line
        lines++;
        if (lines >= maxLines) {
          lineCache[font][text][width][maxLines] = maxLines;
          return maxLines;
        }

        if (startOfWord === startOfLine) {
          // The line is one big word so we have to break in the middle of it
          startOfLine = startOfWord = currentIndex;
          // This commented code keeps oversized words on a single line
          // while (currentIndex < text.length) {
          //   // We found a new word, so start a new line with it
          //   if (text[currentIndex] === " ") {
          //     startOfLine = startOfWord = ++currentIndex;
          //     break;
          //   // We haven't found the end of the long word, keep looking
          //   } else {
          //     currentIndex++;
          //   }
          // }
        } else {
          // We've encountered other words on this line, so start the next line at the beginning of the last word
          startOfLine = startOfWord;
        }
      }
    }
    lineCache[font][text][width][maxLines] = lines;
  }

  return lineCache[font][text][width][maxLines];
};
