import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";
import { ITileModel } from "../../../src/models/tiles/tile-model";

import "./numberline-tile.scss";

// //Guidelines ✓
// - new toolbar icon for creating points
// - point tool is selected by default so students can just start making points.
// - points can only be created on the axis, not anywhere in the tile

// - use arrow cursor and change to a dot on the end of the arrow when the user hovers over
     // the numberline axis to indicate that's where you can stick points

// - Any number of points can be placed on the line
// - points can be selected and dragged along the line
// - selected points have different rendering to show their selectedness (see specs)

//TODO: create toolbar below, add icon.
//change arrow cursor behavior to when have a dot at end when user hovers over numberline axis.

interface IProps {
  model: ITileModel;
}

export const NumberlineTileComponent: React.FC<IProps> = observer((props) => {
  //---------------- Create unique className for tile ------
  const tileId = props.model.id;
  const axisClass = "axis-" + tileId;
  //---------------- Calculate width of tile ---------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * 0.93);
  const axisWidth = (tileWidth * 0.9);
  //pixels we shift to the right to center axis in numberline-tool-container
  const xShiftRaw = ((containerWidth - axisWidth)/2);
  const numToPx = (num: number) => num.toFixed(2).toString() + "px";

  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        setTileWidth(documentScrollerRef.current?.clientWidth ?? 0);
      });
      obs.observe(documentScrollerRef.current);
    }
    return () => obs?.disconnect();
  }, []);
  //----------------- Global Max Min -----------------------
  const domainMin = -5;
  const domainMax = 5;
  const numOfTicks = domainMax - domainMin;

  //----------------- Create Numberline Axis  --------------
  useEffect(()=>{
    // Construct axis
    const linearScale = scaleLinear()
    .domain([domainMin, domainMax])
    .range([0, axisWidth]);
    const axis = axisBottom(linearScale).tickSizeOuter(0);
    axis.ticks(numOfTicks);
    (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>).call(axis);

    // After the axis is drawn, customize "x = 0 tick"
    selectAll("g.num-axis g.tick line")
      .attr("y2", function(x){ return (x === 0) ? 20 : 6;})
      .attr("stroke-width", function(x){ return (x === 0) ? "3px" : "1px";})
      .attr("style", function(x){ return (x === 0) ? "transform: translateY(-10px)" : "";});

    //Set click-area to printNumber out
    const printNum = (e: Event) => {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      //right now value is not being used but will need to be used eventually
    };

    select('.click-area')
      .attr('width', axisWidth)
      .on('click', (e) => printNum(e));

    const clickArea = select('.click-area').node();

  },[axisClass, axisWidth, domainMin, domainMax, numOfTicks]);

  return (
    <div className="numberline-tool" ref={documentScrollerRef}>
      <div className="numberline-tool-container">
        <div className="num-axis-title-container">
        </div>
        <div className="num-axis-container">
          <svg>
            <g transform="translate(0, 20)">
              <g className={`${axisClass} num-axis`} style={{'transform':`translateX(${numToPx(xShiftRaw)})`}}></g>
            </g>
          </svg>
          <div className="click-area" style={{'width': axisWidth, 'transform':`translateX(${numToPx(xShiftRaw)})`}}>
          </div>
            <i className="arrow left" style={{'left': numToPx(xShiftRaw - 3), 'top': '14px'}}></i>
            <i className="arrow right" style={{'right': numToPx(xShiftRaw - 3), 'top': '14px'}}></i>
        </div>
      </div>
    </div>
  );
});
NumberlineTileComponent.displayName = "NumberlineTileComponent";

