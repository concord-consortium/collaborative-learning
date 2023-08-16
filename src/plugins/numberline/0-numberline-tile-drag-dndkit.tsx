import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import d3, { scaleLinear, select, selectAll, pointer, axisBottom, drag } from "d3";
import { tickWidthDefault, tickWidthZero, tickHeightDefault, tickHeightZero, tickStyleDefault,
         tickStyleZero, kContainerWidth, kAxisWidth, numberlineDomainMax, numberlineDomainMin
       } from "./numberline-tile-constants";
import { ITileModel } from "../../models/tiles/tile-model";
import { linearMap } from "./utils/numberline-tile-utils";
import { NumberlineContentModelType, PointObjectModelType } from "./models/numberline-content";
import classNames from "classnames";

import "./0-numberline-tile-drag-dndkit.scss";

// //Guidelines ✓
// - ✓ new toolbar icon for creating points
// - ✓ point tool is selected by default so students can just start making points.
// - ✓ points can only be created on the axis, not anywhere in the tile

// - ✓ use arrow cursor and change to a dot on the end of the arrow when the user hovers over
     // the numberline axis to indicate that's where you can stick points

// ✓ when you resize the numberline axis - all points are recalculated according to the width
//✓ Any number of points can be placed on the line
// ✓ Need to store all the points in the model so that points persist after a page refresh

//TODO:
// - selected points have different rendering to show their selectedness (see specs)
// - points can be selected and dragged along the line
//Click on a point again to “select” it
// ability to drag and move a single point


interface IProps {
  model: ITileModel;
}

