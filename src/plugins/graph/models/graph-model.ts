import {reaction} from "mobx";
import {addDisposer, getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
import {createContext, useContext} from "react";
import stringify from "json-stringify-pretty-compact";

import {AxisPlace} from "../axis/axis-types";
import {AxisModelUnion, EmptyAxisModel, IAxisModelUnion, NumericAxisModel} from "../axis/models/axis-model";
import {
  GraphAttrRole, hoverRadiusFactor, kDefaultNumericAxisBounds, kGraphLinkOptions, kGraphTileType, PlotType, PlotTypes,
  pointRadiusLogBase, pointRadiusMax, pointRadiusMin, pointRadiusSelectionAddend
} from "../graph-types";
import {DataConfigurationModel} from "./data-configuration-model";
import { SharedModelType } from "../../../models/shared/shared-model";
import {
  SharedDataSetType, kSharedDataSetType, SharedDataSet
} from "../../../models/shared/shared-data-set";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import {
  defaultBackgroundColor,
  defaultPointColor,
  defaultStrokeColor,
  kellyColors
} from "../../../utilities/color-utils";
import {
  getDataSetFromId, getTileCaseMetadata, getTileDataSet, isTileLinkedToDataSet, linkTileToDataSet
} from "../../../models/shared/shared-data-utils";
import { SharedModelChangeType } from "../../../models/shared/shared-model-manager";
import { AppConfigModelType } from "../../../models/stores/app-config-model";

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
    get data() {
      return getTileDataSet(self);
    },
    get metadata() {
      return getTileCaseMetadata(self);
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
    afterAttachToDocument() {
      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        const sharedDataSets: SharedDataSetType[] = sharedModelManager?.isReady
          ? sharedModelManager?.getSharedModelsByType<typeof SharedDataSet>(kSharedDataSetType) ?? []
          : [];

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        return { sharedModelManager, sharedDataSets, tileSharedModels };
      },
      // reaction/effect
      ({sharedModelManager, sharedDataSets, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        const tileDataSet = getTileDataSet(self);
        if (self.data || self.metadata) {
          self.config.setDataset(self.data, self.metadata);
        }
        // auto-link to DataSet if we aren't currently linked and there's only one available
        else if (!tileDataSet && sharedDataSets.length === 1) {
          linkTileToDataSet(self, sharedDataSets[0].dataSet, kGraphLinkOptions);
        }
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    setAxis(place: AxisPlace, axis: IAxisModelUnion) {
      self.axes.set(place, axis);
    },
    removeAxis(place: AxisPlace) {
      self.axes.delete(place);
    },
    setAttributeID(role: GraphAttrRole, dataSetID: string, id: string) {
      const newDataSet = getDataSetFromId(self, dataSetID);
      if (newDataSet && !isTileLinkedToDataSet(self, newDataSet)) {
        linkTileToDataSet(self, newDataSet, kGraphLinkOptions);
        self.config.clearAttributes();
        self.config.setDataset(newDataSet, getTileCaseMetadata(self));
      }
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
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType, changeType?: SharedModelChangeType) {
      if (changeType === "link" && self.data) {
        self.config.setDataset(self.data, self.metadata);
        self.setAttributeID("x", self.data.id, self.data.attributes[0]?.id ?? "");
        self.setAttributeID("y", self.data.id, self.data.attributes[1]?.id ?? "");
      }
      else if (changeType === "unlink") {
        self.setAttributeID("y", "", "");
        self.setAttributeID("x", "", "");
        self.config.setDataset(undefined, undefined);
      }
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
  args: [GraphAttrRole, string, string]
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
