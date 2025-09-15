import {action, computed, makeObservable, observable} from "mobx";
import {createContext, useContext} from "react";
import { kAxisTickLength, kAxisTickPadding, kTopAndRightDefaultExtent } from "../graph-types";
import {AxisPlace, AxisPlaces, AxisBounds, IScaleType} from "../imports/components/axis/axis-types";
import {GraphPlace, isVertical} from "../imports/components/axis-graph-shared";
import {IAxisLayout} from "../imports/components/axis/models/axis-layout-context";
import {MultiScale} from "../imports/components/axis/models/multi-scale";

export const kDefaultGraphWidth = 480;
export const kDefaultGraphHeight = 300;
export const kDefaultLegendHeight = 0;
export interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

export class GraphLayout implements IAxisLayout {
  @observable graphWidth = kDefaultGraphWidth;
  @observable graphHeight = kDefaultGraphHeight;
  @observable legendHeight = kDefaultLegendHeight;
  // actual measured sizes of axis elements
  @observable axisBounds: Map<AxisPlace, AxisBounds> = new Map();
  // desired/required size of axis elements
  @observable desiredExtents: Map<GraphPlace, number> = new Map();
  axisScales: Map<AxisPlace, MultiScale> = new Map();

  constructor() {
    AxisPlaces.forEach(place => this.axisScales.set(place,
      new MultiScale({scaleType: "ordinal",
        orientation: isVertical(place) ? "vertical" : "horizontal"})));
    makeObservable(this);
  }

  cleanup() {
    for (const scale of this.axisScales.values()) {
      scale.cleanup();
    }
  }

  @computed get plotWidth() {
    return this.computedBounds.plot.width || this.graphWidth;
  }

  @computed get plotHeight() {
    return this.computedBounds.plot.height || this.graphHeight - this.legendHeight;
  }

  getAxisLength(place: AxisPlace) {
    return isVertical(place) ? this.plotHeight : this.plotWidth;
  }

  getAxisBounds(place: AxisPlace) {
    return this.axisBounds.get(place);
  }

  @action setAxisBounds(place: AxisPlace, bounds: AxisBounds | undefined) {
    if (bounds) {
      // We allow the axis to draw gridlines for bivariate numeric plots. Unfortunately, the gridlines end up as
      // part of the axis dom element so that we get in here with bounds that span the entire width or height of
      // the plot. We tried workarounds to get gridlines that were _not_ part of the axis element with the result
      // that the gridlines got out of sync with axis tick marks during drag. So we have this inelegant solution
      // that shouldn't affect the top and right axes when we get them but it may be worthwhile to
      // (TODO) figure out if there's a better way to render gridlines on background (or plot) so this isn't necessary.

      // given state of the graph, we may need to adjust the drop areas' bounds
      const newBounds = bounds;

      if (place === "bottom") {
        newBounds.height = Math.min(bounds.height, this.graphHeight - this.getAxisLength('left') - this.legendHeight);
        newBounds.top = this.plotHeight;
      }

      if (place === "left") {
        newBounds.height = Math.min(bounds.height, this.graphHeight - this.legendHeight);
        // if gridlines are present, axis will grow to .width + plotWidth, so we recalculate
        if (bounds.width > this.plotWidth) {
          newBounds.width -= this.plotWidth;
        }
      }

      this.axisBounds.set(place, newBounds);
    } else {
      this.axisBounds.delete(place);
    }
  }

  getAxisMultiScale(place: AxisPlace) {
    return this.axisScales.get(place) ??
      new MultiScale({scaleType: "ordinal", orientation: "horizontal"});
  }

  @computed get categorySetArrays() {
    return Array.from(this.axisScales.values()).map(scale => Array.from(scale.categorySetValues));
  }

  getAxisScale(place: AxisPlace) {
    return this.axisScales.get(place)?.scale;
  }

  @action setAxisScaleType(place: AxisPlace, scale: IScaleType) {
    console.log(`+++ setAxisScaleType`);
    this.getAxisMultiScale(place)?.setScaleType(scale);
    const length = isVertical(place) ? this.plotHeight : this.plotWidth;
    console.log(` ++ length`, length);
    this.getAxisMultiScale(place)?.setLength(length);
  }

