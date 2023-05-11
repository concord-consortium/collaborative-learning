import React from "react";

export const PlaceholderDataSvg = () => {
    const placeholderDotStyle = {
                                  fill: "rgb(230, 128, 91)",
                                  opacity: 0.5,
                                  stroke: "rgb(255, 255, 255)",
                                  strokeWidth: 1,
                                  strokeOpacity: 0.4
                                };

    return (
      <svg className="graph-dot-area placeholder">
        <circle
          className="graph-dot"
          id="default-graph-dot-1"
          r="9"
          style={placeholderDotStyle}
          cx="7.65%"
          cy="15.35%"
        >
        </circle>
        <circle
          className="graph-dot"
          id="default-graph-dot-2"
          r="9"
          style={placeholderDotStyle}
          cx="84.6%"
          cy="92.45%"
        >
        </circle>
      </svg>
    );
};
