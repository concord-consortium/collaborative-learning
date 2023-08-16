export {};


// import { observer } from "mobx-react";
// import React, { useEffect, useRef, useState } from "react";
// import d3, { scaleLinear, select, selectAll, pointer, axisBottom, drag, DragBehavior, range} from "d3";
// import { tickWidthDefault, tickWidthZero, tickHeightDefault, tickHeightZero, tickStyleDefault,
//          tickStyleZero, kContainerWidth, kAxisWidth, numberlineDomainMax, numberlineDomainMin
//        } from "./numberline-tile-constants";
// import { ITileModel } from "../../models/tiles/tile-model";
// import { linearMap } from "./utils/numberline-tile-utils";
// import { NumberlineContentModelType, PointObjectModelType } from "./models/numberline-content";
// import classNames from "classnames";

// import "./numberline-tile.scss";
// // //Guidelines ✓
// // - ✓ new toolbar icon for creating points
// // - ✓ point tool is selected by default so students can just start making points.
// // - ✓ points can only be created on the axis, not anywhere in the tile

// // - ✓ use arrow cursor and change to a dot on the end of the arrow when the user hovers over
//      // the numberline axis to indicate that's where you can stick points

// // ✓ when you resize the numberline axis - all points are recalculated according to the width
// //✓ Any number of points can be placed on the line
// // ✓ Need to store all the points in the model so that points persist after a page refresh

// //TODO:
// // - selected points have different rendering to show their selectedness (see specs)
// // - points can be selected and dragged along the line
// //Click on a point again to “select” it
// // ability to drag and move a single point


// interface IProps {
//   model: ITileModel;
// }

// export const NumberlineToolComponent: React.FC<IProps> = observer((props) => {
//   // console.log("-----------");
//   console.log("NumberlineTileComponent with props:", props);
//   const { model } = props;
//   const content = model.content as NumberlineContentModelType;

//   //---------------- Create unique className for tile -------------------------
//   const tileId = model.id;
//   const axisClass = "axis-" + tileId;

//   //---------------- Calculate width of tile ----------------------------------
//   const documentScrollerRef = useRef<HTMLDivElement>(null);
//   const [tileWidth, setTileWidth] = useState(0);
//   const containerWidth = (tileWidth * kContainerWidth);
//   const axisWidth = (tileWidth * kAxisWidth);
//   //pixels we shift to the right to center axis in numberline-tool-container
//   const xShiftNum = ((containerWidth - axisWidth)/2);
//   const numToPx = (num: number) => num.toFixed(2) + "px";
//   useEffect(() => {
//     let obs: ResizeObserver;
//     if (documentScrollerRef.current) {
//       obs = new ResizeObserver(() => {
//         setTileWidth(documentScrollerRef.current?.clientWidth ?? 0);
//       });
//       obs.observe(documentScrollerRef.current);
//     }
//     return () => obs?.disconnect();
//   }, []);

//   //----------------- Circle Point State / Properties -------------------------
//   const [hoverPointRadius, setHoverPointRadius] = useState(0);
//   const [hoverPointX, setHoverPointX] = useState(0);
//   const pointRadius = 5;

//   //---------------- TileWidth Trigger ---------------------------------------
//   //  If user resizes window, tileWidth state is changed which changes axisWidth
//   // - we need to recalculate all points in the model
//   useEffect(()=>{
//     if (content.axisPoints.length > 0 && axisWidth !== 0){
//       const reCalculatedPoints = content.axisPoints.map((pointObj: PointObjectModelType) => {
//         const id = pointObj.id;
//         const prevXPos = pointObj.pointCoordinates.xPos;
//         const prevVal = pointObj.pointCoordinates.val;
//         const prevAxisWidth = pointObj.pointCoordinates.axisWidth;
//         const newXPos = linearMap(0, prevAxisWidth, 0, axisWidth, prevXPos);
//         const reCalculatedPoint: PointObjectModelType = {
//           id,
//           pointCoordinates:{
//             xPos: newXPos,
//             val: prevVal,
//             axisWidth
//           },
//           isHovered: false,
//           isSelected: false

//         };
//         return reCalculatedPoint;
//       });
//       content.replaceAllPoints(reCalculatedPoints); //replace model
//     }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   },[axisWidth]); //only trigger when axisWidth is changed




//   // ----------------- Create Numberline Axis | Hover Circle on Axis | Create Points--------------------------------
//   useEffect(()=>{
//     console.log("----------- useEffect line 105----------------");

//     // ----------------------------- Construct Axis -------------------------------------------
//     const linearScale = scaleLinear()
//     .domain([numberlineDomainMin, numberlineDomainMax])
//     .range([0, axisWidth]);

//     // --------------------- Remove outer ticks and create a tick for each integer-------------
//     const numOfTicks = numberlineDomainMax - numberlineDomainMin;
//     const axis = axisBottom(linearScale).tickSizeOuter(0).ticks(numOfTicks);
//     const selAxis = (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>);
//     // ---------------------- Draw Axis ------------------------------------------------------
//     selAxis.call(axis);



