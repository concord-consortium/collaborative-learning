import classNames from 'classnames';
import { axisBottom, drag, pointer, select } from 'd3';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NumberlineToolbar } from "./numberline-toolbar";
import { NumberlineContentModelType, PointObjectModelType,  } from "../models/numberline-content";
import {
  kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight, numberlineDomainMax, numberlineDomainMin,
  tickHeightDefault, tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault, tickWidthZero,
  innerPointRadius, outerPointRadius, numberlineYBound, yMidPoint, createXScale, pointXYBoxRadius
} from '../numberline-tile-constants';
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { useToolbarTileApi } from "../../../components/tiles/hooks/use-toolbar-tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { OffsetModel } from '../../../models/annotations/clue-object';
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { HotKeys } from "../../../utilities/hot-keys";

import "./numberline-tile.scss";

export const NumberlineTile: React.FC<ITileProps> = observer(function NumberlineTile(props){
  const { documentContent, model, readOnly, scale, tileElt, onRegisterTileApi, onUnregisterTileApi } = props;
  const content = model.content as NumberlineContentModelType;
  const readOnlyState = (readOnly) ? "readOnly" : "readWrite";
  const tileId = model.id;
  const axisClass = `axis-${tileId}-${readOnlyState}`;

  const hotKeys = useRef(new HotKeys());
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const handleDeletePoint = () => {
    content.deleteSelectedPoints();
  };

  //---------------- Calculate Width Of Tile / Scale ----------------------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [hoverPointId, setHoverPointId] = useState("");
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = tileWidth * kContainerWidth;
  const axisWidth = tileWidth * kAxisWidth;
  const xShiftNum = (containerWidth - axisWidth) / 2;
  const xScale = useMemo(() => createXScale(axisWidth), [axisWidth]);
  const axisLeft = useMemo(() => tileWidth * (1 - kAxisWidth) / 2, [kAxisWidth, tileWidth]);

  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        if (documentScrollerRef.current?.clientWidth){
          const newTileWidth  = documentScrollerRef.current?.clientWidth;
          setTileWidth(newTileWidth ?? 0);
        }
      });
      obs.observe(documentScrollerRef.current);
    }
    return () => obs?.disconnect();
  }, []);

  //-------------------  SVG Ref to Numberline & SVG / Mouse State --------------------------------
  const svgRef = useRef<SVGSVGElement | null>(null);
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const axisRef = useRef<SVGGElement | any>(null);
  const axis = select(axisRef.current);

  /* ============================ [ Handlers / Mouse Functions ]  ============================== */
  svg.on("click", (e) => handleMouseClick(e));
  svg.on("mousemove", (e) => handleMouseMove(e));
  const mousePosX = (e: Event) => pointer(e, svgNode)[0];
  const mousePosY = (e: Event) => pointer(e, svgNode)[1];

  const pointPosition = useCallback((point: PointObjectModelType) => {
    const x = xScale(point.currentXValue);
    return { x, y: yMidPoint };
  }, [xScale, yMidPoint]);

  function findHoverPoint(e: MouseEvent) {
    const [mouseX, mouseY] = [mousePosX(e), mousePosY(e)];
    let hoverPoint: PointObjectModelType | undefined;
    content.pointsArr.forEach(point => {
      const { x, y } = pointPosition(point);
      if (
        mouseX >= x - outerPointRadius && mouseX <= x + outerPointRadius
        && mouseY >= y - outerPointRadius && mouseY <= y + outerPointRadius
      ) {
        hoverPoint = point;
      }
    });
    const id = hoverPoint?.id ?? "";
    setHoverPointId(id);
    return id;
  }

  useEffect(()=>{
    if (!readOnly) {
      hotKeys.current.register({
        "delete": handleDeletePoint,
        "backspace": handleDeletePoint,
      });
    }
  }, []);
  
  const getObjectBoundingBox = useCallback((objectId: string, objectType?: string) => {
    if (objectType === "point") {
      const point = content.getPoint(objectId);
      if (!point) return undefined;
      const halfSide = outerPointRadius;
      const { x, y } = pointPosition(point);
      const boundingBox = {
        height: 2 * halfSide,
        left: x + axisLeft - halfSide - 1,
        top: y + 50 - halfSide - 1,
        width: 2 * halfSide
      }
      return boundingBox;
    }
  }, [axisLeft, pointPosition, pointXYBoxRadius]);

  useEffect(() => {
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return content.exportJson(options);
      },
      getTitle: () => {
        return model.title || "";
      },
      getObjectBoundingBox,
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        const offsets = OffsetModel.create({});
        if (objectType === "point") {
          offsets.setDy(-pointXYBoxRadius);
        }
        return offsets;
      }
    });
  }, [getObjectBoundingBox, model.title, pointXYBoxRadius]);

  const handleMouseClick = (e: Event) => {
    if (!readOnly){
      if (hoverPointId) {
        const hoverPoint = content.getPoint(hoverPointId);
        if (hoverPoint) content.setSelectedPoint(hoverPoint);
      } else{
        //only create point if we are not hovering over a point and within bounding box
        mouseInBoundingBox(mousePosX(e), mousePosY(e)) && handleClickCreatePoint(e);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!readOnly){
      const [mouseX, mouseY] = [mousePosX(e), mousePosY(e)];
      const isMouseInBoundingBox = mouseInBoundingBox(mouseX, mouseY);
      const id = findHoverPoint(e);

      // Draw the follow point if no point is being hovered
      svg.selectAll(".mouseXCircle").remove();
      if (isMouseInBoundingBox && !id) drawMouseFollowPoint(mouseX);
    }
  };

  const mouseInBoundingBox = (mouseXPos: number,  mouseYPos: number) => {
    const yTopBound = yMidPoint + numberlineYBound;
    const yBottomBound = yMidPoint - numberlineYBound;
    const isBetweenYBounds = (mouseYPos >= yBottomBound && mouseYPos <= yTopBound);
    const isBetweenXBounds = (mouseXPos >= 0 && mouseXPos <= axisWidth);
    return isBetweenYBounds && isBetweenXBounds;
  };

  const handleClickCreatePoint = (e: Event) => {
    if (!readOnly){
      const xValueClicked = xScale.invert(mousePosX(e));
      content.createNewPoint(xValueClicked);
    }
  };

  const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
  .on('drag', (e, p) => {
    if (!readOnly && mouseInBoundingBox(mousePosX(e), mousePosY(e))) {
      const hoverPoint = content.getPoint(hoverPointId);
      if (hoverPoint) content.setSelectedPoint(hoverPoint);
      const newXValue = xScale.invert(mousePosX(e));
      p.setDragXValue(newXValue);
    }
  })
  .on("end", (e, p) => {
    if (!readOnly) {
      p.setXValueToDragValue();
    }
  });

  const drawMouseFollowPoint = (mouseX: number) => {
    svg.append('circle') //create a circle that follows the mouse
      .attr('cx', mouseX)
      .attr('cy', yMidPoint)
      .attr('r', innerPointRadius)
      .classed("mouseXCircle", true)
      .classed("point-inner-circle", true);
  };

  // * =============================== [ Construct Numberline ] ================================ */
  if (axisWidth !== 0) {
    const numOfTicks = numberlineDomainMax - numberlineDomainMin;
    axis
      .attr("class", `${axisClass} num-line`)
      .attr("style", `${kAxisStyle}`) //move down
      .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks)) //remove side ticks
      .selectAll("g.tick line") //customize 0 ticks
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});
  }

  /* ========================== [ Construct/Update Circles ] =================================== */
  if (axisWidth !== 0){
    const updateCircles = () => {
      /* =========================== [ Outer Hover Circles ] ======================= */
      //---- Initialize outer hover circles
      const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.axisPointsSnapshot);

      outerPoints.enter()
        .append("circle").attr("class", "outer-point")
        .attr('cx', (p) => xScale(p.currentXValue ?? numberlineDomainMin)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
        .classed("point-outer-circle", true);

      // --- Update functions outer hover circles
      outerPoints
        .attr('cx', (p) => xScale(p.currentXValue ?? numberlineDomainMin)) //mapped to axis width
        .classed("hovered", (p, idx) => (hoverPointId === p.id));

      outerPoints.exit().remove(); //cleanup

      /* =========================== [ Inner Circles ] ============================= */
      //---- Initialize inner hover circles
      const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
      .data(content.axisPointsSnapshot);

      // Initialize Attributes
      innerPoints.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => xScale(p.xValue || numberlineDomainMin)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', innerPointRadius).attr('id', p => p.id)
        .classed("point-inner-circle", true)
        .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions inner circles
      innerPoints
        .attr('cx', (p, idx) => xScale(p.currentXValue || numberlineDomainMin))
        .classed("selected", (p)=> p.id in content.selectedPoints)
        .call((e) => handleDrag(e)); // pass again in case axisWidth changes

      innerPoints.exit().remove(); //cleanup
    };
    updateCircles();
  }

  return (
    <div
      className={classNames("numberline-wrapper", { "read-only": readOnly })}
      onKeyDown={(e) => hotKeys.current.dispatch(e)}
      tabIndex={0}
    >
      <div className={"numberline-title"}>
        <BasicEditableTileTitle
          model={model}
          readOnly={readOnly}
          scale={scale}
        />
      </div>
      <NumberlineToolbar
        documentContent={documentContent}
        tileElt={tileElt}
        {...toolbarProps}
        scale={scale}
        handleClearPoints={() => content.deleteAllPoints()}
        handleDeletePoint={handleDeletePoint}
      />
      <div
        className="numberline-tool"
        ref={documentScrollerRef}
        data-testid="numberline-tool"
        style={{"height": `${kNumberLineContainerHeight}`}}
      >
        <div className="numberline-tool-container" >
          <i className="arrow left" style={{'left': xShiftNum - 3, 'top': '53px'}}/>
          <i className="arrow right" style={{'right': xShiftNum - 3, 'top': '53px'}}/>
          <svg ref={svgRef} width={axisWidth}>
            <g ref={axisRef}></g>
          </svg>
        </div>
      </div>
    </div>
  );
});

export default NumberlineTile;
