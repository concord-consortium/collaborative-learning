import stringify from "json-stringify-pretty-compact";
import { getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
import {createContext, useContext} from "react";
import { IClueObject } from "../../../models/annotations/clue-object";
import { getTileIdFromContent } from "../../../models/tiles/tile-model";
import { IAdornmentModel } from "../adornments/adornment-models";
import {AxisPlace} from "../imports/components/axis/axis-types";
import {
  AxisModelUnion, EmptyAxisModel, IAxisModelUnion, NumericAxisModel
} from "../imports/components/axis/models/axis-model";
import { GraphPlace } from "../imports/components/axis-graph-shared";
import {
  GraphAttrRole, hoverRadiusFactor, kDefaultNumericAxisBounds, kGraphTileType, PlotType, PlotTypes,
  pointRadiusLogBase, pointRadiusMax, pointRadiusMin, pointRadiusSelectionAddend
} from "../graph-types";
import { SharedModelType } from "../../../models/shared/shared-model";
import { getTileCaseMetadata, getTileDataSet
} from "../../../models/shared/shared-data-utils";
import { AppConfigModelType } from "../../../models/stores/app-config-model";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import {
  defaultBackgroundColor, defaultPointColor, defaultStrokeColor, kellyColors
} from "../../../utilities/color-utils";
import { AdornmentModelUnion } from "../adornments/adornment-types";
import { isSharedCaseMetadata, SharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { ConnectingLinesModel } from "../adornments/connecting-lines/connecting-lines-model";
import { kConnectingLinesType } from "../adornments/connecting-lines/connecting-lines-types";
import { getDotId } from "../utilities/graph-utils";
import { GraphLayerModel } from "./graph-layer-model";
import { isSharedDataSet, SharedDataSet } from "../../../models/shared/shared-data-set";
import { DataConfigurationModel } from "./data-configuration-model";

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
};

export const NumberToggleModel = types
  .model('NumberToggleModel', {});

export const GraphModel = TileContentModel
  .named("GraphModel")
  .props({
    type: types.optional(types.literal(kGraphTileType), kGraphTileType),
    adornments: types.array(AdornmentModelUnion),
    // keys are AxisPlaces
    axes: types.map(AxisModelUnion),
    // TODO: should the default plot be something like "nullPlot" (which doesn't exist yet)?
    plotType: types.optional(types.enumeration([...PlotTypes]), "casePlot"),
    // TODO: this will go away
    // config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create()),
    layers: types.array(GraphLayerModel /*, () => GraphLayerModel.create() */),
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
    showMeasuresForSelection: false
  })
  .volatile(self => ({
    // prevDataSetId: "",
  }))
  .preProcessSnapshot((snapshot: any) => {
    const hasLayerAlready:boolean = (snapshot?.layers?.length || 0) > 0;
    if (!hasLayerAlready && snapshot?.config) {
      const layer = { config: snapshot.config };
      snapshot.layers = [layer];
      delete(snapshot.config);
    }
    return snapshot;
  })
  .views(self => ({
    /**
     * Transitional way to get the layer 0 DataConfiguration.
     * This method will be removed when we are fully transitioned to layers.
     */
    get config() {
      return self.layers[0].config;
    },
    get autoAssignedAttributes() {
      let all: Array<{ place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string }> = [];
      for (const layer of self.layers) {
        all = all.concat(layer.autoAssignedAttributes);
      }
      return all;
    }
  }))
  .views(self => ({
    /**
     * Returns the first shared dataset found -- TODO obsolete.
     */
    get data() {
      return getTileDataSet(self);
    },
    /**
     * Returns the first shared case metadata found -- TODO obsolete.
     */
    get metadata() {
      return getTileCaseMetadata(self);
    },
    pointColorAtIndex(plotIndex = 0) {
      if (plotIndex < self._pointColors.length) {
        return self._pointColors[plotIndex];
      } else {
        return kellyColors[plotIndex % kellyColors.length];
      }
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
    /**
     * Return a single attributeID of those in use for the given role.
     * If none is found, returns an empty string.
     */
    getAttributeID(place: GraphAttrRole) {
      for(const layer of self.layers) {
        const id = layer.config.attributeID(place);
        if (id) return id;
      }
      // This is for backwards compatibility, probably should be 'undefined'
      return '';
    },
    /**
     * Return the count of cases in all graph layers.
     */
    get totalNumberOfCases() {
      return self.layers.reduce((prev, layer) => prev+layer.config.caseDataArray.length, 0);
    },
    /**
     * Radius of points to draw on the graph.
     * This is based on the total number of points that there are.
     * Currently considers the number of points in all layers; not sure if that is correct
     * or if this method should be per-layer.
     */
    getPointRadius(use: 'normal' | 'hover-drag' | 'select' = 'normal') {
      let r = pointRadiusMax;
      const numPoints = this.totalNumberOfCases;
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
    axisShouldShowGridLines(place: AxisPlace) {
      return self.plotType === 'scatterPlot' && ['left', 'bottom'].includes(place);
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
    get annotatableObjects() {
      const tileId = getTileIdFromContent(self) ?? "";
      const xAttributeID = self.getAttributeID("x");
      const yAttributeID = self.getAttributeID("y");
      if (!self.data) return [];
      const objects: IClueObject[] = [];
      self.data.cases.forEach(c => {
        const objectId = getDotId(c.__id__, xAttributeID, yAttributeID);
        objects.push({
          tileId,
          objectId,
          objectType: "dot"
        });
      });
      return objects;
    }
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.data?.name;
    }
  }))
  .actions(self => ({
    afterCreate() {
      this.createDefaultLayerIfNeeded();
    },
    createDefaultLayerIfNeeded() {
      // Current code expects there to never be an empty set of layers,
      // so an "unlinked" dataset is set up as a layer when there isn't a real one.
      // TODO: consider refactoring so that a graph with no layers would get a reasonable default display.
      if (!self.layers.length) {
        const initialLayer = GraphLayerModel.create();
        self.layers.push(initialLayer);
        initialLayer.configureUnlinkedLayer();
        console.log('created default layer: ', initialLayer.description);
      }
    },
  }))
  .actions(self => ({
    setAxis(place: AxisPlace, axis: IAxisModelUnion) {
      self.axes.set(place, axis);
    },
    removeAxis(place: AxisPlace) {
      self.axes.delete(place);
    },
    /**
     * Use the given Attribute for the given graph role.
     * Will remove any other attributes that may have that role, unless role is 'yPlus'.
     * Will not allow switching to an attribute from a different DataSet.
     */
    setAttributeID(role: GraphAttrRole, dataSetID: string, id: string) {
      for (const layer of self.layers) {
        if (layer.config.dataset?.id === dataSetID) {
          layer.setAttributeID(role, id);
          return;
        }
      }
      console.error('setAttributeID called with attribute from DataSet that is not a layer.');
    },
    /**
     * Find Y attribute with the given ID in any layer and remove it if found.
     */
    removeYAttributeID(attrID: string) {
      self.layers.forEach((layer) => layer.config.removeYAttribute(attrID));
    },
    /**
     * Find Y attribute with given ID in any layer, and replace it with the new attribute.
     * Old and new attributes must belong to the same DataSet/Layer.
     */
    replaceYAttributeID(oldAttrId: string, newAttrId: string) {
      const layer = self.layers.find((l) => l.config.includesAttributeID(oldAttrId));
      if (layer) {
        layer.config.replaceYAttribute(oldAttrId, newAttrId);
      } else {
        console.log('replacee not found');
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
    showAdornment(adornment: IAdornmentModel, type: string) {
      const adornmentExists = self.adornments.find(a => a.type === type);
      if (adornmentExists) {
        adornmentExists.setVisibility(true);
      } else {
        self.adornments.push(adornment);
      }
    },
    hideAdornment(type: string) {
      const adornment = self.adornments.find(a => a.type === type);
      adornment?.setVisibility(false);
    }
  }))
  .actions(self => ({
    clearAutoAssignedAttributes() {
      for (const layer of self.layers) {
        layer.clearAutoAssignedAttributes();
      }
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {

      if (isSharedDataSet(sharedModel)) {
        console.log("| UASMC shared data set: ", sharedModel.dataSet.id, sharedModel);
      } else if (isSharedCaseMetadata(sharedModel)) {
        console.log("| UASMC shared metadata: ", sharedModel.data?.id, sharedModel);
      } else {
        console.log("| UASMC something else):", sharedModel);
      }

      console.log("| starting layers: ", self.layers.map(l=>l.description));

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

      // TODO: May want to find ways to do this only when necessary
      const smm = getSharedModelManager(self);
      if (!smm || !smm.isReady) return;
      const models = smm.getTileSharedModelsByType(self, SharedDataSet);
      if (!models) {
        console.log("| No models, returning");
        return;
      }

      const needToSync = true; // TODO is there a way to quickly tell if anything relevant has changed?
      if (needToSync) {
        // Sync up layers
        const modelIds = models.map(m => isSharedDataSet(m) ? m.dataSet.id : undefined);
        const layerIds = self.layers.map(layer => layer.config.dataset?.id);
        const newModels = modelIds.filter(id => !layerIds.includes(id));
        const removedModels = layerIds.filter(id => !modelIds.includes(id));
        if (removedModels.length) console.log('Layers that need to be removed: ', removedModels);
        if (newModels.length) console.log('Layers that need to be added: ', newModels);

        // Remove layers
        if (removedModels.length) {
          removedModels.forEach((id) => {
            const foundLayer = self.layers.findIndex((layer) => layer.config.dataset?.id === id );
            if (foundLayer >= 0) {
              console.log('Removing layer ', foundLayer);
              self.layers.splice(foundLayer, 1);
            }
          });
        }

        if (newModels.length) {
          console.log("| new models: ", newModels);
          const metaDataModels = smm?.getTileSharedModelsByType(self, SharedCaseMetadata);
          newModels.forEach((newModelId) => {
            const dataSetModel = models.find(m => isSharedDataSet(m) && m.dataSet.id === newModelId);
            if (dataSetModel && isSharedDataSet(dataSetModel)) {
              console.log("| found dataSetModel: ", dataSetModel, 'dataSetModel ID: ', dataSetModel.id);
              let metaDataModel = metaDataModels?.find((m) => isSharedCaseMetadata(m) && m.data?.id === newModelId);
              if (!metaDataModel) {
                const newMetaDataModel = SharedCaseMetadata.create();
                newMetaDataModel.setData(dataSetModel.dataSet);
                smm?.addTileSharedModel(self, newMetaDataModel);
                metaDataModel = newMetaDataModel;
                console.log('| No shared metadata found, created one: ', metaDataModel);
              } else {
                console.log("| found metaDataModel, look at id, and data.id", metaDataModel);
              }
              if (metaDataModel && isSharedCaseMetadata(metaDataModel)) {
                const dataConfig = DataConfigurationModel.create();
                dataConfig.setDataset(dataSetModel.dataSet, metaDataModel);
                const newLayer = GraphLayerModel.create();
                newLayer.setDataConfiguration(dataConfig);
                self.layers.push(newLayer);
                console.log('| Created layer ', newLayer);
                newLayer.configureLinkedLayer();
                self.layers[0].updateAdornments(true);
                newLayer.setDataSetListener();
              } else {
                console.log('| Metadata not found');
              }
            } else {
              console.log('| dataset not found');
            }
          });
        }
      }

      // If we are left with 0 layers, need to re-create a default one.
      self.createDefaultLayerIfNeeded();

      console.log("| Done, final layers: ", self.layers.map(l=>l.description));
    },
    // afterAttachToDocument() {
    //   console.log("AATD running");
    //   addDisposer(self, reaction(
    //     () => self.data,
    //     data => {
    //       console.log('AATD reaction running');
    //       const sharedModelManager = getSharedModelManager(self);
    //       if (!self.metadata && data) {
    //         const caseMetadata = SharedCaseMetadata.create();
    //         caseMetadata.setData(data);
    //         sharedModelManager?.addTileSharedModel(self, caseMetadata);
    //       }
    //       // CHECKME: this will only work correctly if setDataset doesn't
    //       // trigger any state updates
    //       if (self.data !== self.config.dataset) {
    //         self.config.setDataset(self.data, self.metadata);
    //       }
    //       // FIXME: When a snapshot is applied from firebase
    //       // we need to sync the config dataset. But we don't want to do
    //       // that if this update is happening because of a user action
    //       // either an undo, history playback, or an actual user action.
    //       // One possible way to address this is to make the config dataset
    //       // be a view. This means we'll need another way to identify
    //       // the first time a dataset is linked to the graph. Because we
    //       // default the x and y attribute ids in this case. We could
    //       // just check if the attributes are set already instead.
    //       // TODO: refine this comment in light of the (just added) code below

    //       // TODO: is it necessary to do this here and in updateAfterSharedModelChanges above?
    //       // if (self.data) {
    //       //   self.configureLinkedGraph();
    //       // }
    //       // else if (sharedModelManager?.isReady) {
    //       //   self.configureUnlinkedGraph();
    //       // }
    //     }, { fireImmediately: true }
    //   ));
    // }
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
  const createdGraphModel = GraphModel.create({
    axes: {
      bottom: bottomAxisModel,
      left: leftAxisModel
    },
    ...snap
  });
  // TODO: make a dedicated setting for this rather than using defaultSeriesLegend as a proxy:
  // const connectLinesByDefault = appConfig?.getSetting("defaultConnectedLines", "graph");
  const connectByDefault = appConfig?.getSetting("defaultSeriesLegend", "graph");
  if (connectByDefault) {
    const cLines = ConnectingLinesModel.create({type: kConnectingLinesType, isVisible: true});
    createdGraphModel.showAdornment(cLines, kConnectingLinesType);
  }
  return createdGraphModel;
}

export interface SetAttributeIDAction extends ISerializedActionCall {
  name: "setAttributeID"
  args: [GraphAttrRole, string, string]
}
export function isSetAttributeIDAction(action: ISerializedActionCall): action is SetAttributeIDAction {
  return action.name === "setAttributeID";
}

export interface RemoveYAttributeAction extends ISerializedActionCall {
  name: "removeYAttributeID",
  args: [string]
}
export function isRemoveYAttributeAction(action: ISerializedActionCall): action is RemoveYAttributeAction {
  return action.name === "removeYAttributeID";
}

export interface ReplaceYAttributeAction extends ISerializedActionCall {
  name: "replaceYAttributeID",
  args: [string, string]
}
export function isReplaceYAttributeAction(action: ISerializedActionCall): action is ReplaceYAttributeAction {
  return action.name === "replaceYAttributeID";
}

export type AttributeAssignmentAction = SetAttributeIDAction | RemoveYAttributeAction | ReplaceYAttributeAction;
export function isAttributeAssignmentAction(action: ISerializedActionCall): action is AttributeAssignmentAction {
  return ["setAttributeID", "removeYAttributeID", "replaceYAttributeID"].includes(action.name);
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
