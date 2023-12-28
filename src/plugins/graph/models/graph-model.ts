import { reaction } from "mobx";
import stringify from "json-stringify-pretty-compact";
import { addDisposer, getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
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
import { withoutUndo } from "../../../models/history/without-undo";
import { SharedModelType } from "../../../models/shared/shared-model";

import { AppConfigModelType } from "../../../models/stores/app-config-model";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import {
  clueGraphColors, defaultBackgroundColor, defaultPointColor, defaultStrokeColor
} from "../../../utilities/color-utils";
import { AdornmentModelUnion } from "../adornments/adornment-types";
import { ConnectingLinesModel } from "../adornments/connecting-lines/connecting-lines-model";
import { isSharedCaseMetadata, SharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { getDotId } from "../utilities/graph-utils";
import { GraphLayerModel, IGraphLayerModel } from "./graph-layer-model";
import { isSharedDataSet, SharedDataSet } from "../../../models/shared/shared-data-set";
import { DataConfigurationModel, RoleAttrIDPair } from "./data-configuration-model";
import {
  IPlottedVariablesAdornmentModel, isPlottedVariablesAdornment, PlottedVariablesAdornmentModel
} from "../adornments/plotted-function/plotted-variables/plotted-variables-adornment-model";
import { SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import {
  kPlottedVariablesType
} from "../adornments/plotted-function/plotted-variables/plotted-variables-adornment-types";

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
    layers: types.array(GraphLayerModel /*, () => GraphLayerModel.create() */),
    // Visual properties
    // A map from IDs (which can refer to anything) to indexes to an array of colors
    _idColors: types.map(types.number),
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
      let all: Array<{ layer: IGraphLayerModel, // We add the layer here
        place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string }> = [];
      for (const layer of self.layers) {
        all = all.concat(layer.autoAssignedAttributes.map((info) => {
          return { layer, ...info };
        }));
      }
      return all;
    },
    get nextColor() {
      const colorCounts: Record<number, number> = {};
      self._idColors.forEach(index => {
        if (!colorCounts[index]) colorCounts[index] = 0;
        colorCounts[index]++;
      });
      const usedColorIndices = Object.keys(colorCounts).map(index => Number(index));
      if (usedColorIndices.length < clueGraphColors.length) {
        // If there are unused colors, return the index of the first one
        return Object.keys(clueGraphColors).map(index => Number(index))
          .filter(index => !usedColorIndices.includes(index))[0];
      } else {
        // Otherwise, use the next minimally used color's index
        const counts = usedColorIndices.map(index => colorCounts[index]);
        const minCount = Math.min(...counts);
        return usedColorIndices.find(index => colorCounts[index] === minCount) ?? 0;
      }
    }
  }))
  .views(self => ({
    get sharedVariables() {
      const smm = getSharedModelManager(self);
      if (smm?.isReady) {
        const sharedVariableModels = smm.getTileSharedModelsByType(self, SharedVariables);
        if (sharedVariableModels && sharedVariableModels.length > 0) {
          return sharedVariableModels[0] as SharedVariablesType;
        }
      }
    },
    pointColorAtIndex(plotIndex = 0) {
      if (plotIndex < self._pointColors.length) {
        return self._pointColors[plotIndex];
      } else {
        return clueGraphColors[plotIndex % clueGraphColors.length];
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
    // Currently we mostly let the first layer define what the axes should be like.
    categoriesForAxisShouldBeCentered(place: AxisPlace) {
      return self.layers[0].config.categoriesForAxisShouldBeCentered(place);
    },
    numRepetitionsForPlace(place: AxisPlace) {
      return self.layers[0].config.numRepetitionsForPlace(place);
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
     * Return list of all values for attributes of the given role across all layers.
     */
    numericValuesForAttrRole(role: GraphAttrRole): number[] {
      const allValues: number[] = [];
      return self.layers.reduce((acc: number[], layer) => {
        return acc.concat(layer.config.numericValuesForAttrRole(role));
      }, allValues);
    },
    /**
     * Return list of all values of all Y attributes across all layers.
     */
    get numericValuesForYAxis() {
      const allValues: number[] = [];
      return self.layers.reduce((acc: number[], layer) => {
        return acc.concat(layer.config.numericValuesForYAxis);
      }, allValues);
    },

    /**
     * Type (eg numeric, catgorical) for the given role.
     * Currently this is defined by the first layer; may need more subtlety in the future.
     */
    attributeType(role: GraphAttrRole) {
      return self.layers[0].config.attributeType(role);
    },
    layerForDataConfigurationId(dataConfID: string) {
      return self.layers.find(layer => layer.config.id === dataConfID);
    },
    getDataConfiguration(dataConfigID: string) {
      return this.layerForDataConfigurationId(dataConfigID)?.config;
    },
    /**
     * Search for the given attribute ID and return the layer it is found in.
     * @param id - Attribute ID
     * @returns IGraphLayerModel or undefined
     */
    layerForAttributeId(id: string) {
      for (const layer of self.layers) {
        if (layer.config.rolesForAttribute(id)) {
          return layer;
        }
      }
      return undefined;
    },
    /**
     * Find all tooltip-related attributes from all layers.
     * Returned as a list of { role, attribute } pairs.
     */
    get uniqueTipAttributes(): RoleAttrIDPair[] {
      return self.layers.reduce((prev, layer) => {
        return prev.concat(layer.config.uniqueTipAttributes);
      }, [] as RoleAttrIDPair[]);
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
      return self.layers[0].isLinked;
    },
    /**
     * Return true if no attribute has been assigned to any graph role in any layer.
     */
    get noAttributesAssigned() {
      return !self.layers.some(layer => !layer.config.noAttributesAssigned);
    },
    get annotatableObjects() {
      const tileId = getTileIdFromContent(self) ?? "";
      const xAttributeID = self.getAttributeID("x");
      const yAttributeID = self.getAttributeID("y");
      if (!self.layers[0].config.dataset) return []; // FIXME multi dataset
      const objects: IClueObject[] = [];
      self.layers[0].config.dataset.cases.forEach(c => {
        const objectId = getDotId(c.__id__, xAttributeID, yAttributeID);
        objects.push({
          tileId,
          objectId,
          objectType: "dot"
        });
      });
      return objects;
    },
    getColorForId(id: string) {
      let colorIndex = self._idColors.get(id);
      if (colorIndex === undefined) {
        // This function gets called automatically in response to plots being added to a graph.
        // withoutUndo prevents a second action being added to the undo stack when this happens.
        withoutUndo();
        colorIndex = self.nextColor;
        self._idColors.set(id, colorIndex);
      }
      return clueGraphColors[colorIndex % clueGraphColors.length];
    }
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.layers[0].config.dataset?.name;
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
    removeColorForId(id: string) {
      self._idColors.delete(id);
    },
    setColorForId(id: string, colorIndex: number) {
      self._idColors.set(id, colorIndex);
    },
    setAxis(place: AxisPlace, axis: IAxisModelUnion) {
      self.axes.set(place, axis);
    },
    removeAxis(place: AxisPlace) {
      self.axes.delete(place);
    },
    /**
     * Set the primary role for all layers.
     */
    setPrimaryRole(role: GraphAttrRole) {
      for (const layer of self.layers) {
        layer.config.setPrimaryRole(role);
      }
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
     * Remove attribute with the given role from whichever layer it is found in.
     */
    removeAttribute(role: GraphAttrRole, attrID: string) {
      self.layerForAttributeId(attrID)?.config.removeAttributeFromRole(role);
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
    clearAllSelectedCases() {
      for (const layer of self.layers) {
        layer.config.dataset?.setSelectedCases([]);
      }
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

      // Display a plotted variables adornment when this is linked to a shared variables model
      const sharedVariableModels = smm.getTileSharedModelsByType(self, SharedVariables);
      if (sharedVariableModels && sharedVariableModels.length > 0) {
        let plottedVariablesAdornment: IPlottedVariablesAdornmentModel | undefined =
          self.adornments.find(adornment => isPlottedVariablesAdornment(adornment)) as IPlottedVariablesAdornmentModel;
        if (!plottedVariablesAdornment) {
          plottedVariablesAdornment = PlottedVariablesAdornmentModel.create();
          plottedVariablesAdornment.addPlottedVariables();
        }
        self.showAdornment(plottedVariablesAdornment);
      } else {
        self.hideAdornment(kPlottedVariablesType);
      }

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
          if (index > 0 || self.layers.length > 1) {
            self.layers.splice(index, 1);
          } else if (index === 0) {
            // Unlink last remaining layer, don't remove it.
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
                newLayer.configureLinkedLayer();
                // May need these when we want to actually display the new layer:
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

export function isGraphModel(model?: ITileContentModel): model is IGraphModel {
  return model?.type === kGraphTileType;
}