//     // ---------------------- After the axis is drawn, customize "x = 0 tick" ----------------
//     selectAll("g.num-axis g.tick line")
//       .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
//       .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
//       .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});


//     // ---------------------- START COMMENT OUT  ----------------


//   //   // -------------------- Set invisible click-area mask to lay over axis ----------------------------------
//   //   select('.click-area')
//   //     .attr('width', axisWidth)
//   //     .on('click', (e) => handleClickCreatePoint(e))
//   //     .on('mousemove', (e) => trackMouse(e))
//   //     .on("mouseout", () => setHoverPointRadius(0)); //hide circle
//   //   const clickArea = select('.click-area').node();

//   //   // ---------------------- Hover Circle On Axis -------------------------------------------
//   //   selAxis.append("circle")
//   //   .attr("class", "outer-hover-circle")
//   //   .attr("r", hoverPointRadius)
//   //   .attr("cx", hoverPointX)
//   //   .attr("cy", 0)
//   //   .attr("style", "fill: #808080")
//   //   .attr("opacity", 1);

//   //   // ---------------------- Enable Drag on Inner Circles -------------------------------------------*************
//   //   const selectInnerCircles = selectAll('.inner-circle') as d3.Selection<Element, unknown, any, any>;
//   //   console.log("select Inner circles:", selectInnerCircles);

//   //   selectInnerCircles
//   //   .call(drag()
//   //   .subject(dragsubject)
//   //   .on("start", (e) => dragStarted(e))
//   //   .on("drag", (e) => dragged(e)));

//   // // console.log("dragging!: ", dragging);

//   // function dragsubject(e: Event) {
//   //   console.log("dragSubject!");
//   // }
//   // const dragStarted = (event: Event ) => {
//   //   console.log("dragStarted!");
//   // };
//   // const dragged = (event: Event) => {
//   //   console.log("dragged -----");
//   //   console.log("\tevent:", event);
//   // };
//   // const dragEnded = (event: any, d: any) => {
//   //   d.fx = null;
//   //   d.fy = null;
//   // };

//   //   // ------------------Handlers-------------------------------------

//   //   const handleClickCreatePoint = (e: Event) => {
//   //     // Create circle point on axis - write into model
//   //     trackMouse(e);
//   //     const pos = pointer(e, clickArea);
//   //     const xPos = pos[0];
//   //     const val = xPosToValue(xPos);
//   //     const newPoint = {xPos, val, axisWidth};
//   //     content.createNewPoint(newPoint); //write into model
//   //   };

//   //   const trackMouse = (e: Event) => {
//   //     // -If mouse close to a point in model, set radius 0
//   //     // and change that point to isHovered true
//   //     const pos = pointer(e, clickArea);
//   //     const xPos = pos[0];
//   //     content.mouseOverPoint(xPos);
//   //     if (content.hasPointHovered){
//   //       setHoverPointRadius(0); //hide hover preview
//   //     }
//   //     else {
//   //       setHoverPointRadius(pointRadius);
//   //       setHoverPointX(xPos);
//   //     }
//   //   };

//   //   // Utility Functions
//   //   const xPosToValue = (xPos: number) => linearScale.invert(xPos);

//   // --------------------------- END  COMMENT OUT  -------------------------------


//     // Clean up - remove all circles
//     return () => {
//       selAxis.selectAll(".outer-hover-circle").remove();
//     };

//   },[axisClass, axisWidth, hoverPointRadius, hoverPointX, content]);


//   //---------------------------------------------------- TEST ---------------------------------------


//   useEffect(()=>{
//     console.log("-------useEffect line 232--------------------------------------");
//     let data: any = [];
//     const numPoints = 3;
//     // const fakePositions = [120, 500, 700];

//     //-----------------------Create test points ---------------------------------

//     const circles = range(4).map(i => ({
//       x: Math.random() * axisWidth,
//       y: 0,
//     }));

//     //-----------------------Draw test points on axis ---------------------------------

//     const selAxis = (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>);
//     selAxis.selectAll('circle')
//       .data(circles)
//       .join("circle")
//       .attr('cx', function(d: any) { return d.x; })
//       .attr('cy', function(d: any) { return d.y; })
//       .attr('r', 5)
//       .attr("style", "fill: yellow")
//       .attr("draggable", true)
//       .call(dragFunction);


//     //-----------------------Select points on axis ---------------------------------

//     const selCirc = select(`.${axisClass}`).selectAll('circle') as unknown as DragBehavior<Element, unknown, unknown>;
//     console.log("selCircles:", selCirc);


//     // const dragFunction = drag()
//     // .on("start", dragStarted)
//     // .on("drag", dragged)
//     // .on("end", dragEnded);


//     function dragFunction() {
//       console.log("dragFunction");
//       function dragstarted(event: React.DragEvent<HTMLDivElement>, d: any) {
//         console.log("dragStarted");
//         // d3.select(this).raise().attr("stroke", "black");
//       }

//       function dragged(event: React.DragEvent<HTMLDivElement>, d: any) {
//         console.log("dragged");

