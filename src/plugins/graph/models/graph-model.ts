import { ObservableMap, reaction } from "mobx";
import stringify from "json-stringify-pretty-compact";
import { addDisposer, getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { IAdornmentModel } from "../adornments/adornment-models";
import { AxisPlace } from "../imports/components/axis/axis-types";
import {
  AxisModelUnion, EmptyAxisModel, IAxisModelUnion, NumericAxisModel
} from "../imports/components/axis/models/axis-model";
import { GraphPlace } from "../imports/components/axis-graph-shared";
import {
  GraphAttrRole, GraphEditMode, hoverRadiusFactor, kDefaultAxisLabel, kDefaultNumericAxisBounds, kGraphTileType,
  PlotType, PlotTypes, Point, pointRadiusMax, pointRadiusSelectionAddend, RectSize
} from "../graph-types";
import { withoutUndo } from "../../../models/history/without-undo";
import { SharedModelType } from "../../../models/shared/shared-model";

import { AppConfigModelType } from "../../../models/stores/app-config-model";
import {ITileContentModel, TileContentModel} from "../../../models/tiles/tile-content";
import {ITileExportOptions} from "../../../models/tiles/tile-content-info";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import {
  clueDataColorInfo, defaultBackgroundColor, defaultPointColor, defaultStrokeColor
} from "../../../utilities/color-utils";
import { AdornmentModelUnion } from "../adornments/adornment-types";
import { isSharedCaseMetadata, SharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import { getDotId } from "../utilities/graph-utils";
import { GraphLayerModel, IGraphLayerModel } from "./graph-layer-model";
import { isSharedDataSet, SharedDataSet } from "../../../models/shared/shared-data-set";
import { DataConfigurationModel, RoleAttrIDPair } from "./data-configuration-model";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { multiLegendParts } from "../components/legend/legend-registration";
import { addAttributeToDataSet, DataSet } from "../../../models/data/data-set";
import { getDocumentContentFromNode } from "../../../utilities/mst-utils";
import { ICase } from "../../../models/data/data-set-types";
import { findLeastUsedNumber } from "../../../utilities/math-utils";

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
    lockAxes: false,
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
    showMeasuresForSelection: false,
    xAttributeLabel: types.optional(types.string, kDefaultAxisLabel),
    yAttributeLabel: types.optional(types.string, kDefaultAxisLabel)
  })
  .volatile(self => ({
    // True if a dragging operation is ongoing - automatic rescaling is deferred until drag is done.
    interactionInProgress: false,
    editingMode: "none" as GraphEditMode,
    editingLayerId: undefined as string|undefined,
    // Map from annotation IDs to their current locations.
    // This allows adornments to flexibly give us these locations.
    annotationLocationCache: new ObservableMap<string,Point>(),
    annotationSizesCache: new ObservableMap<string,RectSize>()
  }))
  .preProcessSnapshot((snapshot: any) => {
    // See if any changes are needed
    const hasLayerAlready = (snapshot?.layers?.length || 0) > 0;
    const needsLayerAdded = !hasLayerAlready && snapshot?.config;
    const hasLegacyAdornment = snapshot?.adornments
      && snapshot.adornments.find((adorn: any) => adorn.type === 'Connecting Lines');
    const invalidLeftAxis = snapshot?.axes?.left?.min === null || snapshot?.axes?.left?.max === null;
    const invalidBotAxis = snapshot?.axes?.bottom?.min === null || snapshot?.axes?.bottom?.max === null;
    if (!needsLayerAdded && !hasLegacyAdornment && !invalidLeftAxis && !invalidBotAxis) {
      return snapshot;
    }
    const newSnap = cloneDeep(snapshot);
    // Remove connecting-lines adornment if found
    if(hasLegacyAdornment) {
      newSnap.adornments = snapshot.adornments.filter((adorn: any) => adorn.type !== 'Connecting Lines');
    }
    // Add layers array if missing
    if (needsLayerAdded) {
      newSnap.layers = [{ config: snapshot.config }];
    }
    // Fix axes if needed
    if (invalidLeftAxis) {
      [newSnap.axes.left.min, newSnap.axes.left.max] = kDefaultNumericAxisBounds;
    }
    if (invalidBotAxis) {
      [newSnap.axes.bottom.min, newSnap.axes.bottom.max] = kDefaultNumericAxisBounds;
    }
    return newSnap;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
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
      return findLeastUsedNumber(clueDataColorInfo.length, self._idColors.values());
    },
    getAdornmentOfType(type: string) {
      return self.adornments.find(a => a.type === type);
    }
  }))
  .views(self => ({
    pointColorAtIndex(plotIndex = 0) {
      if (plotIndex < self._pointColors.length) {
        return self._pointColors[plotIndex];
      } else {
        return clueDataColorInfo[plotIndex % clueDataColorInfo.length].color;
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
     * Return list of all values to be plotted on the given role across all layers and adornments.
     */
    numericValuesForAttrRole(role: GraphAttrRole): number[] {
      let allValues: number[] = [];
      allValues = self.layers.reduce((acc: number[], layer) => {
        return acc.concat(layer.config.numericValuesForAttrRole(role));
      }, allValues);
      return self.adornments.reduce((acc: number[], adornment) => {
        return acc.concat(adornment.numericValuesForAttrRole(role));
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
    getLayerById(layerId: string): IGraphLayerModel|undefined {
      if (!layerId) return undefined;
      return self.layers.find(layer => layer.id === layerId);
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
        if (layer.config.rolesForAttribute(id).length) {
          return layer;
        }
      }
      return undefined;
    },
    /**
     * Return a list of layers that can be edited.
     */
    getEditableLayers() {
      return self.layers.filter(l => l.editable);
    },
    /**
     * Return the layer currently being edited, or undefined if none.
     */
    get editingLayer(): IGraphLayerModel|undefined {
      if (!self.editingLayerId) return undefined;
      return this.getLayerById(self.editingLayerId);
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
      // TODO: Consider updating exportJson for hashing support

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
    get isAnyCellSelected() {
      for (const layer of self.layers) {
        if (layer.config.dataset?.isAnyCellSelected) return true;
      }
      return false;
    },
    get isAnyAdornmentSelected() {
      return self.adornments.some(adorn => adorn.hasSelectedInstances());
    },
    /**
     * Return true if no attribute has been assigned to any graph role in any layer.
     */
    get noAttributesAssigned() {
      return !self.layers.some(layer => !layer.config.noAttributesAssigned);
    },
    // PrimaryRole should be in agreement on all layers, so just return the first.
    get primaryRole() {
      return self.layers[0].config?.primaryRole;
    },
  }))
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      const objects: IClueTileObject[] = [];
      for (const layer of self.layers) {
        if (layer.config.dataset) {
          const xAttributeID = layer.config.attributeID("x");
          for (const yAttributeID of layer.config.yAttributeIDs) {
            for (const c of layer.config.dataset.cases) {
              if (xAttributeID && yAttributeID) {
                const objectId = getDotId(c.__id__, xAttributeID, yAttributeID);
                objects.push({
                  objectId,
                  objectType: "dot"
                });
              }
            }
          }
        }
      }
      // Include any objects contributed by adornments
      for (const adorn of self.adornments) {
        objects.push(...adorn.annotatableObjects);
      }
      return objects;
    },
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
    /**
     * Creates an "added by hand" dataset and attaches it as a layer to the graph.
     * The layer is marked as editable so that the user can add and edit points.
     */
    createEditableLayer() {
      const smm = getSharedModelManager(self);
      const doc = getDocumentContentFromNode(self);
      if (doc && smm && smm.isReady) {
        const datasetName = doc.getUniqueSharedModelName("Added by hand");
        const
          xName = "X Variable",
          yName = "Y Variable 1";
        const dataset = DataSet.create({ name: datasetName });
        const xAttr = addAttributeToDataSet(dataset, { name: xName });
        const yAttr = addAttributeToDataSet(dataset, { name: yName });
        const sharedDataSet = SharedDataSet.create({ dataSet: dataset });
        smm.addTileSharedModel(self, sharedDataSet, true);

        const metadata = SharedCaseMetadata.create();
        metadata.setData(dataset);
        smm.addTileSharedModel(self, metadata);

        const layer = GraphLayerModel.create({ editable: true });
        self.layers.push(layer);
        // Remove default layer if there was one
        if (!self.layers[0].isLinked) {
          self.layers.splice(0, 1);
        }

        const dataConfiguration = DataConfigurationModel.create();
        layer.setDataConfiguration(dataConfiguration);
        dataConfiguration.setDataset(dataset, metadata);
        dataConfiguration.setAttributeForRole("x", { attributeID: xAttr.id, type: "numeric" }, false);
        dataConfiguration.setAttributeForRole("y", { attributeID: yAttr.id, type: "numeric" }, false);
      }
    },
    setXAttributeLabel(label: string) {
      self.xAttributeLabel = label;
    },
    setYAttributeLabel(label: string) {
      self.yAttributeLabel = label;
    },
    setEditingMode(mode: GraphEditMode, layer?: IGraphLayerModel) {
      self.editingMode = mode;
      if (mode === "none") {
        self.editingLayerId = undefined;
      } else {
        if (layer) {
          self.editingLayerId = layer && layer.id;
        } else {
          const editables = self.getEditableLayers();
          self.editingLayerId = editables.length>0 ? editables[0].id : undefined;
        }
      }
    },
    setInteractionInProgress(value: boolean) {
      self.interactionInProgress = value;
    },
    setAnnotationLocation(id: string, location: Point|undefined, size: RectSize|undefined) {
      if (location) {
        self.annotationLocationCache.set(id, location);
      } else {
        self.annotationLocationCache.delete(id);
      }

      if (size) {
        self.annotationSizesCache.set(id, size);
      } else {
        self.annotationSizesCache.delete(id);
      }
    }
  }))
  .actions(self => ({
    removeColorForId(id: string) {
      self._idColors.delete(id);
    },
    setColorForId(id: string, colorIndex?: number) {
      self._idColors.set(id, colorIndex ?? self.nextColor);
    },
    setAxis(place: AxisPlace, axis: IAxisModelUnion) {
      self.axes.set(place, axis);
    },
    removeAxis(place: AxisPlace) {
      self.axes.delete(place);
    },
    setLockAxes(value: boolean) {
      self.lockAxes = value;
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
    /**
     * Clears selections of all types - cases, cells, and attributes.
     */
    clearAllSelectedCases() {
      for (const layer of self.layers) {
        layer.config.dataset?.setSelectedCases([]);
      }
    },
    clearSelectedCellValues() {
      for (const layer of self.layers) {
        const dataset = layer.config.dataset;
        if (dataset) {
          const newValues: ICase[] = [];
          for (const cell of dataset.selectedCells) {
            if (cell && cell.attributeId) {
              const newCaseValue: ICase = { __id__: cell.caseId };
              newCaseValue[cell.attributeId] = ""; // clear cell
              newValues.push(newCaseValue);
            }
            dataset.setCanonicalCaseValues(newValues);
            dataset.setSelectedCells([]);
          }
        }
      }
    },
    clearSelectedAdornmentInstances() {
      for (const adorn of self.adornments) {
        adorn.deleteSelected();
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
    addAdornment(adornment: IAdornmentModel) {
      const adornmentExists = self.getAdornmentOfType(adornment.type);
      if (adornmentExists) {
        console.error("Currently only one adornment of a type is supported");
      } else {
        self.adornments.push(adornment);
      }
    },
    showAdornment(type: string) {
      const adornment = self.getAdornmentOfType(type);
      if (adornment) {
        adornment.setVisibility(true);
      } else {
        console.error("Adornment type not found:", type);
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
    setColorForIdWithoutUndo(id: string, colorIndex: number) {
      withoutUndo({unlessChildAction: true});
      self.setColorForId(id, colorIndex);
    }
  }))
  .views(self => ({
    getColorForId(id: string) {
      const colorIndex = self._idColors.get(id);
      if (colorIndex === undefined) return "#000000";
      return clueDataColorInfo[colorIndex % clueDataColorInfo.length].color;
    },
    getColorNameForId(id: string) {
      const colorIndex = self._idColors.get(id);
      if (colorIndex === undefined) return "black";
      return clueDataColorInfo[colorIndex % clueDataColorInfo.length].name;
    },
    getEditablePointsColor() {
      let color = "#000000";
      let layer = self.editingLayer;
      if (!layer) {
        // Even if no layer is currently being edited, show the color of the one that would be.
        layer = self.getEditableLayers()?.[0];
      }
      if (layer) {
        const yAttributes = layer.config.yAttributeIDs;
        if (yAttributes.length > 0) {
          color = this.getColorForId(yAttributes[0]);
        }
      }
      return color;
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

      graphSharedModelUpdateFunctions.forEach(func => func(self as IGraphModel, smm));

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
      // Some shared model references may need to be updated. We can't update them until the SharedModelManager
      // is ready, though.
      addDisposer(self, reaction(
        () => {
          return self.tileEnv?.sharedModelManager?.isReady;
        },
        (ready) => {
          if (!ready) return;
          this.initializeSharedModelReferences();

        }, { fireImmediately: true }
      ));

      // Automatically asign colors to anything that might need them.
      addDisposer(self, reaction(
        () => {
          let ids: string[] = [];
          multiLegendParts.forEach(part => ids = ids.concat(part.getLegendIdList(self)));
          return ids;
        },
        (ids) => {
          ids.forEach(id => {
            if (!self._idColors.has(id)) {
              self.setColorForIdWithoutUndo(id, self.nextColor);
            }
          });
        }
      ));
    },
    initializeSharedModelReferences() {
      const smm = getSharedModelManager(self);
      if (smm && smm.isReady) {
        const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
        let sharedMetadata = smm.getTileSharedModelsByType(self, SharedCaseMetadata);

        // If there's a shared dataset without corresponding shared case metadata, create a new shared case
        // metadata instance, link it to the dataset, and add it to the tile. This is needed when graph tiles are
        // copied since the original graph tile's case metadata is not copied along with the shared dataset.
        sharedDataSets.forEach((sds) => {
          if (!isSharedDataSet(sds)) return;
          const hasLinkedCaseMetadata = sharedMetadata.some((smd) => {
            if (isSharedCaseMetadata(smd)) {
              return smd.data === sds.dataSet;
            }
          });
          if (!hasLinkedCaseMetadata) {
            const smd = SharedCaseMetadata.create();
            smd.setData(sds.dataSet);
            smm.addTileSharedModel(self, smd);
            const datasetLayer = self.layers.find((layer) => layer.config.dataset === sds.dataSet);
            if (datasetLayer) {
              datasetLayer.config.metadata = smd;
            }
          }
        });

        // Update pre-existing, legacy DataConfiguration objects that don't have the now-required references
        // for dataset and metadata. We can determine these from the unique shared models these
        // legacy tile models should have.
        const legacyGraph = self.layers.length === 1 && !self.layers[0].config.dataset &&
                                !self.layers[0].config.isEmpty;
        if (!legacyGraph) return;

        if (sharedDataSets.length === 1) {
          const sds = sharedDataSets[0];
          if (isSharedDataSet(sds)) {
            self.layers[0].config.dataset = sds.dataSet;
            console.log('Updated legacy document - set dataset reference');
          }
        }
        sharedMetadata = smm.getTileSharedModelsByType(self, SharedCaseMetadata);
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
  const defaultAxisLabels = appConfig?.getSetting("defaultAxisLabels", "graph");
  const axisLabels = defaultAxisLabels && defaultAxisLabels as Record<string, string>;
  const createdGraphModel = GraphModel.create({
    plotType: emptyPlotIsNumeric ? "scatterPlot" : "casePlot",
    axes: {
      bottom: bottomAxisModel,
      left: leftAxisModel
    },
    xAttributeLabel: axisLabels && axisLabels.bottom,
    yAttributeLabel: axisLabels && axisLabels.left,
    ...snap
  });

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

type GraphSharedModelUpdateFunction = (graphModel: IGraphModel, sharedModelManager: ISharedModelManager) => void;
const graphSharedModelUpdateFunctions: GraphSharedModelUpdateFunction[] = [];

export function registerGraphSharedModelUpdateFunction(func: GraphSharedModelUpdateFunction) {
  graphSharedModelUpdateFunctions.push(func);
}
