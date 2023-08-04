import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import d3, { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";
import { ITileModel } from "../../../src/models/tiles/tile-model";


import "./numberline-tile.scss";
import { linearMap } from "./numberline-tile-utils";

// //Guidelines ✓
// - ✓ new toolbar icon for creating points
// - ✓ point tool is selected by default so students can just start making points.
// - points can only be created on the axis, not anywhere in the tile

// - use arrow cursor and change to a dot on the end of the arrow when the user hovers over
     // the numberline axis to indicate that's where you can stick points

// - Any number of points can be placed on the line
// - points can be selected and dragged along the line
// - selected points have different rendering to show their selectedness (see specs)

//TODO:
//✓ create toolbar below, add icon.
//change arrow cursor behavior to when have a dot at end when user hovers over numberline axis.

interface IProps {
  model: ITileModel;
}

export const NumberlineTileComponent: React.FC<IProps> = observer((props) => {
  //---------------- Create unique className for tile -------------------------
  const tileId = props.model.id;
  const axisClass = "axis-" + tileId;

  //---------------- Calculate width of tile ----------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * 0.93);
  const axisWidth = (tileWidth * 0.9);
  //pixels we shift to the right to center axis in numberline-tool-container
  const xShiftNum = ((containerWidth - axisWidth)/2);
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


  //----------------- Global Max Min ------------------------------------------
  const domainMin = -5;
  const domainMax = 5;
  const numOfTicks = domainMax - domainMin;

  //----------------- Circle Point State / Properties -------------------------
  const [hoverPointRadius, setHoverPointRadius] = useState(0);
  const pointRadius = 5;
  const [hoverPointX, setHoverPointX] = useState(0);
  const [storedPoints, setStoredPoints] = useState<number[][]>([]); //array of [xPos, val, axisWidth]


   //---------------- TileWidth Trigger ---------------------------------------
   //  If user resizes window tileWidth state is changed which changes axisWidth
   // - we need to recalculate all xPos in all stored Points


   useEffect(()=>{
    console.log("-------useEffect triggered resizing axisWidth:", axisWidth);
    if(storedPoints.length > 0){
      const newStoredPoints = storedPoints.map(point => {
        const oldXPos = point[0];
        const oldVal = point[1];
        const oldAxisWidth = point[2];
        const newXPos = linearMap(0, oldAxisWidth, 0, axisWidth, oldXPos);
        return [newXPos, oldVal, axisWidth];
      });
      setStoredPoints(newStoredPoints);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[axisWidth]);

  //----------------- Create Numberline Axis  ---------------------------------
  useEffect(()=>{
    // Construct axis
    const linearScale = scaleLinear()
    .domain([domainMin, domainMax])
    .range([0, axisWidth]);
    // Remove outer ticks and create a tick for each integer
    const axis = axisBottom(linearScale).tickSizeOuter(0).ticks(numOfTicks);
    const selAxis = (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>);
    // Draw Axis
    selAxis.call(axis);

    // After the axis is drawn, customize "x = 0 tick"
    selectAll("g.num-axis g.tick line")
      .attr("y2", function(x){ return (x === 0) ? 20 : 6;})
      .attr("stroke-width", function(x){ return (x === 0) ? "3px" : "1px";})
      .attr("style", function(x){ return (x === 0) ? "transform: translateY(-10px)" : "";});
    // Set click-area to lay over axis
    select('.click-area')
      .attr('width', axisWidth)
      .on('click', (e) => createPoint(e))
      // track mouse position
      .on('mouseover',  () => setHoverPointRadius(pointRadius))
      .on('mousemove', function(e){
        const pos = pointer(e, clickArea);
        const xPos = pos[0];
        setHoverPointRadius(pointRadius);
        setHoverPointX(xPos);
      })
      .on("mouseout", function(d){
        setHoverPointRadius(0); //hide circle
      });

    const clickArea = select('.click-area').node();

    // Hover circle on axis
    selAxis.append("circle")
    .attr("class", "axis-circle")
    .attr("r", hoverPointRadius)
    .attr("cx", hoverPointX)
    .attr("cy", 0)
    .attr("style", "fill: #808080")
    .attr("opacity", 1);


    // Create circle point on axis
    const createPoint = (e: Event) => {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const val = xPosToValue(xPos);
      const newPoint = [xPos, val, axisWidth]; //store both xPos, value, and axisWidth
      setStoredPoints(oldArr => [...oldArr, newPoint]);
    };

    // Utility Functions
    const xPosToValue = (xPos: number) => linearScale.invert(xPos);

    // Clean up - remove all circles
    return () => {
      selAxis.selectAll(".axis-circle").remove();
    };
  },[axisClass, axisWidth, domainMin, domainMax, numOfTicks, hoverPointRadius, hoverPointX]);

  console.log("storedPoints:", storedPoints);

  return (
    <div className="numberline-tool" ref={documentScrollerRef}>
      <div className="numberline-tool-container">
        <div className="num-axis-title-container">
        </div>
        <div className="num-axis-container">
          <svg>
            <g transform="translate(0, 20)">
              <g className={`${axisClass} num-axis`} style={{'transform':`translateX(${numToPx(xShiftNum)})`}}></g>
            </g>

            {
              storedPoints.map((point, i)=>(
                <circle
                  key={`${axisClass}-${i}`}
                  r={pointRadius}
                  cy="0" cx={point[0]}
                  fill="#808080"
                  style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)`}}
                />
              ))
            }
          </svg>
          <div className="click-area" style={{'width': axisWidth, 'transform':`translateX(${numToPx(xShiftNum)})`}}>
          </div>
            <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '14px'}}></i>
            <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '14px'}}></i>
        </div>
      </div>
    </div>
  );
});
NumberlineTileComponent.displayName = "NumberlineTileComponent";

