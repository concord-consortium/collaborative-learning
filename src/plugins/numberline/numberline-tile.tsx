import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  console.log("<NumberlineToolComponent> with props", props);
  //---------------- Create unique className for tile and deconstruct title ------
  const tileId = props.model.id;
  const axisClass = "axis-" + tileId;
  const tileTitle = props.model.title;

  //---------------- Calculate width of tile ---------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * 0.93);
  const axisWidth = (tileWidth * 0.9);
  //pixels we shift to the right to center numberline in numberline-tool-container
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

  //----------------- Create numberline axis  -----------------------
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
      console.log("xPos:", xPos);
      const value = linearScale.invert(xPos);
      console.log("You clicked: ", value.toFixed(2));
    };

    select('.click-area')
      .attr('width', axisWidth)
      .on('click', (e) => printNum(e));

    const clickArea = select('.click-area').node();

  },[axisClass, axisWidth, domainMin, domainMax, numOfTicks]);

  //Guidelines ✓
  //✓ double arrowhead access is shown along bottom of tile
  //✓ regular increments are marked every 1 unit, labeled on every increment/tick, always counts by 1
  // ✓axis extends from -5 to 5
  //✓ 0 tick is highlighted more heavily
  //✓ build infrastructre to make axis limits variable
  //✓ when you change the min max, make sure the bounds are shown, turn -5,5 into some global min max variables
  //✓ axis should extend across 90% of tile and be resizable as the tile resizes


  return (
    <div className="numberline-tool" ref={documentScrollerRef}>
      <div className="numberline-tool-container">
        <div className="num-axis-title-container">
          <div className="title-box">
            {tileTitle}
          </div>
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
NumberlineToolComponent.displayName = "NumberlineToolComponent";

