import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";
import { tickWidthDefault, tickWidthZero, tickHeightDefault, tickHeightZero,
  tickStyleDefault, tickStyleZero, kContainerWidth, kAxisWidth,
  numberlineDomainMax, numberlineDomainMin } from "./numberline-tile-constants";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  //---------------- Create unique className for tile ------
  const model = props.model;
  const readOnlyState = (props.readOnly) ? "readOnly" : "readWrite";
  const tileId = model.id;
  const axisClass = `axis-${tileId}-${readOnlyState}`;
  const tileTitle = props.model.title;

  //---------------- Calculate width of tile ---------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const axisWidth = (tileWidth * kAxisWidth);
  //pixels we shift to the right to center axis in numberline-tool-container
  const xShiftRaw = ((containerWidth - axisWidth)/2);
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

  //----------------- Create Numberline Axis  --------------
  useEffect(()=>{
    // Construct axis
    const linearScale = scaleLinear()
    .domain([numberlineDomainMin, numberlineDomainMax])
    .range([0, axisWidth]);
    const axis = axisBottom(linearScale).tickSizeOuter(0);
    const numOfTicks = numberlineDomainMax - numberlineDomainMin;
    axis.ticks(numOfTicks);
    (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>).call(axis);

    // After the axis is drawn, customize "x = 0 tick"
    selectAll("g.num-axis g.tick line")
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});

    //Set click-area to printNumber out
    const handleNumberClick = (e: Event) => {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      //right now value is not being used but will need to be used eventually
    };

    select('.click-area')
      .attr('width', axisWidth)
      .on('click', (e) => handleNumberClick(e));

    const clickArea = select('.click-area').node();

  },[axisClass, axisWidth]);

  return (
    <div className="numberline-tool" ref={documentScrollerRef} data-testid="numberline-tool">
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

