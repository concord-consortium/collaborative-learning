import {extent, format, select, timeout} from "d3";
import React from "react";
import { isInteger} from "lodash";

import { IClueObjectSnapshot } from "../../../models/annotations/clue-object";
import { PartialSharedModelEntry } from "../../../models/document/document-content-types";
import { UpdatedSharedDataSetIds } from "../../../models/shared/shared-data-set";
import {
  CaseData, DotSelection, DotsElt, selectGraphDots, selectInnerCircles, selectOuterCircles
} from "../d3-types";
import {
  IDotsRef, kGraphFont, Point, outerCircleSelectedRadius, outerCircleUnselectedRadius,
  Rect,rTreeRect, transitionDuration
} from "../graph-types";
import {between} from "./math-utils";
import {IAxisModel, isNumericAxisModel} from "../imports/components/axis/models/axis-model";
import {ScaleNumericBaseType} from "../imports/components/axis/axis-types";
import {IDataSet} from "../../../models/data/data-set";
import {
  selectedStrokeWidth, defaultStrokeWidth, selectedOuterCircleFillColor, selectedOuterCircleStrokeColor
} from "../../../utilities/color-utils";
import {IDataConfigurationModel} from "../models/data-configuration-model";
import {measureText} from "../../../components/tiles/hooks/use-measure-text";

/**
 * Utility routines having to do with graph entities
 */

export const startAnimation = (enableAnimation: React.MutableRefObject<boolean>) => {
  enableAnimation.current = true;
  timeout(() => enableAnimation.current = false, 2000);
};

export const maxWidthOfStringsD3 = (strings: Iterable<string>) => {
  let maxWidth = 0;
  for (const aString of strings) {
    maxWidth = Math.max(maxWidth, measureText(aString, kGraphFont));
  }
  return maxWidth;
};

export function ptInRect(pt: Point, iRect: Rect) {
  const tRight = iRect.x + iRect.width,
    tBottom = iRect.y + iRect.height;
  return between(pt.x, iRect.x, tRight) && (pt.y !== undefined ? between(pt.y, iRect.y, tBottom) : false);
}

/**
 * This function closely follows V2's CellLinearAxisModel:_computeBoundsAndTickGap
 */
export function computeNiceNumericBounds(min: number, max: number): { min: number, max: number } {

  function computeTickGap(iMin: number, iMax: number) {
    const range = (iMin >= iMax) ? Math.abs(iMin) : iMax - iMin,
      gap = range / 5;
    if (gap === 0) {
      return 1;
    }
    // We move to base 10, so we can get rid of the power of ten.
    const logTrial = Math.log(gap) / Math.LN10,
      floor = Math.floor(logTrial),
      power = Math.pow(10.0, floor);

    // Whatever is left is in the range 1 to 10. Choose desired number
    let base = Math.pow(10.0, logTrial - floor);

    if (base < 2) base = 1;
    else if (base < 5) base = 2;
    else base = 5;

    return Math.max(power * base, Number.MIN_VALUE);
  }

  const kAddend = 5,  // amount to extend scale
    kFactor = 2.5,
    bounds = {min, max};
  if (min === max && min === 0) {
    bounds.min = -10;
    bounds.max = 10;
  } else if (min === max && isInteger(min)) {
    bounds.min -= kAddend;
    bounds.max += kAddend;
  } else if (min === max) {
    bounds.min = bounds.min + 0.1 * Math.abs(bounds.min);
    bounds.max = bounds.max - 0.1 * Math.abs(bounds.max);
  } else if (min > 0 && max > 0 && min <= max / kFactor) {  // Snap to zero
    bounds.min = 0;
  } else if (min < 0 && max < 0 && max >= min / kFactor) {  // Snap to zero
    bounds.max = 0;
  }
  const tickGap = computeTickGap(bounds.min, bounds.max);
  if (tickGap !== 0) {
    bounds.min = (Math.floor(bounds.min / tickGap) - 0.5) * tickGap;
    bounds.max = (Math.floor(bounds.max / tickGap) + 1.5) * tickGap;
  } else {
    bounds.min -= 1;
    bounds.max += 1;
  }
  return bounds;
}

