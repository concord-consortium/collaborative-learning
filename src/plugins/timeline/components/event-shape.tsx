import classNames from "classnames";
import React from "react";
import { getEventColorClass } from "../timeline-types";

import "./event-shape.scss";

// Each event color has a shape as well, so that types can be told apart without color; types beyond
// the six colors all share "?". Shapes are drawn in a 12x12 box, inset by half the 1px outline.
const kShapes: Record<string, React.ReactNode> = {
  blue: <rect x="0.5" y="0.5" width="11" height="11" />,
  orange: <circle cx="6" cy="6" r="5.5" />,
  red: <polygon points="6,0.5 11.5,11.5 0.5,11.5" />,
  yellow: <polygon points="0.5,0.5 11.5,0.5 6,11.5" />,
  magenta: <><rect x="0.5" y="0.5" width="11" height="4" /><rect x="0.5" y="7.5" width="11" height="4" /></>,
  purple: <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" />
};
const kDefaultShape = <text x="6" y="11" textAnchor="middle">?</text>;

interface IProps {
  colorWord?: string;
  size?: number;
}

export function EventShape({ colorWord, size = 12 }: IProps) {
  return (
    <svg
      className={classNames("event-shape", getEventColorClass(colorWord))}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      {(colorWord && kShapes[colorWord]) || kDefaultShape}
    </svg>
  );
}
