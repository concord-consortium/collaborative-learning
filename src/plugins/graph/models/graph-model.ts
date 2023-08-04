import {Instance, ISerializedActionCall, SnapshotIn, types, getSnapshot, addDisposer} from "mobx-state-tree";
import {reaction} from "mobx";
import {createContext, useContext} from "react";
import stringify from "json-stringify-pretty-compact";

import {AxisPlace} from "../axis/axis-types";
import {AxisModelUnion, EmptyAxisModel, IAxisModelUnion, NumericAxisModel} from "../axis/models/axis-model";
import {
  GraphAttrRole, hoverRadiusFactor, kDefaultNumericAxisBounds, kGraphTileType, PlotType, PlotTypes,
  pointRadiusLogBase, pointRadiusMax, pointRadiusMin, pointRadiusSelectionAddend
} from "../graph-types";
import {DataConfigurationModel} from "./data-configuration-model";
import {IDataSet} from "../../../models/data/data-set";
import { SharedModelType } from "../../../models/shared/shared-model";
import { ISharedCaseMetadata, isSharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import {isSharedDataSet} from "../../../models/shared/shared-data-set";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import {
  defaultBackgroundColor,
  defaultPointColor,
  defaultStrokeColor,
  kellyColors
} from "../../../utilities/color-utils";
import { AppConfigModelType } from "../../../models/stores/app-config-model";
import { getAppConfig } from "../../../models/tiles/tile-environment";

export type SharedModelChangeHandler = (sharedModel: SharedModelType | undefined, type: string) => void;

export interface GraphProperties {
  axes: Record<string, IAxisModelUnion>
  plotType: PlotType
}

export type BackgroundLockInfo = {
  locked: true,
  xAxisLowerBound: number,
  xAxisUpperBound: number,
  yAxisLowerBound: number,
  yAxisUpperBound: number
}

export const NumberToggleModel = types
  .model('NumberToggleModel', {});

export const GraphModel = TileContentModel
  .named("GraphModel")
  .props({
    type: types.optional(types.literal(kGraphTileType), kGraphTileType),
    // keys are AxisPlaces
    axes: types.map(AxisModelUnion),
    plotType: types.optional(types.enumeration([...PlotTypes]), "casePlot"),
    config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create()),
    // Visual properties
    _pointColors: types.optional(types.array(types.string), [defaultPointColor]),
    _pointStrokeColor: defaultStrokeColor,
    pointStrokeSameAsFill: false,
    plotBackgroundColor: defaultBackgroundColor,
    pointSizeMultiplier: 1,
    isTransparent: false,
    plotBackgroundImageID: "",
    // todo: how to use this type?
    plotBackgroundLockInfo: types.maybe(types.frozen<BackgroundLockInfo>()),
    // numberToggleModel: types.optional(types.union(NumberToggleModel, null))
    showParentToggles: false,
    showMeasuresForSelection: false,
  })
  .views(self => ({
    get data(): IDataSet | undefined {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = sharedModelManager?.getTileSharedModels(self).find(m => isSharedDataSet(m));
      return isSharedDataSet(sharedModel) ? sharedModel.dataSet : undefined;
    },
    get metadata(): ISharedCaseMetadata | undefined {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = sharedModelManager?.getTileSharedModels(self).find(m => isSharedCaseMetadata(m));
      return isSharedCaseMetadata(sharedModel) ? sharedModel : undefined;
    },
    pointColorAtIndex(plotIndex = 0) {
      return self._pointColors[plotIndex] ?? kellyColors[plotIndex % kellyColors.length];
    },
    get pointColor() {
      return this.pointColorAtIndex(0);
    },
    get pointStrokeColor() {
      return self.pointStrokeSameAsFill ? this.pointColor : self._pointStrokeColor;
    },
    getAxis(place: AxisPlace) {
      return self.axes.get(place);
    },
    getAttributeID(place: GraphAttrRole) {
      return self.config.attributeID(place) ?? '';
    },
    getPointRadius(use: 'normal' | 'hover-drag' | 'select' = 'normal') {
      let r = pointRadiusMax;
      const numPoints = self.config.caseDataArray.length;
      // for loop is fast equivalent to radius = max( minSize, maxSize - floor( log( logBase, max( dataLength, 1 )))
      for (let i = pointRadiusLogBase; i <= numPoints; i = i * pointRadiusLogBase) {
        --r;
        if (r <= pointRadiusMin) break;
      }
      const result = r * self.pointSizeMultiplier;
      switch (use) {
        case "normal":
          return result;
        case "hover-drag":
          return result * hoverRadiusFactor;
        case "select":
          return result + pointRadiusSelectionAddend;
      }
    },
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);

      // json-stringify-pretty-compact is used, so the exported content is more
      // compact. It results in something close to what we used to get when the
      // export was created using a string builder.
      return stringify(snapshot, {maxLength: 200});
    }
  }))
  .views(self => ({
    axisShouldShowGridLines(place: AxisPlace) {
      return self.plotType === 'scatterPlot' && ['left', 'bottom'].includes(place);
    }
  }))
  .actions(self => ({
    setAxis(place: AxisPlace, axis: IAxisModelUnion) {
      self.axes.set(place, axis);
    },
    removeAxis(place: AxisPlace) {
      self.axes.delete(place);
    },
    setAttributeID(role: GraphAttrRole, id: string) {
      if (role === 'yPlus') {
        self.config.addYAttribute({attributeID: id});
      } else {
        self.config.setAttribute(role, {attributeID: id});
      }
    },
    setPlotType(type: PlotType) {
      self.plotType = type;
    },
    setGraphProperties(props: GraphProperties) {
      (Object.keys(props.axes) as AxisPlace[]).forEach(aKey => {
        this.setAxis(aKey, props.axes[aKey]);
      });
      self.plotType = props.plotType;
    },
    setPointColor(color: string, plotIndex = 0) {
      self._pointColors[plotIndex] = color;
    },
    setPointStrokeColor(color: string) {
      self._pointStrokeColor = color;
    },
    setPointStrokeSameAsFill(isTheSame: boolean) {
      self.pointStrokeSameAsFill = isTheSame;
    },
    setPlotBackgroundColor(color: string) {
      self.plotBackgroundColor = color;
    },
    setPointSizeMultiplier(multiplier: number) {
      self.pointSizeMultiplier = multiplier;
    },
    setIsTransparent(transparent: boolean) {
      self.isTransparent = transparent;
    },
    setShowParentToggles(show: boolean) {
      self.showParentToggles = show;
    },
    setShowMeasuresForSelection(show: boolean) {
      self.showMeasuresForSelection = show;
    },
  }))
  .actions(self => ({
    configureGraphOnLink() {
      if (!self.data) {
        console.warn("GraphModel.configureGraphOnLink requires a dataset");
        return;
      }
      if (getAppConfig(self)?.getSetting("emptyPlotIsNumeric", "graph")) {
        const attributeCount = self.data.attributes.length;
        if (!attributeCount) return;

        const xAttrId = self.getAttributeID("x");
        const isValidXAttr = !!self.data.attrFromID(xAttrId);
        const yAttrId = self.getAttributeID("y");
        const isValidYAttr = !!self.data.attrFromID(yAttrId);

        if (!isValidXAttr && !isValidYAttr) {
          self.setAttributeID("x", self.data.attributes[0].id);

          if (attributeCount > 1) {
            console.log("setting the y to attributes[1]");
            self.setAttributeID("y", self.data.attributes[1].id);
          }
        }
      }
    },
    configureGraphOnUnlink() {
      if (self.data) {
        console.warn("GraphModel.configureGraphOnUnlink expects the dataset to be unlinked");
        return;
      }
      if (self.getAttributeID("y")) {
        self.setAttributeID("y", "");
      }
      if (self.getAttributeID("x")) {
        self.setAttributeID("x", "");
      }
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // We need to figure out how to know if we need to update the
      // dataSet. The config.dataSet is volatile, but setting it
      // might also update state in the config I'm not sure
      // We could just check if they match and then update it if
      // not. And then we'd also need a reaction that does the same
      // thing, but we'd need the reaction to only do this if it isn't
      // being done here.

      // Note this will also happen in the reaction below
      // we do it here just to be safe incase this function is called
      // first
      if (self.data !== self.config.dataset) {
        self.config.setDataset(self.data);
      }

      // TODO: is it necessary to do this here and in the reaction below?
      if (self.data) {
        self.configureGraphOnLink();
      }
      else {
        self.configureGraphOnUnlink();
      }
    },
    afterAttach() {
      addDisposer(self, reaction(
        () => self.data,
        (data, prevData, more) => {
          // CHECKME: this will only work correctly if setDataset doesn't
          // trigger any state updates
          if (self.data !== self.config.dataset) {
            self.config.setDataset(self.data);
          }
          // FIXME: When a snapshot is applied from firebase
          // we need to sync the config dataset. But we don't want to do
          // that if this update is happening because of a user action
          // either an undo, history playback, or an actual user action.
          // One possible way to address this is to make the config dataset
          // be a view. This means we'll need another way to identify
          // the first time a dataset is linked to the graph. Because we
          // default the x and y attribute ids in this case. We could
          // just check if the attributes are set already instead.
          // TODO: refine this comment in light of the (just added) code below

          // TODO: is it necessary to do this here and in updateAfterSharedModelChanges above?
          if (self.data) {
            self.configureGraphOnLink();
          }
          else {
            self.configureGraphOnUnlink();
          }
        }
      ));
    }
  }));