export function setNiceDomain(values: number[], axisModel: IAxisModel) {
  if (isNumericAxisModel(axisModel)) {
    const [minValue, maxValue] = extent(values, d => d) as [number, number];
    const {min: niceMin, max: niceMax} = computeNiceNumericBounds(minValue, maxValue);
    axisModel.setDomain(niceMin, niceMax);
  }
}

export function getPointTipText(caseID: string, attributeIDs: string[], dataset?: IDataSet) {
  const float = format('.3~f'),
    attrArray = (attributeIDs.map(attrID => {
      const attribute = dataset?.attrFromID(attrID),
        name = attribute?.name,
        numValue = dataset?.getNumeric(caseID, attrID),
        value = numValue != null && isFinite(numValue) ? float(numValue)
                  : dataset?.getValue(caseID, attrID);
      return value ? `${name}: ${value}` : '';
    }));
  // Caption attribute can also be one of the plotted attributes, so we remove dups and join into html string
  return Array.from(new Set(attrArray)).filter(anEntry => anEntry !== '').join('<br>');
}

export function handleClickOnDot(event: MouseEvent, caseData: CaseData, dataConfiguration?: IDataConfigurationModel) {
  if (!dataConfiguration) return;
  const dataset = dataConfiguration.dataset;
  const yAttributeId = dataConfiguration.yAttributeID(caseData.plotNum);
  const yCell = { attributeId: yAttributeId, caseId: caseData.caseID };
  const extendSelection = event.shiftKey,
    cellIsSelected = dataset?.isCellSelected(yCell);
  if (!cellIsSelected) {
    if (extendSelection) { // y cell is not selected and Shift key is down => add y cell to selection
      dataset?.selectCells([yCell]);
    } else { // y cell is not selected and Shift key is up => only this y cell should be selected
      dataset?.setSelectedCells([yCell]);
    }
  } else if (extendSelection) { // y cell is selected and Shift key is down => deselect cell
    dataset?.selectCells([yCell], false);
  }
}

export interface IMatchCirclesProps {
  dataConfiguration: IDataConfigurationModel
  dotsElement: DotsElt
  pointRadius: number
  pointColor: string
  pointStrokeColor: string
  enableAnimation: React.MutableRefObject<boolean>
  instanceId: string | undefined
}

export function matchCirclesToData(props: IMatchCirclesProps) {
  const { dataConfiguration, enableAnimation, instanceId, dotsElement } = props;
  const allCaseData = dataConfiguration.joinedCaseDataArrays;
  const caseDataKeyFunc = (d: CaseData) => `${d.plotNum}-${d.caseID}`;

  // Create the circles
  const allCircles = selectGraphDots(dotsElement);
  if (!allCircles) return;
  startAnimation(enableAnimation);

  allCircles
    .data(allCaseData, caseDataKeyFunc)
    .join(
      enter => {
        const g = enter.append('g')
          .attr('class', 'graph-dot')
          .property('id', (d: CaseData) => `${instanceId}_${d.caseID}`);
        g.append('circle')
          .attr('class', 'outer-circle');
        g.append('circle')
          .attr('class', 'inner-circle');
        return g;
      }
    );

  dotsElement && select(dotsElement).on('click', (event: MouseEvent) => {
    event.stopPropagation();
    const target = select(event.target as SVGSVGElement);
    if (target.node()?.nodeName === 'circle') {
      handleClickOnDot(event, target.datum() as CaseData, dataConfiguration);
    }
  });
  dataConfiguration.setPointsNeedUpdating(false);
}

