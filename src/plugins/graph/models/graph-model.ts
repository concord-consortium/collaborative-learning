import { reaction } from "mobx";
import stringify from "json-stringify-pretty-compact";
import { addDisposer, getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
import {createContext, useContext} from "react";
import { IClueObject } from "../../../models/annotations/clue-object";
import { getTileIdFromContent } from "../../../models/tiles/tile-model";
import { IAdornmentModel } from "../adornments/adornment-models";
import { AxisPlace } from "../imports/components/axis/axis-types";
import {
  AxisModelUnion, EmptyAxisModel, IAxisModelUnion, NumericAxisModel
} from "../imports/components/axis/models/axis-model";
import { GraphPlace } from "../imports/components/axis-graph-shared";
import {
  GraphAttrRole, hoverRadiusFactor, kDefaultNumericAxisBounds, kGraphTileType,
  PlotType, PlotTypes, pointRadiusMax, pointRadiusSelectionAddend
} from "../graph-types";
import { SharedModelType } from "../../../models/shared/shared-model";
import { getTileCaseMetadata } from "../../../models/shared/shared-data-utils";
import { AppConfigModelType } from "../../../models/stores/app-config-model";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import {
  defaultBackgroundColor, defaultPointColor, defaultStrokeColor, kellyColors
} from "../../../utilities/color-utils";
import { AdornmentModelUnion } from "../adornments/adornment-types";
import { ConnectingLinesModel } from "../adornments/connecting-lines/connecting-lines-model";
import { isSharedCaseMetadata, SharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { getDotId } from "../utilities/graph-utils";
import { GraphLayerModel } from "./graph-layer-model";
import { isSharedDataSet, SharedDataSet } from "../../../models/shared/shared-data-set";
import { DataConfigurationModel } from "./data-configuration-model";
import { PlottedFunctionAdornmentModel } from "../adornments/plotted-function/plotted-function-adornment-model";
import { kSharedVariablesID, SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { kPlottedFunctionType } from "../adornments/plotted-function/plotted-function-adornment-types";

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
      const { config, ...others } = snapshot;
      if (config != null) {
        return {
          layers: [{ config }],
          ...others
        };
      }
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
      return self.layers[0].config.dataset;
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
     * This is based on the total number of points that there are in all layers.
     */
    getPointRadius(use: 'normal' | 'hover-drag' | 'select' = 'normal') {
      const r = pointRadiusMax;

      //*************************************************************************************************************
      //We used to return "result" which decreased the inner radius circle when we clicked on a
      //selected point. Leaving this commented in case we want to change the radius when we click on a point
      //**************************************************************************************************************

      // const numPoints = self.config.caseDataArray.length;
      // // for loop is fast equivalent to radius = max( minSize, maxSize - floor( log( logBase, max( dataLength, 1 )))
      // for (let i = pointRadiusLogBase; i <= numPoints; i = i * pointRadiusLogBase) {
      //   --r;
      //   if (r <= pointRadiusMin) break;
      // }
      // const result = r * self.pointSizeMultiplier;

      switch (use) {
        case "normal":
          return r;
        case "hover-drag":
          return r * hoverRadiusFactor;
        case "select":
          return r + pointRadiusSelectionAddend;
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
    get isLinkedToDataSet() {
      return !!self.layers[0]?.isLinked;
    },
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
          layer.setAttributeID(role, dataSetID, id);
          return;
        }
      }
      console.error('setAttributeID called with attribute from DataSet that is not a layer.');
    },
    /**
     * Find Y attribute with the given ID in any layer and remove it if found.
     */
    removeYAttributeID(attrID: string) {
      for(const layer of self.layers) {
        if (layer.config.yAttributeIDs.includes(attrID)) {
          layer.config.removeYAttributeWithID(attrID);
          return;
        }
      }
      console.warn('removeYAttributeID: ', attrID, ' not found in any layer');
    },
    /**
     * Find Y attribute with given ID in any layer, and replace it with the new attribute.
     * Old and new attributes must belong to the same DataSet/Layer.
     * Note, calls to this method are observed by Graph's handleNewAttributeID method.
     */
    replaceYAttributeID(oldAttrId: string, newAttrId: string) {
      for(const layer of self.layers) {
        if (layer.config.yAttributeIDs.includes(oldAttrId)) {
          layer.config.replaceYAttribute(oldAttrId, newAttrId);
          return;
      }
      console.warn('replaceYAttributeID: attribute ', oldAttrId, ' not found in any layer');
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
    showAdornment(adornment: IAdornmentModel) {
      const adornmentExists = self.adornments.find(a => a.type === adornment.type);
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
    },
    plotFunction(x: number) {
      const smm = getSharedModelManager(self);
      if (smm && smm.isReady) {
        const sharedVariableModels = smm.getTileSharedModelsByType(self, SharedVariables);
        if (sharedVariableModels.length > 0) {
          const sharedVariables = sharedVariableModels[0] as SharedVariablesType;
          const variables = sharedVariables.getVariables();
          const xVariable = variables.find(variable => variable.name === "x");
          const yVariable = variables.find(variable => variable.name === "y");
          if (xVariable && yVariable) {
            if (x <= .9) {
              console.log(`OOO plotting`, x);
            } else if (x >= 2.298) {
              console.log(` OO plotting`, x);
            }
            // const startingX = xVariable.value;
            // xVariable.setValue(x);
            const yValue = yVariable.computedValue;
            // xVariable.setValue(startingX);
            if (yValue !== undefined) return yValue;
          }
        }
      }
      return x ** 2;
    }
  }))
  .actions(self => ({
    /**
     * Update layers as needed when shared models are attached or detached.
     * Called by the shared model manager.
     * @param sharedModel
     */
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      const smm = getSharedModelManager(self);
      if (!smm || !smm.isReady) return;
      const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
      if (!sharedDataSets) {
        console.warn("Unable to query for shared datasets");
        return;
      }

      // This handles auto-assignment in case dataset has changed in significant ways (eg, columns and recreated)
      if (isSharedDataSet(sharedModel)) {
        const dataSetId = sharedModel.dataSet?.id;
        if (dataSetId) {
          const changedLayer = self.layers.find((layer) => {
            return layer.config.dataset?.id === dataSetId; });
          changedLayer?.configureLinkedLayer();
        }
      }

      // Would be nice if there was a simple way to tell if anything relevant has changed.
      // This is a little heavy-handed but does the job.
      const sharedDatasetIds = sharedDataSets.map(m => isSharedDataSet(m) ? m.dataSet.id : undefined);
      const layerDatasetIds = self.layers.map(layer => layer.config.dataset?.id);
      const attachedDatasetIds = sharedDatasetIds.filter(id => !layerDatasetIds.includes(id));
      const detachedDatasetIds = layerDatasetIds.filter(id => !sharedDatasetIds.includes(id));

      // Remove any layers for datasets that have been unlinked from this tile
      if (detachedDatasetIds.length) {
        detachedDatasetIds.forEach((id) => {
          const index = self.layers.findIndex((layer) => layer.config.dataset?.id === id);
          if (index > 0) {
            self.layers.splice(index, 1);
          } else if (index === 0) {
            // Unlink layer 0, don't remove it.
            self.layers[0].setDataset(undefined, undefined);
            self.layers[0].configureUnlinkedLayer();
            self.layers[0].updateAdornments();
          } else {
            console.warn('Failed to find layer with dataset id ', id);
          }
        });
      }

      // Create layers for any datasets newly linked to this tile
      if (attachedDatasetIds.length) {
        const sharedMetadatas = smm.getTileSharedModelsByType(self, SharedCaseMetadata);
        const allMetadatas = smm.getSharedModelsByType("SharedCaseMetadata");
        attachedDatasetIds.forEach((newModelId) => {
          const dataSetModel = sharedDataSets.find(m => isSharedDataSet(m) && m.dataSet.id === newModelId);
          if (dataSetModel && isSharedDataSet(dataSetModel)) {
            // Find a matching MetaDataModel, first looking in already-attached models
            let metaDataModel = sharedMetadatas.find((m) => isSharedCaseMetadata(m) && m.data?.id === newModelId);
            if (!metaDataModel) {
              // See if we can find one that already exists, but is not linked. If so, link to it.
              metaDataModel = allMetadatas.find((m) => isSharedCaseMetadata(m) && m.data?.id === newModelId);
              if (metaDataModel) {
                smm.addTileSharedModel(self, metaDataModel);
              }
            }
            if (!metaDataModel) {
              // No existing shared metadata exists, create one
              const newMetaDataModel = SharedCaseMetadata.create();
              newMetaDataModel.setData(dataSetModel.dataSet);
              smm.addTileSharedModel(self, newMetaDataModel);
              metaDataModel = newMetaDataModel;
            }
            if (metaDataModel && isSharedCaseMetadata(metaDataModel)) {
              // Update default layer, or create a new one.
              if (!self.layers[0].isLinked) {
                self.layers[0].setDataset(dataSetModel.dataSet, metaDataModel);
                self.layers[0].configureLinkedLayer();
                self.layers[0].updateAdornments();
              } else {
                const newLayer = GraphLayerModel.create();
                self.layers.push(newLayer);
                const dataConfig = DataConfigurationModel.create();
                newLayer.setDataConfiguration(dataConfig);
                dataConfig.setDataset(dataSetModel.dataSet, metaDataModel);
                // May need these when we want to actually display the new layer:
                // newLayer.configureLinkedLayer();
                // newLayer.updateAdornments(true);
                // newLayer.setDataSetListener();
              }
            } else {
              console.warn('| Metadata not found');
            }
          } else {
            console.warn('| dataset not found');
          }
        });
      }
    },
    afterAttach() {
      if (self.layers.length === 1 && !self.layers[0].config.dataset && !self.layers[0].config.isEmpty) {
        // Non-empty DataConfiguration lacking a dataset reference = legacy data needing a one-time fix.
        // We can't do that fix until the SharedModelManager is ready, though.
        addDisposer(self, reaction(
          () => {
            return self.tileEnv?.sharedModelManager?.isReady;
          },
          (ready) => {
            if (!ready) return;
            this.setDataConfigurationReferences();
          }
        ));
      }

      // Display a plotted function when this is linked to a SharedVariableModel
      addDisposer(self, reaction(
        () => {
          const smm = getSharedModelManager(self);
          let sharedVariableModels;
          if (smm?.isReady) {
            sharedVariableModels = smm.getTileSharedModelsByType(self, SharedVariables);
          }
          return sharedVariableModels;
        },
        (sharedVariableModels) => {
          console.log(`ooo Changing plotted functions`, sharedVariableModels?.length);
          if (sharedVariableModels && sharedVariableModels.length > 0) {
            const plottedFunctionAdornment = PlottedFunctionAdornmentModel.create();
            plottedFunctionAdornment.addPlottedFunction(self.plotFunction);
              // getPlottedFunction(sharedVariableModels[0] as SharedVariablesType));
            self.showAdornment(plottedFunctionAdornment);
            console.log(` oo displaying`);
          } else {
            self.hideAdornment(kPlottedFunctionType);
            console.log(` oo hiding`);
          }
        }
      ));

      // Link to any SharedVariableModel in the document
      console.log(`xxx Adding shared model disposer`);
      addDisposer(self, reaction(
        () => {
          const smm = getSharedModelManager(self);
          const isReady = smm?.isReady;
          const sharedVariableModels = isReady && smm.getSharedModelsByType(kSharedVariablesID);
          const tileSharedVariables = isReady && smm.getTileSharedModelsByType(self, SharedVariables);
          console.log(`~~~ reaction condition`, { smm, sharedVariableModels, tileSharedVariables });
          return { smm, sharedVariableModels, tileSharedVariables };
        },
        ({smm, sharedVariableModels, tileSharedVariables}) => {
          console.log(`--- Connecting to shared variables`, sharedVariableModels, tileSharedVariables);
          if (smm && sharedVariableModels && sharedVariableModels.length > 0
            && tileSharedVariables && tileSharedVariables.length === 0
          ) {
            console.log(` -- Adding shared model`, sharedVariableModels[0]);
            smm.addTileSharedModel(self, sharedVariableModels[0]);
          }
        }
      ));
    },
    setDataConfigurationReferences() {
      // Updates pre-existing DataConfiguration objects that don't have the now-required references
      // for dataset and metadata. We can determine these from the unique shared models these
      // legacy tile models should have.
      const smm = getSharedModelManager(self);
      if (smm && smm.isReady) {
        const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
        if (sharedDataSets.length === 1) {
          const sds = sharedDataSets[0];
          if (isSharedDataSet(sds)) {
            self.layers[0].config.dataset = sds.dataSet;
            console.log('Updated legacy document - set dataset reference');
          }
        }
        const sharedMetadata = smm.getTileSharedModelsByType(self, SharedCaseMetadata);
        if (sharedMetadata.length === 1) {
          const smd = sharedMetadata[0];
          if (isSharedCaseMetadata(smd)) {
            self.layers[0].config.metadata = smd;
            console.log('Updated legacy document - set metadata reference');
          }
        }
      } else {
        console.warn('Could not update missing dataset/metadata - SharedModelManager not ready');
      }

    },

    afterAttachToDocument() {
      for (const layer of self.layers) {
        layer.config.handleDataSetChange();
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
  const createdGraphModel = GraphModel.create({
    plotType: emptyPlotIsNumeric ? "scatterPlot" : "casePlot",
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
    const cLines = ConnectingLinesModel.create();
    createdGraphModel.showAdornment(cLines);
  }

  // TODO Add plotted function adornment at the proper time, like when connecting to a SharedVariableModel
  // const plottedFunctionAdornment = PlottedFunctionAdornmentModel.create();
  // plottedFunctionAdornment.addPlottedFunction(x => x ** 2);
  // createdGraphModel.showAdornment(plottedFunctionAdornment);

  return createdGraphModel;
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