export interface IGraphModel extends Instance<typeof GraphModel> {}
export interface IGraphModelSnapshot extends SnapshotIn<typeof GraphModel> {}

export function createGraphModel(snap?: IGraphModelSnapshot, appConfig?: AppConfigModelType) {
  const [min, max] = kDefaultNumericAxisBounds;
  const emptyPlotIsNumeric = appConfig?.getSetting("emptyPlotIsNumeric", "graph");
  const bottomAxisModel = emptyPlotIsNumeric
                            ? NumericAxisModel.create({place: "bottom", min, max})
                            : EmptyAxisModel.create({place: "bottom"});
  const leftAxisModel = emptyPlotIsNumeric
                          ? NumericAxisModel.create({place: "left", min, max})
                          : EmptyAxisModel.create({place: "left"});
  return GraphModel.create({
    axes: {
      bottom: bottomAxisModel,
      left: leftAxisModel
    },
    ...snap
  });
}

export interface SetAttributeIDAction extends ISerializedActionCall {
  name: "setAttributeID"
  args: [GraphAttrRole, string]
}

export function isSetAttributeIDAction(action: ISerializedActionCall): action is SetAttributeIDAction {
  return action.name === "setAttributeID";
}

export interface SetGraphVisualPropsAction extends ISerializedActionCall {
  name: "setGraphVisualProps"
  args: [string | number | boolean]
}

export function isGraphVisualPropsAction(action: ISerializedActionCall): action is SetGraphVisualPropsAction {
  return ['setPointColor', 'setPointStrokeColor', 'setPointStrokeSameAsFill', 'setPlotBackgroundColor',
    'setPointSizeMultiplier', 'setIsTransparent'].includes(action.name);
}

export const GraphModelContext = createContext<IGraphModel>({} as IGraphModel);

export const useGraphModelContext = () => useContext(GraphModelContext);

export function isGraphModel(model?: ITileContentModel): model is IGraphModel {
  return model?.type === kGraphTileType;
}