function isCircleSelected(aCaseData: CaseData, dataConfiguration?: IDataConfigurationModel) {
  const dataset = dataConfiguration?.dataset;
  if (!dataset) return false;
  const xAttributeId = dataConfiguration.xAttributeID;
  const yAttributeId = dataConfiguration.yAttributeID(aCaseData.plotNum);
  return dataset.isCaseSelected(aCaseData.caseID)
    || dataset.isAttributeSelected(xAttributeId)
    || dataset.isAttributeSelected(yAttributeId)
    || dataset.isCellSelected({ attributeId: xAttributeId, caseId: aCaseData.caseID })
    || dataset.isCellSelected({ attributeId: yAttributeId, caseId: aCaseData.caseID });
}

function applySelectedClassToCircles(selection: DotSelection, dataConfiguration?: IDataConfigurationModel){
  selection
    .classed('selected', (aCaseData: CaseData) => isCircleSelected(aCaseData, dataConfiguration));
}

function styleOuterCircles(outerCircles: any, dataConfiguration?: IDataConfigurationModel){
  outerCircles
    .attr('r', (aCaseData: CaseData) => {
      return isCircleSelected(aCaseData, dataConfiguration)
        ? outerCircleSelectedRadius : outerCircleUnselectedRadius;
    })
    .style('fill', (aCaseData: CaseData) => {
      return isCircleSelected(aCaseData, dataConfiguration) && selectedOuterCircleFillColor;
    })
    .style('stroke', (aCaseData: CaseData) => {
      return selectedOuterCircleStrokeColor;
    })
    .style('opacity', 0.5);
}

//  Return the two points in logical coordinates where the line with the given
//  iSlope and iIntercept intersects the rectangle defined by the upper and lower
//  bounds of the two axes.
export interface IAxisIntercepts {
  pt1: Point,
  pt2: Point
}

export function lineToAxisIntercepts(iSlope: number, iIntercept: number,
                                     xDomain: readonly number[], yDomain: readonly number[]): IAxisIntercepts {
  let tX1, tY1, tX2, tY2;
  const tLogicalBounds = {
    left: xDomain[0],
    top: yDomain[1],
    right: xDomain[1],
    bottom: yDomain[0]
  };
  if (!isFinite(iSlope)) {
    tX1 = tX2 = iIntercept;
    tY1 = tLogicalBounds.bottom;
    tY2 = tLogicalBounds.top;
  }
    // Things can get hairy for nearly horizontal or nearly vertical lines.
  // This conditional takes care of that.
  else if (Math.abs(iSlope) > 1) {
    tY1 = tLogicalBounds.bottom;
    tX1 = (tY1 - iIntercept) / iSlope;
    if (tX1 < tLogicalBounds.left) {
      tX1 = tLogicalBounds.left;
      tY1 = iSlope * tX1 + iIntercept;
    } else if (tX1 > tLogicalBounds.right) {
      tX1 = tLogicalBounds.right;
      tY1 = iSlope * tX1 + iIntercept;
    }

    tY2 = tLogicalBounds.top;
    tX2 = (tY2 - iIntercept) / iSlope;
    if (tX2 > tLogicalBounds.right) {
      tX2 = tLogicalBounds.right;
      tY2 = iSlope * tX2 + iIntercept;
    } else if (tX2 < tLogicalBounds.left) {
      tX2 = tLogicalBounds.left;
      tY2 = iSlope * tX2 + iIntercept;
    }
  } else {
    tX1 = tLogicalBounds.left;
    tY1 = iSlope * tX1 + iIntercept;
    if (tY1 < tLogicalBounds.bottom) {
      tY1 = tLogicalBounds.bottom;
      tX1 = (tY1 - iIntercept) / iSlope;
    } else if (tY1 > tLogicalBounds.top) {
      tY1 = tLogicalBounds.top;
      tX1 = (tY1 - iIntercept) / iSlope;
    }

    tX2 = tLogicalBounds.right;
    tY2 = iSlope * tX2 + iIntercept;
    if (tY2 > tLogicalBounds.top) {
      tY2 = tLogicalBounds.top;
      tX2 = (tY2 - iIntercept) / iSlope;
    } else if (tY2 < tLogicalBounds.bottom) {
      tY2 = tLogicalBounds.bottom;
      tX2 = (tY2 - iIntercept) / iSlope;
    }
  }

  // It is helpful to keep x1 < x2
  if (tX1 > tX2) {
    let tmp = tX1;
    tX1 = tX2;
    tX2 = tmp;

    tmp = tY1;
    tY1 = tY2;
    tY2 = tmp;
  }
  return {
    pt1: {x: tX1, y: tY1},
    pt2: {x: tX2, y: tY2}
  };
}