//         // d3.select(this).attr("cx", d.x = event.x).attr("cy", d.y = event.y);
//       }

//       function dragended(event: React.DragEvent<HTMLDivElement>, d: any) {
//         console.log("dragEnded");
//         // d3.select(this).attr("stroke", null);
//       }

//       return drag()
//           .on("start", dragstarted)
//           .on("drag", dragged)
//           .on("end", dragended);
//     }


//     selCirc
//     .call(dragFunction);





//     // //-----------------------Drag handlers ---------------------------------

//     // function dragsubject(e: Event) {
//     //   console.log("dragSubject!");
//     // }
//     // function dragStarted (event: Event ) {
//     //   console.log("dragStarted!");
//     // }

//     // function dragged (event: Event) {
//     //   console.log("dragged -----");
//     //   console.log("\tevent:", event);
//     // }
//     // function dragEnded (event: any, d: any) {
//     //   d.fx = null;
//     //   d.fy = null;
//     // }


//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   },[axisWidth]);
//     //---------------------------------------------------- END TEST ---------------------------------------



//   return (
//     <div className="numberline-tool" ref={documentScrollerRef} data-testid="numberline-tool">
//       <div className="numberline-tool-container">
//         <div className="num-axis-title-container">
//         </div>
//         <div className="num-axis-container">
//           <svg>
//             {/* {console.log("original")} */}
//             <g transform="translate(0, 20)">
//               <g className={`${axisClass} num-axis`} style={{'transform':`translateX(${numToPx(xShiftNum)})`}}></g>
//             </g>
//             {
//               content.axisPoints.map((pointObj, i)=>{
//                 const xPos = pointObj.pointCoordinates.xPos;
//                 const id = pointObj.id;
//                 const isHovered = pointObj.isHovered;
//                 const isSelected = pointObj.isSelected;
//                 const classNameOuterCircle = classNames("outer-hover-circle", {"disabled": !isHovered});
//                 const classNameInnerCircle = classNames(axisClass, `inner-circle`,
//                             {"selected": isSelected}
//                 );

//                 return (
//                   <React.Fragment key={`fragment-${axisClass}-${id}`}>
//                     <circle key={`${axisClass}-outer-${id}`} className={classNameOuterCircle} r={pointRadius + 5} cy="0"
//                       cx={xPos} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
//                     />
//                     <circle key={`${axisClass}-inner-${id}`} className={classNameInnerCircle} r={pointRadius} cy="0"
//                       cx={xPos} fill={"#888888"} style={{'transform':`translate(${numToPx(xShiftNum)}, 20px)` }}
//                     />
//                   </React.Fragment>




//                 );
//               })
//             }
//           </svg>
//           <div className="click-area" style={{'width': axisWidth, 'transform':`translateX(${numToPx(xShiftNum)})`}}/>
//             <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '14px'}}></i>
//             <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '14px'}}></i>
//         </div>
//         {/* {console.log("delete here")} */}
//         {/* <p> clear all points</p>
//         <button style={{"height": "20px", "width": "20px"}}onClick={content.clearAllPoints}/>
//         <br/> */}
//         {/* {console.log("to  here")} */}

//       </div>
//     </div>
//   );
// });
// NumberlineToolComponent.displayName = "NumberlineToolComponent";

// ///-----------------------From stack overflow---------------------//

// import { useState, useEffect, useCallback, useRef } from 'react'

// // You may need to edit this to serve your specific use case
// function getPos(e) {
//   return {
//     x: e.pageX,
//     y: e.pageY,
//   }
// }

// // from https://reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state
// function usePrevious(value) {
//   const ref = useRef()
//   useEffect(() => {
//     ref.current = value
//   })
//   return ref.current
// }

// export function useDrag({ onDrag, onDragStart, onDragEnd }) {
//   const [isDragging, setIsDragging] = useState(false)

//   const handleMouseMove = useCallback(
//     (e) => {
//       onDrag(getPos(e))
//     },
//     [onDrag]
//   )

//   const handleMouseUp = useCallback(
//     (e) => {
//       onDragEnd(getPos(e))
//       document.removeEventListener('mousemove', handleMouseMove);
//       setIsDragging(false)
//     },
//     [onDragEnd, handleMouseMove]
//   )

//   const handleMouseDown = useCallback(
//     (e) => {
//       onDragStart(getPos(e))
//       setIsDragging(true)
//       document.addEventListener('mousemove', handleMouseMove)
//     },
//     [onDragStart, handleMouseMove]
//   )

//   const prevMouseMove = usePrevious(handleMouseMove)

//   useEffect(
//     () => {
//       document.removeEventListener('mousemove', prevMouseMove);
//       if(isDragging) {
//         document.addEventListener('mousemove', handleMouseMove)
//       }
//     },
//     [prevMouseMove, handleMouseMove, isDragging]
//   )

//   useEffect(
//     () => {
//       if (isDragging) {
//         document.addEventListener('mouseup', handleMouseUp)
//       }
//       return () => document.removeEventListener('mouseup', handleMouseUp)
//     },
//     [isDragging, handleMouseUp]
//   )

//   return handleMouseDown
// }