export const NumberlineToolComponent: React.FC<IProps> = observer((props) => {
  // console.log("-----------");
  console.log("NumberlineTileComponent with props:", props);
  const { model } = props;
  const content = model.content as NumberlineContentModelType;

  //---------------- Create unique className for tile -------------------------
  const tileId = model.id;
  const axisClass = "axis-" + tileId;

  //---------------- Calculate width of tile ----------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const axisWidth = (tileWidth * kAxisWidth);
  //pixels we shift to the right to center axis in numberline-tool-container
  const xShiftNum = ((containerWidth - axisWidth)/2);
  const numToPx = (num: number) => num.toFixed(2) + "px";
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

  //----------------- Circle Point State / Properties -------------------------
  const [hoverPointRadius, setHoverPointRadius] = useState(0);
  const [hoverPointX, setHoverPointX] = useState(0);
  const pointRadius = 5;

  //---------------- TileWidth Trigger ---------------------------------------
  //  If user resizes window, tileWidth state is changed which changes axisWidth
  // - we need to recalculate all points in the model
  useEffect(()=>{
    if (content.axisPoints.length > 0 && axisWidth !== 0){
      const reCalculatedPoints = content.axisPoints.map((pointObj: PointObjectModelType) => {
        const id = pointObj.id;
        const prevXPos = pointObj.pointCoordinates.xPos;
        const prevVal = pointObj.pointCoordinates.val;
        const prevAxisWidth = pointObj.pointCoordinates.axisWidth;
        const newXPos = linearMap(0, prevAxisWidth, 0, axisWidth, prevXPos);
        const reCalculatedPoint: PointObjectModelType = {
          id,
          pointCoordinates:{
            xPos: newXPos,
            val: prevVal,
            axisWidth
          },
          isHovered: false,
          isSelected: false

        };
        return reCalculatedPoint;
      });
      content.replaceAllPoints(reCalculatedPoints); //replace model
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[axisWidth]); //only trigger when axisWidth is changed



  // ----------------- Create Numberline Axis | Hover Circle on Axis | Create Points--------------------------------
  useEffect(()=>{
    // ----------------------------- Construct Axis -------------------------------------------
    const linearScale = scaleLinear()
    .domain([numberlineDomainMin, numberlineDomainMax])
    .range([0, axisWidth]);

    // --------------------- Remove outer ticks and create a tick for each integer-------------
    const numOfTicks = numberlineDomainMax - numberlineDomainMin;
    const axis = axisBottom(linearScale).tickSizeOuter(0).ticks(numOfTicks);
    const selAxis = (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>);
    // ---------------------- Draw Axis ------------------------------------------------------
    selAxis.call(axis);

    // ---------------------- After the axis is drawn, customize "x = 0 tick" ----------------
    selectAll("g.num-axis g.tick line")
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});

    // -------------------- Set invisible click-area mask to lay over axis ----------------------------------
    select('.click-area')
      .attr('width', axisWidth)
      .on('click', (e) => handleClickCreatePoint(e))
      .on('mousemove', (e) => trackMouse(e))
      .on("mouseout", () => setHoverPointRadius(0)); //hide circle
    const clickArea = select('.click-area').node();

    // ---------------------- Hover Circle On Axis -------------------------------------------
    selAxis.append("circle")
    .attr("class", "outer-hover-circle")
    .attr("r", hoverPointRadius)
    .attr("cx", hoverPointX)
    .attr("cy", 0)
    .attr("style", "fill: #808080")
    .attr("opacity", 1);

    // ---------------------- Enable Drag on Inner Circles -------------------------------------------*************


    // ------------------Handlers-------------------------------------

    const handleClickCreatePoint = (e: Event) => {
      // Create circle point on axis - write into model
      trackMouse(e);
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const val = xPosToValue(xPos);
      const newPoint = {xPos, val, axisWidth};
      content.createNewPoint(newPoint); //write into model
      console.log("pointsIsHoveredArr()", content.pointsIsHoveredArr);


    };

    const trackMouse = (e: Event) => {
      // -If mouse close to a point in model, set radius 0
      // and change that point to isHovered true
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      content.mouseOverPoint(xPos);
      if (content.hasPointHovered){
        setHoverPointRadius(0); //hide hover preview
      }
      else {
        setHoverPointRadius(pointRadius);
        setHoverPointX(xPos);
      }
    };

    // Utility Functions
    const xPosToValue = (xPos: number) => linearScale.invert(xPos);



    // Clean up - remove all circles
    return () => {
      selAxis.selectAll(".outer-hover-circle").remove();
    };

  },[axisClass, axisWidth, hoverPointRadius, hoverPointX, content]);

  return (
    <div className="numberline-tool" ref={documentScrollerRef} data-testid="numberline-tool">
      <div className="numberline-tool-container">
        <div className="num-axis-title-container">
        </div>
        <div className="num-axis-container">
          <svg>
            <g transform="translate(0, 20)">
              <g className={`${axisClass} num-axis`} style={{'transform':`translateX(${numToPx(xShiftNum)})`}}></g>
            </g>
            {
              content.axisPoints.map((pointObj, i)=>{
                console.log("pointObj:", pointObj);
                const xPos = pointObj.pointCoordinates.xPos;
                const isHovered = pointObj.isHovered;
                const isSelected = pointObj.isSelected;
                const classNameOuterCircle = classNames("outer-hover-circle", {"disabled": !isHovered});
                const classNameInnerCircle = classNames(axisClass, `inner-circle`,
                            {"selected": isSelected}
                );
                //---Setup draggable------
                const id = pointObj.id;
                const uniquePointKey = `${axisClass}-${id}`;
                // const { attributes, listeners, setNodeRef } = useDraggable({ id: uniquePointKey });

              //   <React.Fragment key={`fragment-${axisClass}-${id}`}>
              //   <circle key={`${axisClass}-hover-${id}`} className={classNameOuterCircle} r={pointRadius + 5} cy="0"
              //     cx={xPos} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
              //   />
              //   <circle key={`${axisClass}-inner-${id}`} className={classNameInnerCircle} r={pointRadius} cy="0"
              //     cx={xPos} fill={"#888888"} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
              //   />
              // </React.Fragment>

              // <div
              //   key={`${uniquePointKey}_fragment`}
              //   style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)`, "height": "10px", "width": "10px"}}
              // >

                return (
                  <React.Fragment
                    key={`${uniquePointKey}_fragment`}
                  >

                    <circle key={`${uniquePointKey}_outer`} className={classNameOuterCircle} r={pointRadius + 5} cy="0"
                      cx={xPos} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
                    />
                    <circle key={`${uniquePointKey}_inner`} className={classNameInnerCircle} r={pointRadius} cy="0"
                      cx={xPos} fill={"#888888"} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
                    />
                  </React.Fragment>
                );
              })
            }
          </svg>

            <div
              className="click-area"
              style={{'width': axisWidth, 'transform':`translateX(${numToPx(xShiftNum)})`}}
            />
          <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '14px'}}/>
          <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '14px'}}/>

        </div>
        {/* {console.log("delete here")} */}
        <p> clear all points</p>
        <button style={{"height": "20px", "width": "20px"}}onClick={content.clearAllPoints}/>
        <br/>
        {/* {console.log("to  here")} */}

      </div>
    </div>
  );
});
NumberlineToolComponent.displayName = "NumberlineToolComponent";