export function equationString(slope: number, intercept: number, attrNames: {x: string, y: string}) {
  const float = format('.4~r');
  if (isFinite(slope) && slope !== 0) {
    return `<em>${attrNames.y}</em> = ${float(slope)} <em>${attrNames.x}</em> + ${float(intercept)}`;
  } else {
    return `<em>${slope === 0 ? attrNames.y : attrNames.x}</em> = ${float(intercept)}`;
  }
}

export function valueLabelString(value: number) {
  const float = format('.4~r');
  return `<div style="color:blue">${float(value)}</div>`;
}

export function rectNormalize(iRect: rTreeRect) {
  return {
    x: iRect.x + (iRect.w < 0 ? iRect.w : 0),
    y: iRect.y + (iRect.h < 0 ? iRect.h : 0),
    w: Math.abs(iRect.w),
    h: Math.abs(iRect.h)
  };
}

/**
 * Returns the intersection of the two rectangles. Zero area intersections
 * (adjacencies) are handled as if they were not intersections.
 *
 */
export function rectangleIntersect(iA: rTreeRect, iB: rTreeRect) {
  const left = Math.max(iA.x, iB.x),
    right = Math.min(iA.x + iA.w, iB.x + iB.w),
    top = Math.max(iA.y, iB.y),
    bottom = Math.min(iA.y + iA.h, iB.y + iB.h);

  if (right - left <= 0 || bottom - top <= 0) return null;
  return {x: left, y: top, w: right - left, h: bottom - top};
}

/**
 * Returns an array of zero, one, or more rectangles that represent the
 * remainder of the first rectangle after the intersection with the second
 * rectangle is removed. If the rectangles do not intersect, then the whole of
 * the first rectangle is returned.
 *
 */
export function rectangleSubtract(iA: rTreeRect, iB: rTreeRect) {
  const intersectRect = rectangleIntersect(iA, iB),
    result = [];
  let intersectLR,
    rectangleALR;

  if (intersectRect) {
    intersectLR = {x: intersectRect.x + intersectRect.w, y: intersectRect.y + intersectRect.h};
    rectangleALR = {x: iA.x + iA.w, y: iA.y + iA.h};
    if (iA.x < intersectRect.x) {
      result.push({
        x: iA.x, y: iA.y, w: intersectRect.x - iA.x, h: iA.h
      });
    }
    if (intersectLR.x < rectangleALR.x) {
      result.push({
        x: intersectLR.x, y: iA.y, w: rectangleALR.x - intersectLR.x, h: iA.h
      });
    }
    if (iA.y < intersectRect.y) {
      result.push({
        x: intersectRect.x, y: iA.y, w: intersectRect.w, h: intersectRect.y - iA.y
      });
    }
    if (intersectLR.y < rectangleALR.y) {
      result.push({
        x: intersectRect.x, y: intersectLR.y, w: intersectRect.w, h: rectangleALR.y - intersectLR.y
      });
    }
  } else {
    result.push(iA);
  }

  return result;
}

export function rectToTreeRect(rect: Rect) {
  return {
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height
  };
}

export function getScreenCoord(dataSet: IDataSet | undefined, id: string,
                               attrID: string, scale: ScaleNumericBaseType) {
  const value = dataSet?.getNumeric(id, attrID);
  return value != null && !isNaN(value) ? scale(value) : null;
}

export interface ISetPointSelection {
  dotsRef: IDotsRef
  dataConfiguration: IDataConfigurationModel
  pointRadius: number,
  selectedPointRadius: number,
  pointColor: string,
  pointStrokeColor: string,
  getPointColorAtIndex?: (index: number) => string
}

