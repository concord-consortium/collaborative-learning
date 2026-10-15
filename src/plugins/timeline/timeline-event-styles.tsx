import React from "react";

/**
 * The event color words, in the order `eventTypeColorWords` hands them out, each with the shape
 * that lets its type be told apart without color. `timeline-event-colors.scss` holds the matching
 * `$event-colors` map; `event-overlay.styles.test.ts` asserts the two lists agree.
 *
 * Shapes are drawn in a 12x12 box, inset by half the 1px outline.
 */
export const kEventStyles: { colorWord: string, shape: React.ReactNode }[] = [
  { colorWord: "blue", shape: <rect x="0.5" y="0.5" width="11" height="11" /> },
  { colorWord: "orange", shape: <circle cx="6" cy="6" r="5.5" /> },
  { colorWord: "red", shape: <polygon points="6,0.5 11.5,11.5 0.5,11.5" /> },
  { colorWord: "yellow", shape: <polygon points="0.5,0.5 11.5,0.5 6,11.5" /> },
  { colorWord: "magenta",
    shape: <><rect x="0.5" y="0.5" width="11" height="4" /><rect x="0.5" y="7.5" width="11" height="4" /></> },
  { colorWord: "purple", shape: <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" /> }
];

/** Types past the six share this. */
export const kDefaultEventShape = <text x="6" y="11" textAnchor="middle">?</text>;

export const kEventShapes: Record<string, React.ReactNode> =
  Object.fromEntries(kEventStyles.map(s => [s.colorWord, s.shape]));