  @action setDesiredExtent(place: GraphPlace, extent: number) {
    this.desiredExtents.set(place, extent);
    this.updateScaleRanges(this.plotWidth, this.plotHeight);
  }

  getDesiredExtent(place: GraphPlace) {
    const desiredExtent = this.desiredExtents.get(place);
    if (desiredExtent) return desiredExtent;
    const defaultExtent = place === "legend" ? 0
      : place === "top" ? kTopAndRightDefaultExtent
      : place === "left" ? 20 + kAxisTickLength + kAxisTickPadding
      : place === "bottom" ? 20 + kAxisTickLength + kAxisTickPadding
      : place === "rightNumeric" ? kTopAndRightDefaultExtent
      : place === "rightCat" ? kTopAndRightDefaultExtent
      : 0;
    return defaultExtent;
  }

  updateScaleRanges(plotWidth: number, plotHeight: number) {
    AxisPlaces.forEach(place => {
      const length = isVertical(place) ? plotHeight : plotWidth;
      this.getAxisMultiScale(place)?.setLength(length);
    });
  }

  @action setParentExtent(width: number, height: number) {
    this.graphWidth = width;
    this.graphHeight = height;
    this.updateScaleRanges(this.plotWidth, this.plotHeight);
  }

  /**
   * We assume that all the desired extents have been set so that we can compute new bounds.
   * We set the computedBounds only once at the end so there should be only one notification to respond to.
   * Todo: Eventually there will be additional room set aside at the top for formulas
   */
  @computed get computedBounds() {
    const {graphWidth, graphHeight} = this;
    const
      legendHeight = this.getDesiredExtent('legend'),
      topAxisHeight = this.getDesiredExtent('top'),
      leftAxisWidth = this.getDesiredExtent('left'),
      bottomAxisHeight = this.getDesiredExtent('bottom'),
      v2AxisWidth = this.getDesiredExtent('rightNumeric'),
      rightAxisWidth = this.getDesiredExtent('rightCat'),
      plotWidth = graphWidth - leftAxisWidth - v2AxisWidth - rightAxisWidth,
      plotHeight = graphHeight - topAxisHeight - bottomAxisHeight - legendHeight;

    if (plotWidth<1 || plotHeight<1) {
      // Layout functions can be called before tile size is finalized,
      // leading to ugly errors if negative sizes are returned.
      const zeroSize = {left: 0, top: 0, width: 0, height: 0};
      return {
        left: zeroSize,
        top: zeroSize,
        plot: zeroSize,
        bottom: zeroSize,
        legend: zeroSize,
        rightNumeric: zeroSize,
        rightCat: zeroSize,
        yPlus: zeroSize
      };
    }

    const newBounds: Record<GraphPlace, Bounds> = {
        left: {left: 0, top: topAxisHeight, width: leftAxisWidth, height: plotHeight},
        top: {left: leftAxisWidth, top: 0, width: graphWidth - leftAxisWidth - rightAxisWidth, height: topAxisHeight},
        plot: {left: leftAxisWidth, top: topAxisHeight, width: plotWidth, height: plotHeight},
        bottom: {left: leftAxisWidth, top: topAxisHeight + plotHeight, width: plotWidth, height: bottomAxisHeight},
        legend: {left: 6, top: graphHeight - legendHeight, width: graphWidth - 6, height: legendHeight},
        rightNumeric: {left: leftAxisWidth + plotWidth, top: topAxisHeight, width: v2AxisWidth, height: plotHeight},
        rightCat: {left: leftAxisWidth + plotWidth, top: topAxisHeight, width: rightAxisWidth, height: plotHeight},
        yPlus: {left: 0, top: topAxisHeight, width: leftAxisWidth, height: plotHeight} // This value is not used
      };
    return newBounds;
  }

  getComputedBounds(place: GraphPlace) {
    return this.computedBounds[place];
  }
}

export const GraphLayoutContext = createContext<GraphLayout>({} as GraphLayout);


export const useGraphLayoutContext = () => useContext(GraphLayoutContext);