export function setPointSelection(props: ISetPointSelection) {
  const { dotsRef, dataConfiguration } = props;
  const outerCircles = selectOuterCircles(dotsRef.current);
  if (outerCircles) {
    applySelectedClassToCircles(outerCircles, dataConfiguration);
    styleOuterCircles(outerCircles, dataConfiguration);
  }
}

export interface ISetPointCoordinates {
  dataConfiguration?: IDataConfigurationModel
  dotsRef: IDotsRef
  selectedOnly?: boolean
  pointRadius: number
  selectedPointRadius: number
  pointColor: string
  pointStrokeColor: string
  getPointColorAtIndex?: (index: number) => string
  getScreenX: ((anID: string) => number | null)
  getScreenY: ((anID: string, plotNum?:number) => number | null)
  getLegendColor?: ((anID: string) => string)
  enableAnimation: React.MutableRefObject<boolean>
}

export function setPointCoordinates(props: ISetPointCoordinates) {
  const {
    dataConfiguration, dotsRef, pointColor, pointRadius, getPointColorAtIndex,
    getScreenX, getScreenY, getLegendColor, enableAnimation, selectedPointRadius
  } = props;
  const duration = enableAnimation.current ? transitionDuration : 0;

  const lookupLegendColor = (aCaseData: CaseData) => {
    const id = aCaseData.caseID;
    const legendColor = getLegendColor ? getLegendColor(id) : '';
    if (legendColor !== '') {
      return legendColor;
    } else if (getPointColorAtIndex && aCaseData.plotNum) {
      return getPointColorAtIndex(aCaseData.plotNum);
    } else {
      return pointColor;
    }
  };

  const setPositions = (dots: DotSelection | null) => {
    if (dots !== null) {
      dots
        .transition()
        .duration(duration)
        .attr('transform', (aCaseData: CaseData) => {
          return `translate(${getScreenX(aCaseData.caseID)} ${getScreenY(aCaseData.caseID, aCaseData.plotNum)})`;
        });
    }
  };

  const styleInnerCircles = (circles: DotSelection | null) => {
    if (circles != null) {
      circles
        .attr('r', (aCaseData: CaseData) => {
          return isCircleSelected(aCaseData, dataConfiguration) ? selectedPointRadius : pointRadius;
        })
        .style('fill', (aCaseData: CaseData) => {
          return lookupLegendColor(aCaseData);
        })
        .style('stroke', (aCaseData: CaseData) => {
          return lookupLegendColor(aCaseData); //border color of inner dot should be same color as legend
        })
        .style('stroke-width', (aCaseData: CaseData) => {
          return isCircleSelected(aCaseData, dataConfiguration) ? selectedStrokeWidth : defaultStrokeWidth;
        });
    }
  };

  const graphDots = selectGraphDots(dotsRef.current);
  setPositions(graphDots);

  const innerCircles = selectInnerCircles(dotsRef.current);
  styleInnerCircles(innerCircles);

  const outerCircles = selectOuterCircles(dotsRef.current);
  if (outerCircles) applySelectedClassToCircles(outerCircles, dataConfiguration);
  styleOuterCircles(outerCircles, dataConfiguration);
}

/**
 Use the bounds of the given axes to compute slope and intercept.
*/
export function computeSlopeAndIntercept(xAxis?: IAxisModel, yAxis?: IAxisModel) {
  const xLower = xAxis && isNumericAxisModel(xAxis) ? xAxis.min : 0,
    xUpper = xAxis && isNumericAxisModel(xAxis) ? xAxis.max : 0,
    yLower = yAxis && isNumericAxisModel(yAxis) ? yAxis.min : 0,
    yUpper = yAxis && isNumericAxisModel(yAxis) ? yAxis.max : 0;

  // Make the default a bit steeper so it's less likely to look like
  // it fits a typical set of points
  const adjustedXUpper = xLower + (xUpper - xLower) / 2,
    slope = (yUpper - yLower) / (adjustedXUpper - xLower),
    intercept = yLower - slope * xLower;

  return {slope, intercept};
}

