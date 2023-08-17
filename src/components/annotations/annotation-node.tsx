import classNames from "classnames";
import React from "react";

import { kAnnotationNodeHeight } from "./annotation-utilities";

import "./annotation-node.scss";

interface IAnnotationNodeProps {
  active?: boolean;
  centerRadius?: number;
  cx: number;
  cy: number;
  highlightRadius?: number;
}
export function AnnotationNode({ active, centerRadius, cx, cy, highlightRadius }: IAnnotationNodeProps) {
  const _centerRadius = centerRadius ?? kAnnotationNodeHeight / 4;
  const _highlightRadius = highlightRadius ?? kAnnotationNodeHeight / 2;
  return (
    <g className={classNames("annotation-node", { active })}>
      <circle
        className="node-highlight"
        cx={cx}
        cy={cy}
        r={_highlightRadius}
      />
      <circle
        className="node-center"
        cx={cx}
        cy={cy}
        r={_centerRadius}
      />
    </g>
  );
}
