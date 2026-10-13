import classNames from "classnames";
import React from "react";
import { kDefaultEventShape, kEventShapes } from "../timeline-event-styles";
import { getEventColorClass } from "../timeline-types";

import "./event-shape.scss";

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
      {(colorWord && kEventShapes[colorWord]) || kDefaultEventShape}
    </svg>
  );
}