export function getDotId(caseId: string, xAttributeId: string, yAttributeId: string) {
  return `dot:{${caseId}}:{${xAttributeId}}:{${yAttributeId}}`;
}

const dotIdRegEx = /^dot:{(.+)}:{(.+)}:{(.+)}$/;
export function decipherDotId(dotId: string) {
  const match = dotId.match(dotIdRegEx);
  if (match && match.length === 4) {
    const caseId = match[1];
    const xAttributeId = match[2];
    const yAttributeId = match[3];
    return { caseId, xAttributeId, yAttributeId };
  }
  return {};
}

export function updateGraphObjectWithNewSharedModelIds(
  object: IClueObjectSnapshot,
  sharedDataSetEntries: PartialSharedModelEntry[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  if (object.objectType === "dot") {
    const { caseId, xAttributeId, yAttributeId } = decipherDotId(object.objectId);
    let newCaseId, newXAttributeId, newYAttributeId;
    sharedDataSetEntries.forEach(sharedDataSetEntry => {
      const originalSharedDataSetId = sharedDataSetEntry.sharedModel.id;
      if (originalSharedDataSetId) {
        const attributeIdMap = updatedSharedModelMap[originalSharedDataSetId]?.attributeIdMap;
        if (attributeIdMap) {
          if (xAttributeId && attributeIdMap[xAttributeId]) {
            newXAttributeId = attributeIdMap[xAttributeId];
          }
          if (yAttributeId && attributeIdMap[yAttributeId]) {
            newYAttributeId = attributeIdMap[yAttributeId];
          }
          const caseIdMap = updatedSharedModelMap[originalSharedDataSetId].caseIdMap;
          if (caseId && caseIdMap[caseId]) {
            newCaseId = caseIdMap[caseId];
          }
        }
      }
    });
    if (newCaseId && newXAttributeId && newYAttributeId) {
      const newId = getDotId(newCaseId, newXAttributeId, newYAttributeId);
      object.objectId = newId;
      return newId;
    }
  }
}

// This is a modified version of CODAP V2's SvgScene.pathBasis which was extracted from protovis
export const pathBasis = (p0: Point, p1: Point, p2: Point, p3: Point) => {
  /**
   * Matrix to transform basis (b-spline) control points to bezier control
   * points. Derived from FvD 11.2.8.
   */
  const basis = [
    [ 1/6, 2/3, 1/6,   0 ],
    [   0, 2/3, 1/3,   0 ],
    [   0, 1/3, 2/3,   0 ],
    [   0, 1/6, 2/3, 1/6 ]
  ];

  /**
   * Returns the point that is the weighted sum of the specified control points,
   * using the specified weights. This method requires that there are four
   * weights and four control points.
   */
  const weight = (w: number[]) => {
    return {
      x: w[0] * p0.x + w[1] * p1.x + w[2] * p2.x + w[3] * p3.x,
      y: w[0] * p0.y  + w[1] * p1.y  + w[2] * p2.y  + w[3] * p3.y
    };
  };

  const b1 = weight(basis[1]);
  const b2 = weight(basis[2]);
  const b3 = weight(basis[3]);

  return `C${b1.x},${b1.y},${b2.x},${b2.y},${b3.x},${b3.y}`;
};

// This is a modified version of CODAP V2's SvgScene.curveBasis which was extracted from protovis
export const curveBasis = (points: Point[]) => {
  if (points.length <= 2) return "";
  let path = "",
      p0 = points[0],
      p1 = p0,
      p2 = p0,
      p3 = points[1];
  path += pathBasis(p0, p1, p2, p3);
  for (let i = 2; i < points.length; i++) {
    p0 = p1;
    p1 = p2;
    p2 = p3;
    p3 = points[i];
    path += pathBasis(p0, p1, p2, p3);
  }
  /* Cycle through to get the last point. */
  path += pathBasis(p1, p2, p3, p3);
  path += pathBasis(p2, p3, p3, p3);
  return path;
};
