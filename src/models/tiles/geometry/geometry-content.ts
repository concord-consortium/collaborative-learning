import { castArray, difference, each, every, size as _size, union } from "lodash";
import { reaction } from "mobx";
import { addDisposer, applySnapshot, detach, Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import { BoundingBox } from "jsxgraph";
import stringify from "json-stringify-pretty-compact";
import { SharedDataSet, SharedDataSetType } from "../../shared/shared-data-set";
import { SelectionStoreModelType } from "../../stores/selection";
import { ITableLinkProperties, linkedPointId, splitLinkedPointId } from "../table-link-types";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../tile-model-hooks";
import { convertModelToChanges, getGeometryBoardChange } from "./geometry-migrate";
import { preprocessImportFormat } from "./geometry-import";
import {
  CircleModel, cloneGeometryObject, CommentModel, CommentModelType, GeometryBaseContentModel, GeometryObjectModelType,
  GeometryObjectModelUnion, ImageModel, ImageModelType, isCircleModel, isCommentModel, isMovableLineModel,
  isMovableLinePointId, isPointModel, isPolygonModel, isVertexAngleModel, MovableLineModel, PointModel,
  PolygonModel, PolygonModelType, segmentIdFromPointIds, VertexAngleModel
} from "./geometry-model";
import {
  getBoardUnitsAndBuffers, getObjectById, guessUserDesiredBoundingBox, kXAxisTotalBuffer, kYAxisTotalBuffer,
  resumeBoardUpdates, suspendBoardUpdates
} from "./jxg-board";
import {
  ELabelOption, ILinkProperties, JXGChange, JXGCoordPair, JXGPositionProperty, JXGProperties, JXGUnsafeCoordPair
} from "./jxg-changes";
import { applyChange, applyChanges, IDispatcherChangeContext } from "./jxg-dispatcher";
import { getAssociatedPolygon, getEdgeVisualProps, getPolygonVisualProps, prepareToDeleteObjects,
  setPolygonEdgeColors
} from "./jxg-polygon";
import {
  isAxisArray, isBoard, isComment, isImage, isMovableLine, isPoint, isPointArray, isPolygon,
  isVertexAngle, isVisibleEdge, kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin,
  kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth, toObj, isGeometryElement, isCircle
} from "./jxg-types";
import { SharedModelType } from "../../shared/shared-model";
import { ISharedModelManager } from "../../shared/shared-model-manager";
import { IDataSet } from "../../data/data-set";
import { uniqueId } from "../../../utilities/js-utils";
import { gImageMap } from "../../image-map";
import { IClueTileObject } from "../../annotations/clue-object";
import { appendVertexId, getPoint, filterBoardObjects, forEachBoardObject, getBoardObject, getBoardObjectIds,
  getPolygon, logGeometryEvent, removeClosingVertexId, getCircle, getBoardObjectsExtents } from "./geometry-utils";
import { getPointVisualProps } from "./jxg-point";
import { getVertexAngle } from "./jxg-vertex-angle";
import { GeometryTileMode } from "../../../components/tiles/geometry/geometry-types";
import { getCircleVisualProps } from "./jxg-circle";

export type onCreateCallback = (elt: JXG.GeometryElement) => void;

export interface IAxesParams {
  xName?: string;
  xAnnotation?: string;
  xMin: number;
  xMax: number;
  yName?: string;
  yAnnotation?: string;
  yMin: number;
  yMax: number;
}

export function defaultGeometryContent(options?: IDefaultContentOptions): GeometryContentModelType {
  const xRange = kGeometryDefaultWidth / kGeometryDefaultPixelsPerUnit;
  const yRange = kGeometryDefaultHeight / kGeometryDefaultPixelsPerUnit;
  return GeometryContentModel.create({
    board: {
      xAxis: { name: "x", label: "x", min: kGeometryDefaultXAxisMin, range: xRange },
      yAxis: { name: "y", label: "y", min: kGeometryDefaultYAxisMin, range: yRange }
    }
   });
}

export interface IAxisLabels {
  x: string | undefined;
  y: string | undefined;
}

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const GeometryMetadataModel = TileMetadataModel
  .named("GeometryMetadata")
  .props({
    disabled: types.array(types.string),
    selection: types.map(types.boolean)
  })
  .volatile(self => ({
    sharedSelection: undefined as any as SelectionStoreModelType
  }))
  .views(self => ({
    isSharedSelected(id: string) {
      const _id = id?.includes(":") ? id.split(":")[0] : id;
      let isSelected = false;
      self.sharedSelection?.sets.forEach(set => {
        // ignore labels with auto-assigned IDs associated with selected points
        if (set.isSelected(_id) && !id.endsWith("Label")) isSelected = true;
      });
      return isSelected;
    },
  }))
  .views(self => ({
    isDisabled(feature: string) {
      return self.disabled.indexOf(feature) >= 0;
    },
    isSelected(id: string) {
      return !!self.selection.get(id) || self.isSharedSelected(id);
    },
    hasSelection() {
      return Array.from(self.selection.values()).some(isSelected => isSelected);
    }
  }))
  .actions(self => ({
    setSharedSelection(sharedSelection: SelectionStoreModelType) {
      self.sharedSelection = sharedSelection;
    },
    setDisabledFeatures(disabled: string[]) {
      self.disabled.replace(disabled);
    },
    select(id: string) {
      self.selection.set(id, true);
    },
    deselect(id: string) {
      self.selection.set(id, false);
    },
    setSelection(id: string, select: boolean) {
      self.selection.set(id, select);
    }
  }));
export type GeometryMetadataModelType = Instance<typeof GeometryMetadataModel>;

export function updateVisualProps(board: JXG.Board, id: string, selected: boolean) {
  const element = getObjectById(board, id);
  if (element) {
    let colorScheme = element.getAttribute("colorScheme")||0;
    if (isPoint(element)) {
      const props = getPointVisualProps(selected, colorScheme, element.getAttribute("isPhantom"),
        element.getAttribute("clientLabelOption"));
      element.setAttribute(props);
    } else if (isVisibleEdge(element)) {
      const associatedPolygon = getAssociatedPolygon(element);
      colorScheme = associatedPolygon?.getAttribute("colorScheme")||0;

      const edgeProps = getEdgeVisualProps(selected, colorScheme, false);
      element.setAttribute(edgeProps);

      const polyProps = getPolygonVisualProps(selected, colorScheme);
      associatedPolygon?.setAttribute(polyProps);
    } else if (isPolygon(element)) {
      const polyProps = getPolygonVisualProps(selected, colorScheme);
      element.setAttribute(polyProps);
      setPolygonEdgeColors(element);
    } else if (isCircle(element)) {
      const circleProps = getCircleVisualProps(selected, colorScheme);
      element.setAttribute(circleProps);
    }
  }
}

export const isGeometryContentReady = async (model: GeometryContentModelType): Promise<boolean> => {
  return !model.bgImage || !!await gImageMap.getImage(model.bgImage.url);
};

export const GeometryContentModel = GeometryBaseContentModel
  .named("GeometryContent")
  .volatile(self => ({
    metadata: undefined as any as GeometryMetadataModelType,
    // Used to force linkedDataSets() to update. Hope to remove in the future.
    updateSharedModels: 0,
    showColorPalette: false,
    selectedColor: 0,
  }))
  .actions(self => ({
    forceSharedModelUpdate() {
      self.updateSharedModels += 1;
    }
  }))
  .preProcessSnapshot(snapshot => {
    const imported = preprocessImportFormat(snapshot);
    return imported;
  })
  .views(self => ({
    get linkedDataSets(): SharedDataSetType[] {
      // MobX isn't properly monitoring getTileSharedModels, so we're manually forcing an update to this view here
      // eslint-disable-next-line no-unused-expressions
      self.updateSharedModels;
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const foundSharedModels = sharedModelManager?.isReady
        ? sharedModelManager.getTileSharedModels(self) as SharedDataSetType[]
        : [];
      return foundSharedModels;
    }
  }))
  .views(self => ({
    getObject(id: string) {
      return self.objects.get(id);
    },
    // Returns a point defining a movableLine with the given id,
    // or undefined if there isn't one.
    getMovableLinePoint(id: string) {
      let point;
      self.objects.forEach(obj => {
        if (isMovableLineModel(obj)) {
          if (obj.p1.id === id) {
            point = obj.p1;
          } else if (obj.p2.id === id) {
            point = obj.p2;
          }
        }
      });
      return point;
    },
    /**
     * Compile a map of data for all points that are part of linked datasets.
     * The returned Map has the sharedDataSet's ID as the key, and an object
     * containing two parallel lists as its value:
     *
     * - coords: list of coordinate pairs
     * - properties: list of point property objects (id, color, linkedTableId)
     *
     * TODO: should we also look at the selections in the DataSet
     *
     * @returns the Map
     */
    getLinkedPointsData() {
      const data: Map<string,
        { coords:JXGCoordPair[], properties: { id:string, colorScheme:number, linkedTableId?:string }[] }> = new Map();
      self.linkedDataSets.forEach(link => {
        const coords: JXGCoordPair[] = [];
        const properties: Array<{ id: string, colorScheme: number, linkedTableId?: string }> = [];
        for (let ci = 0; ci < link.dataSet.cases.length; ++ci) {
          const x = link.dataSet.attributes[0]?.numValue(ci);
          for (let ai = 1; ai < link.dataSet.attributes.length; ++ai) {
            const attr = link.dataSet.attributes[ai];
            const colorScheme = self.getColorSchemeForAttributeId(attr.id) || 0;
            const id = linkedPointId(link.dataSet.cases[ci].__id__, attr.id);
            const y = attr.numValue(ci);
            if (isFinite(x) && isFinite(y)) {
              coords.push([x, y]);
              if (link.providerId) {
                properties.push({ id, colorScheme, linkedTableId: link.providerId });
              } else {
                properties.push({ id, colorScheme });
              }
            }
          }
        }
        data.set(link.id, { coords, properties });
      });
      return data;
    }
  }))
  .views(self => ({
    getCircle(id: string) {
      const obj = self.getObject(id);
      return isCircleModel(obj) ? obj : undefined;
    },
    // Returns any object in the model, even a subobject (like a movable line's point)
    getAnyObject(id: string) {
      if (isMovableLinePointId(id)) {
        // Special case for movableLine points, which aren't in self.objects
        return self.getMovableLinePoint(id);
      } else {
        return self.getObject(id);
      }
    },
    getObjectColorScheme(id: string) {
      const obj = self.getObject(id);
      if (isPointModel(obj) || isPolygonModel(obj) || isMovableLineModel(obj) || isCircleModel(obj)) {
        return obj.colorScheme;
      }
      if (obj === undefined) {
        const [linkedRowId, linkedColId] = splitLinkedPointId(id);
        if (linkedRowId && linkedColId) {
          return self.getColorSchemeForAttributeId(linkedColId);
        }
      }
    },
    getDependents(ids: string[], options?: { required: boolean }) {
      const { required = false } = options || {};
      let dependents = [...ids];
      self.objects.forEach(obj => {
        const result = obj.dependsUpon(dependents);
        if (result.depends && (result.required || !required)) {
          dependents = union(dependents, [obj.id]);
        }
      });
      return dependents;
    },
    get lastObject() {
      return self.objects.size ? Array.from(self.objects.values())[self.objects.size - 1] : undefined;
    },
    lastObjectOfType(type: string) {
      const ofType = Array.from(self.objects.values()).filter((obj => obj.type === type));
      return ofType.length ? ofType[ofType.length -1] : undefined;
    },
    isSelected(id: string) {
      return !!self.metadata?.isSelected(id);
    },
    hasSelection() {
      return !!self.metadata?.hasSelection();
    },
    get isLinked() {
      return self.linkedDataSets.length > 0;
    },
    get linkedTableIds() {
      return self.linkedDataSets.map(link => link.providerId);
    },
    isLinkedToTile(tileId: string) {
      return self.linkedDataSets.some(link => link.providerId === tileId);
    },
    isDeletable(board: JXG.Board, id: string) {
      const obj = getObjectById(board, id);
      if (!obj || obj.getAttribute("clientUndeletable")) return false;
      if (isVertexAngle(obj)) return true;
      return !obj.getAttribute("fixed");
    }
  }))
  .views(self => ({
    getLinkedDataset(linkedTableId: string) {
      return self.linkedDataSets.find(ds => ds.providerId === linkedTableId);
    },
    getSelectedIds(board: JXG.Board) {
      return Array.from(self.metadata.selection.entries())
        .filter(([id, selected]) => selected)
        .map(([id, selected]) => id);
    },
    getDeletableSelectedIds(board: JXG.Board) {
      return this.getSelectedIds(board).filter(id => self.isDeletable(board, id));
    }
  }))
  .views(self => ({
    hasDeletableSelection(board: JXG.Board) {
      return self.getDeletableSelectedIds(board).length > 0;
    },
    selectedObjects(board: JXG.Board) {
      return filterBoardObjects(board, obj => self.isSelected(obj.id));
    },
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      if (options?.forHash) {
        // For hash generation, we only care about the objects and background image
        const {objects, bgImage} = snapshot;
        return stringify({objects, bgImage}, {maxLength: 200});
      }
      return stringify(snapshot, {maxLength: 200});
    }
  }))
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      const polygons: IClueTileObject[] = [];
      const segments: IClueTileObject[] = [];
      const points: IClueTileObject[] = [];
      const linkedPoints: IClueTileObject[] = [];
      self.objects.forEach(object => {
        const objectInfo = { objectId: object.id, objectType: object.type };
        if (object.type === "polygon") {
          polygons.push(objectInfo);
          const polygon = object as PolygonModelType;
          polygon.segmentIds.forEach(
            segmentId => segments.push({ objectId: segmentId, objectType: "segment" })
          );
        } else if (object.type === "point") {
          points.push(objectInfo);
        }
      });
      for (const lpd of self.getLinkedPointsData().values()) {
        lpd.properties.forEach((prop) => {
          linkedPoints.push({
            objectType: "linkedPoint",
            objectId: prop.id
          });
        });
      }
      // The order of the objects is important so buttons to add sparrows don't cover each other
      return [...polygons, ...segments, ...points, ...linkedPoints];
    },
  }))
  .actions(self => ({
    setElementSelection(board: JXG.Board | undefined, id: string, select: boolean) {
      if (self.isSelected(id) !== select) {
        const elt = getBoardObject(board, id);
        const tableId = elt && elt.getAttribute("linkedTableId");
        const rowId = elt && elt.getAttribute("linkedRowId");
        self.metadata.setSelection(id, select);
        if (tableId && rowId) {
          self.metadata.sharedSelection.select(tableId, rowId, select);
        }
      }
    },
    addLinkedTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && !self.isLinkedToTile(tileId)) {
        const sharedDataSet = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tileId);
        sharedDataSet && sharedModelManager.addTileSharedModel(self, sharedDataSet);
        self.forceSharedModelUpdate();
      }
      else {
        console.warn("GeometryContent.addLinkedTable unable to link table");
      }
    },
    removeLinkedTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && self.isLinkedToTile(tileId)) {
        const sharedDataSet = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tileId);
        sharedDataSet && sharedModelManager.removeTileSharedModel(self, sharedDataSet);
        self.forceSharedModelUpdate();
      }
      else {
        console.warn("GeometryContent.addLinkedTable unable to unlink table");
      }
    }
  }))
  .actions(self => ({
    selectElement(board: JXG.Board | undefined, id: string) {
      if (!self.isSelected(id)) {
        self.setElementSelection(board, id, true);
      }
    },
    deselectElement(board: JXG.Board | undefined, id: string) {
      if (self.isSelected(id)) {
        self.setElementSelection(board, id, false);
      }
    }
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata) {
      self.metadata = metadata as GeometryMetadataModelType;
    }
  }))
  .actions(self => ({
    setBackgroundImage(image: ImageModelType) {
      self.bgImage = image;
    },
    addObjectModel(object: GeometryObjectModelUnion) {
      self.objects.set(object.id, object);
      return object.id;
    },
    addObjectModels(objects: GeometryObjectModelType[]) {
      objects.forEach(obj => self.objects.set(obj.id, obj));
    },
    deleteObjects(ids: string[]) {
      // delete the specified objects and their dependents
      const dependents = self.getDependents(ids);
      const requiredDependents = self.getDependents(ids, { required: true });
      // remove non-required dependencies, e.g. individual points from polygons
      difference(dependents, requiredDependents).forEach(dep => {
        self.getObject(dep)?.removeDependencies(dependents);
      });
      // delete required dependents
      requiredDependents.forEach(id => self.objects.delete(id));
    },
    selectObjects(board: JXG.Board, ids: string | string[]) {
      const _ids = Array.isArray(ids) ? ids : [ids];
      _ids.forEach(id => {
        self.selectElement(board, id);
      });
    },
    deselectObjects(board: JXG.Board, ids: string | string[]) {
      const _ids = Array.isArray(ids) ? ids : [ids];
      _ids.forEach(id => {
        self.deselectElement(board, id);
      });
    },
    deselectAll(board: JXG.Board) {
      self.metadata.selection.forEach((value, id) => {
        self.deselectElement(board, String(id));
      });
    },
    setShowColorPalette(showOrHide: boolean) {
      self.showColorPalette = showOrHide;
    }
  }))
  .extend(self => {

    let suspendCount = 0;
    let batchChanges: string[] = [];

    function handleWillApplyChange(board: JXG.Board | string, change: JXGChange) {
      return undefined;
    }

    function handleDidApplyChange(board: JXG.Board | undefined, change: JXGChange) {
      // nop
    }

    function getDispatcherContext(): IDispatcherChangeContext {
      const isFeatureDisabled = (feature: string) =>
                                  self.metadata && self.metadata.disabled.indexOf(feature) >= 0;
      return {
        isFeatureDisabled,
        onWillApplyChange: handleWillApplyChange,
        onDidApplyChange: handleDidApplyChange
      };
    }

    function initializeBoard(domElementID: string, showAllContent: boolean|undefined,
        onCreate: onCreateCallback, syncLinked: (board:JXG.Board) => void): JXG.Board | undefined {
      let board: JXG.Board | undefined;
      const context = getDispatcherContext();

      const initialBoardParamters = getGeometryBoardChange(self,
        { addBuffers: true, includeUnits: true, showAllContent });
      const initialProperties: JXGProperties = initialBoardParamters.properties || {};

      // Create the board and axes
      applyChanges(domElementID, [initialBoardParamters],
      context)
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (isBoard(changeElem)) {
              board = changeElem;
              suspendBoardUpdates(board);
            } else {
              onCreate(changeElem);
            }
          });
        });
      if (!board) return;

      // Add linked points
      syncLinked(board);

      // Now add all local objects
      const changes = convertModelToChanges(self);
      applyChanges(board, changes, context)
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (isGeometryElement(changeElem)) {
              onCreate(changeElem);
            }
          });
        });

      if (showAllContent) {
        // If we're showing all content, rescale to fit the extent of all objects.
        // This is done after all objects are added to the board so that we can ask JSXGraph for the extents.
        const extents = getBoardObjectsExtents(board);
        // The extents should only be used to show more, not less of the xy plane
        const initialBB: BoundingBox = initialProperties.boundingBox;
        const [xMin, yMax, xMax, yMin] = initialBB;

        const params: IAxesParams = {
          xMin: Math.min(xMin, extents.xMin),
          xMax: Math.max(xMax, extents.xMax),
          yMin: Math.min(yMin, extents.yMin),
          yMax: Math.max(yMax, extents.yMax)
        };
        rescaleBoard(board, params, false);
      }

      resumeBoardUpdates(board);
      return board;
    }

    function destroyBoard(board: JXG.Board) {
      board && JXG.JSXGraph.freeBoard(board);
    }

    function resizeBoard(board: JXG.Board, width: number, height: number, scale?: number) {
      // JSX Graph canvasWidth and canvasHeight are truncated to integers,
      // so we need to do the same to get the new canvasWidth and canvasHeight values
      const scaledWidth = Math.trunc(width) / (scale || 1);
      const scaledHeight = Math.trunc(height) / (scale || 1);
      const widthMultiplier = (scaledWidth - kXAxisTotalBuffer) / (board.canvasWidth - kXAxisTotalBuffer);
      const heightMultiplier = (scaledHeight - kYAxisTotalBuffer) / (board.canvasHeight - kYAxisTotalBuffer);
      // Remove the buffers to correct the graph proportions
      const [xMin, yMax, xMax, yMin] = guessUserDesiredBoundingBox(board);
      const { xMinBufferRange, xMaxBufferRange, yBufferRange } = getBoardUnitsAndBuffers(board);
      // Add the buffers back post-scaling
      const newBoundingBox: JXG.BoundingBox = [
        xMin * widthMultiplier - xMinBufferRange,
        yMax * heightMultiplier + yBufferRange,
        xMax * widthMultiplier + xMaxBufferRange,
        yMin * heightMultiplier - yBufferRange
      ];
      board.resizeContainer(scaledWidth, scaledHeight, false, true);
      board.setBoundingBox(newBoundingBox, false);
      board.update();
    }

    function zoomBoard(board: JXG.Board, factor: number) {
      if (!self.board) return;
      const {xAxis, yAxis} = self.board;
      xAxis.range = xAxis.range ? xAxis.range / factor : xAxis.range;
      yAxis.range = yAxis.range ? yAxis.range / factor : yAxis.range;
      // Update units, but keep them the same (avoid rounding error building up)
      const oldUnit = (xAxis.unit + yAxis.unit) / 2;
      const newUnit = oldUnit * factor;
      xAxis.unit = yAxis.unit = newUnit;
      self.zoom = newUnit/kGeometryDefaultPixelsPerUnit;
    }

    function rescaleBoard(board: JXG.Board, params: IAxesParams, writeToModel: boolean) {
      const { canvasWidth, canvasHeight } = board;
      const { xName, xAnnotation, xMin, xMax, yName, yAnnotation, yMin, yMax } = params;
      const width = canvasWidth - kXAxisTotalBuffer;
      const height = canvasHeight - kYAxisTotalBuffer;
      const unitX = width / (xMax - xMin);
      const unitY = height / (yMax - yMin);

      // Now force equal scaling. The smaller unit wins, since we want to keep all points in view.
      let calcUnit, calcXrange, calcYrange;
      if (unitX < unitY) {
        calcUnit = unitX;
        calcXrange = xMax - xMin;
        calcYrange = height / calcUnit;
      } else {
        calcUnit = unitY;
        calcXrange = width / calcUnit;
        calcYrange = yMax - yMin;
      }

      const xAxisProperties = {
        name: xName,
        label: xAnnotation,
        min: xMin,
        unit: calcUnit,
        range: calcXrange
      };
      const yAxisProperties = {
        name: yName,
        label: yAnnotation,
        min: yMin,
        unit: calcUnit,
        range: calcYrange
      };
      // Don't force a redisplay if nothing has changed.
      const curX = self.board?.xAxis;
      const curY = self.board?.yAxis;
      if (curX && curX.min === xAxisProperties.min
          && curX.unit === xAxisProperties.unit && curX.range === xAxisProperties.range
          && curY && curY.min === yAxisProperties.min
          && curY.unit === yAxisProperties.unit && curY.range === yAxisProperties.range) {
        return undefined;
      }
      if (self.board && writeToModel) {
        self.zoom = calcUnit/kGeometryDefaultPixelsPerUnit;
        applySnapshot(self.board.xAxis, xAxisProperties);
        applySnapshot(self.board.yAxis, yAxisProperties);
      }

      const change: JXGChange = {
        operation: "update",
        target: "board",
        targetID: board.id,
        properties: { boardScale: {
                        xMin, yMin, unitX: calcUnit, unitY: calcUnit,
                        ...toObj("xName", xName), ...toObj("yName", yName),
                        ...toObj("xAnnotation", xAnnotation), ...toObj("yAnnotation", yAnnotation),
                        canvasWidth: width, canvasHeight: height
                      } }
      };
      const axes = syncChange(board, change);
      return isAxisArray(axes) ? axes : undefined;
    }

    function updateScale(board: JXG.Board, scale: number) {
      if (board) {
        board.updateCSSTransforms();
      }
    }

    function addImage(board: JXG.Board,
                      url: string,
                      coords: JXGCoordPair,
                      size: JXGCoordPair,
                      properties?: JXGProperties): JXG.Image | undefined {
      // update the model
      const [x, y] = coords;
      const [width, height] = size;
      const { id = uniqueId(), ...props } = properties || {};
      const imageModel = ImageModel.create({ id, url, x, y, width, height, ...props });
      self.setBackgroundImage(imageModel);

      // update JSXGraph
      const imageIds = findObjects(board, (obj: JXG.GeometryElement) => obj.elType === "image")
                        .map((obj: JXG.GeometryElement) => obj.id);
      if (imageIds.length) {
        // change URL if there's already an image present
        const imageId = imageIds[imageIds.length - 1];
        updateObjects(board, imageId, { url, size: [width, height], ...props });
      }
      else {
        const change: JXGChange = {
          operation: "create",
          target: "image",
          parents: [url, coords, size],
          properties: { id, ...props }
        };
        const image = applyAndLogChange(board, change);
        return isImage(image) ? image : undefined;
      }
    }

    function addPoint(board: JXG.Board | undefined,
                      parents: JXGCoordPair,
                      properties?: JXGProperties): JXG.Point | undefined {
      const { id = uniqueId(), ...props } = properties || {};
      const pointModel = PointModel.create({ id, x: parents[0], y: parents[1], ...props });
      self.addObjectModel(pointModel);

      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: { id, ...props }
      };
      const point = applyAndLogChange(board, change);
      return isPoint(point) ? point : undefined;
    }

    /**
     * Creates a "phantom" point, which is shown on the board but not (yet) persisted in the model.
     * If there is an activePolygon the phantom point will be added at the end of its list of vertices.
     * Or, if there is an activeCircle, the phantom point will be set as its tangent point.
     * @param board
     * @param coordinates
     * @param restore if the phantom point is being restored after mouse left the window
     * @returns the new Point object
     */
    function addPhantomPoint(board: JXG.Board, coordinates: JXGCoordPair, restoring?: boolean):
        JXG.Point | undefined {
      if (!board) return undefined;
      const id = uniqueId();
      const props = {
        id,
        colorScheme: self.selectedColor,
        isPhantom: true,
        clientLabelOption: ELabelOption.kNone,
        snapToGrid: true
      };
      const pointModel = PointModel.create({ x: coordinates[0], y: coordinates[1], ...props });
      self.phantomPoint = pointModel;

      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: coordinates,
        properties: { ...props }
      };
      const result = syncChange(board, change);
      const point = isPoint(result) ? result : undefined;

      if (point && restoring) {
        if (self.activePolygonId) {
          appendPhantomPointToPolygon(board, self.activePolygonId);
        }
        if (self.activeCircleId) {
          // Set the phantom as active circle's tangent point
          const activeCircle = self.getCircle(self.activeCircleId);
          if (activeCircle) {
            syncChange(board, {
              operation: "create",
              target: "circle",
              parents: [activeCircle.centerPoint, self.phantomPoint.id],
              properties: { id: self.activeCircleId, colorScheme: self.phantomPoint.colorScheme }
            });
          }
        }
      }
      return point;
    }

    function appendPhantomPointToPolygon(board: JXG.Board, polygonId: string) {
      const poly = getPolygon(board, polygonId);
      const id = self.phantomPoint?.id;
      if (!poly || !id) return;
      // Need at least 2 real vertices (JSXGraph includes a closing vertex that duplicates the first,
      // so vertices.length >= 3 means at least 2 real vertices)
      if (poly.vertices.length < 3) return;
      const vertexIds = poly.vertices.map(v => v.id);
      // The point before the one we're adding
      const lastPoint = poly.vertices[poly.vertices.length-2];
      // The point after the one we're adding
      const nextPoint = poly.vertices[0];

      const newPolygon = syncChange(board, {
        operation: "update",
        target: "polygon",
        targetID: polygonId,
        parents: appendVertexId(vertexIds, id)
      });
      if (!isPolygon(newPolygon)) return;

      // If there is a vertex angle before or after the added point, it needs to be updated
      fixVertexAngle(board, newPolygon, lastPoint);
      fixVertexAngle(board, newPolygon, nextPoint);
      return newPolygon;
    }

    function fixVertexAngle(board: JXG.Board, polygon: JXG.Polygon, point: JXG.Point | undefined) {
      if (!point) return;
      const vertexAngle = getVertexAngle(point);
      if (!vertexAngle) return;
      const model = self.getObject(vertexAngle.id);
      if (!isVertexAngleModel(model)) return;
      const pointIndex = polygon.vertices.indexOf(point);
      const newPoints = [
        polygon.vertices[pointIndex>0 ? pointIndex-1 : polygon.vertices.length-2].id,
        polygon.vertices[pointIndex].id,
        polygon.vertices[pointIndex+1].id
      ];
      model.replacePoints(newPoints);
      rebuildVertexAngle(board, vertexAngle.id, newPoints);
    }

    function deleteVertexAngle(board: JXG.Board, point: JXG.Point) {
      const va = getVertexAngle(point);
      if (va) {
        self.deleteObjects([va.id]);
        syncChange(board, {
          operation: "delete",
          target: "vertexAngle",
          targetID: va.id
        });
      }
    }

    function setPhantomPointPosition(board: JXG.Board, position: JXGCoordPair) {
      if (self.phantomPoint) {
        self.phantomPoint.setPosition(position);
        const change: JXGChange = {
          operation: "update",
          target: "object",
          targetID: self.phantomPoint.id,
          properties: {
            position
          }
        };
        syncChange(board, change);
      }
    }

    /**
     * "Opens up" the polygon for editing.
     * Sets the active polygon ID.
     * The vertices of this polygon are "rotated" if necessary so that the point
     * clicked becomes the last point in the list of vertices, and then the
     * phantom point is inserted after it.
     * @param board
     * @param polygonId
     * @param pointId
     * @returns the updated polygon
     */
    function makePolygonActive(board: JXG.Board, polygonId: string, pointId: string) {
      const poly = getPolygon(board, polygonId);
      const polygonModel = self.getObject(polygonId);
      const point = getPoint(board, pointId);
      if (!poly || !point || !polygonModel || !isPolygonModel(polygonModel) || !self.phantomPoint) return;
      const pointIndex = poly.vertices.indexOf(point);
      if (pointIndex < 0) return;

      const vertices = removeClosingVertexId(poly.vertices.map(vert => vert.id));
      // Rewrite the list of vertices so that the point clicked on is last.
      const reorderedVertices = vertices.slice(pointIndex+1).concat(vertices.slice(0, pointIndex+1));
      polygonModel.points.replace(reorderedVertices);

      const change: JXGChange = {
        operation: "update",
        target: "polygon",
        targetID: polygonId,
        parents: reorderedVertices
      };
      syncChange(board, change);
      self.activePolygonId = polygonId;

      // Then add phantom point at the end
      appendPhantomPointToPolygon(board, polygonId);

      return getPolygon(board, polygonId);
    }

    // Delete old angle from board and build new one with the new parent points
    function rebuildVertexAngle(board: JXG.Board, id: string, points: string[]) {
      syncChange(board,
        {
          operation: "delete",
          target: "vertexAngle",
          targetID: id
        });
      syncChange(board,
        {
          operation: "create",
          target: "vertexAngle",
          parents: points,
          properties: { id }
        });
    }

    /**
     * Adds the given existing point to the active polygon.
     * It is appended to the end of the list of vertexes in the model.
     * On the board the phantom point will be moved to after this new vertex,
     * and the polygon will remain unclosed.
     * @param board
     * @param pointId
     * @returns the polygon
     */
    function addPointToActivePolygon(board: JXG.Board, pointId: string) {
      // Sanity check everything
      if (!self.activePolygonId || !self.phantomPoint) return;
      const poly = getPolygon(board, self.activePolygonId);
      if (!poly) return;
      const vertexIds = poly.vertices.map(v => v.id);
      const phantomPointIndex = vertexIds.indexOf(self.phantomPoint.id);
      if (phantomPointIndex<0) return;
      const polygonModel = self.objects.get(self.activePolygonId);
      if (!isPolygonModel(polygonModel)) return;

      // Insert the new point before the phantom point
      vertexIds.splice(phantomPointIndex, 0, pointId);
      const change: JXGChange = {
        operation: "update",
        target: "polygon",
        targetID: poly.id,
        parents: vertexIds
      };
      const updatedPolygon = syncChange(board, change);
      if (!isPolygon(updatedPolygon)) return;
      polygonModel.points.push(pointId);

      fixVertexAngle(board, updatedPolygon, updatedPolygon.vertices[phantomPointIndex-1]);
      fixVertexAngle(board, updatedPolygon, updatedPolygon.vertices[phantomPointIndex]);

      logGeometryEvent(self, "update", "vertex", [pointId, poly.id],
        { userAction: "join to polygon" });

      return isPolygon(updatedPolygon) ? updatedPolygon : undefined;
    }

    /**
     * Make the current phantom point into a real point.
     * The new point is persisted into the model.
     * Depending on the mode, the active polygon or circle will be updated.
     * @param board
     * @param position
     * @param mode
     * @returns the point, now considered "real".
     */
    function realizePhantomPoint(board: JXG.Board, position: JXGCoordPair, mode: GeometryTileMode):
        { point: JXG.Point | undefined, polygon: JXG.Polygon | undefined, circle: JXG.Circle | undefined } {
      // Transition the current phantom point into a real point.
      if (!self.phantomPoint) return { point: undefined, polygon: undefined, circle: undefined };
      self.phantomPoint.setPosition(position);
      const newRealPoint = self.phantomPoint;
      detach(newRealPoint);
      self.addObjectModel(newRealPoint);

      // Create a new phantom point
      const phantomPoint = addPhantomPoint(board, position);
      if (!phantomPoint) {
        console.warn("Failed to create phantom point");
        return { point: undefined, polygon: undefined, circle: undefined };
      }

      // Update the previously-existing JSXGraph point to be real, not phantom
      const change: JXGChange = {
        operation: "update",
        target: "object",
        targetID: newRealPoint.id,
        properties: {
          ...getPointVisualProps(false, newRealPoint.colorScheme, false, ELabelOption.kNone),
          isPhantom: false,
          position
        }
      };
      syncChange(board, change);

      let newPolygon: JXG.Polygon|undefined = undefined;
      if (mode === "polygon") {
        const poly = self.activePolygonId && getPolygon(board, self.activePolygonId);
        if (poly) {
          newPolygon = appendPhantomPointToPolygon(board, poly.id);
          const polyModel = self.activePolygonId && self.getObject(self.activePolygonId);
          if (polyModel && isPolygonModel(polyModel)) {
            polyModel.points.push(newRealPoint.id);
          }
        } else {
          // Create a new polygon with the two points (real and phantom)
          const change2: JXGChange = {
            operation: "create",
            target: "polygon",
            parents: [newRealPoint.id, phantomPoint?.id],
            properties: { id: self.activePolygonId, colorScheme: newRealPoint.colorScheme }
          };
          const result = syncChange(board, change2);
          if (isPolygon(result)) {
            newPolygon = result;

            // Update the model
            const polygonModel = PolygonModel.create(
              { id: newPolygon.id, points: [newRealPoint.id], colorScheme: newRealPoint.colorScheme });
            self.addObjectModel(polygonModel);
            self.activePolygonId = polygonModel.id;
          }
        }
      }

      let newCircle: JXG.Circle|undefined = undefined;
      if (mode === "circle") {
        const circleModel = self.activeCircleId && self.getCircle(self.activeCircleId);
        if (circleModel) {
          // This point completes the circle and frees it from being active
          circleModel.tangentPoint = newRealPoint.id;
          self.activeCircleId = undefined;
          newCircle = getCircle(board, circleModel.id);
        } else {
          // This is the center point, create a circle with the new phantom as the tangent point
          const newCircleModel = CircleModel.create(
            { id: uniqueId(), centerPoint: newRealPoint.id, colorScheme: newRealPoint.colorScheme }
          );
          self.addObjectModel(newCircleModel);
          self.activeCircleId = newCircleModel.id;
          const result = syncChange(board, {
            operation: "create",
            target: "circle",
            parents: [newRealPoint.id, phantomPoint.id],
            properties: { id: newCircleModel.id, colorScheme: newRealPoint.colorScheme }
          });
          if (isCircle(result)) {
            newCircle = result;
          }
        }
      }

      // Log event
      if (mode === "polygon") {
        logGeometryEvent(self, "create", "vertex",
          self.activePolygonId ? [newRealPoint.id, self.activePolygonId] : newRealPoint.id);
      } else if (mode === "circle") {
        logGeometryEvent(self, "create", "circle",
          newCircle ? [newRealPoint.id, newCircle.id] : newRealPoint.id,
          { userAction: self.activeCircleId ? "place center point" : "place tangent point" });
      } else {
        logGeometryEvent(self, "create", "point", newRealPoint.id);
      }
      // Return newly-created objects
      const obj = board.objects[newRealPoint.id];
      const point = isPoint(obj) ? obj : undefined;
      return { point, polygon: newPolygon, circle: newCircle };
    }

    /**
     * Removes the phantom point from the board
     * The active polygon or active circle are updated if needed.
     * @param board
     */
    function clearPhantomPoint(board: JXG.Board) {
      if (!self.phantomPoint) return;
      const phantomId = self.phantomPoint.id;

      // remove from polygon, if it's in one.
      const activePolygon = self.activePolygonId && getPolygon(board, self.activePolygonId);
      if (activePolygon) {
        const phantomIndex = activePolygon.vertices.findIndex(v => v.id === phantomId);
        const remainingVertices = activePolygon.vertices.map(v => v.id).filter(id => id !== phantomId);
        const change1: JXGChange = {
          operation: "update",
          target: "polygon",
          targetID: self.activePolygonId,
          parents: remainingVertices
        };
        const updatedPolygon = syncChange(board, change1);
        if (isPolygon(updatedPolygon) && phantomIndex) {
          // Check for VertexAngles on the vertices before and after the deleted one.
          fixVertexAngle(board, updatedPolygon, updatedPolygon.vertices[phantomIndex - 1]);
          fixVertexAngle(board, updatedPolygon, updatedPolygon.vertices[phantomIndex]);
        }
      }

      // Remove circle if one is displayed
      const activeCircle = self.activeCircleId && getCircle(board, self.activeCircleId);
      if (activeCircle) {
        syncChange(board, {
          operation: "delete",
          target: "circle",
          targetID: self.activeCircleId
        });
      }

      const change: JXGChange = {
        operation: "delete",
        target: "point",
        targetID: self.phantomPoint.id
      };
      syncChange(board, change);
      self.phantomPoint = undefined;
    }

    function createPolygonIncludingPoint(board: JXG.Board, pointId: string) {
      if (!self.phantomPoint) return;
      const colorScheme = self.getObjectColorScheme(pointId) || self.selectedColor;
      const polygonModel = PolygonModel.create({ points: [pointId], colorScheme });
      self.addObjectModel(polygonModel);
      self.activePolygonId = polygonModel.id;
      const change: JXGChange = {
        operation: "create",
        target: "polygon",
        parents: [pointId, self.phantomPoint.id],
        properties: { id: polygonModel.id, colorScheme }
      };
      const result = syncChange(board, change);

      logGeometryEvent(self, "update", "vertex", [pointId, polygonModel.id],
        { userAction: "join to polygon" });

      if (isPolygon(result)) {
        return result;
      }
    }

    function createCircleIncludingPoint(board: JXG.Board, pointId: string) {
      if (!self.phantomPoint) return;
      const colorScheme = self.getObjectColorScheme(pointId) || 0;
      const circleModel = CircleModel.create({ centerPoint: pointId, colorScheme });
      self.addObjectModel(circleModel);
      self.activeCircleId = circleModel.id;
      const change: JXGChange = {
        operation: "create",
        target: "circle",
        parents: [pointId, self.phantomPoint.id],
        properties: { id: circleModel.id, colorScheme }
      };
      const result = syncChange(board, change);

      logGeometryEvent(self, "update", "point", [pointId, circleModel.id],
        { userAction: "join center to circle" });

      if (isCircle(result)) {
        return result;
      }
    }

    /**
     * De-activate the active polygon.
     * This means it is no longer being edited.
     * If it only has a single point, the polygon will be deleted, leaving just a regular point.
     * @param board
     */
    function clearActivePolygon(board: JXG.Board) {
      if (!self.activePolygonId) return;
      const poly = getPolygon(board, self.activePolygonId);
      self.activePolygonId = undefined;
      if (!poly) return;
      if (poly.vertices.length < 2
          || (poly.vertices.length === 2 && poly.vertices[0]===poly.vertices[1])) {
        const change: JXGChange = {
          operation: "delete",
          target: "polygon",
          targetID: poly.id
        };
        syncChange(board, change);
      }
    }

    /**
     * Complete the polygon being drawn.
     * The point argument is the point the user clicked; normally the first point of the polygon to close it.
     * If a different point is clicked, though, the polygon is closed to that vertex, freeing any earlier points
     * since they are not part of the closed shape.
     * @param board
     * @param point
     * @returns the polygon
     */
    function closeActivePolygon(board: JXG.Board, point: JXG.Point) {
      if (!self.activePolygonId) return;
      let poly = getPolygon(board, self.activePolygonId);
      if (!poly) return;
      const vertexIds = poly.vertices.map(v => v.id);
      removeClosingVertexId(vertexIds);
      // Remove any points prior to the one clicked, they are no longer part of the poly.
      const clickedIndex = vertexIds.indexOf(point.id);
      if (clickedIndex) {
        // Not undefined and not zero; they clicked something other than the first point.
        // First remove vertex angles
        for (let i = 0; i < clickedIndex; i++) {
          deleteVertexAngle(board, poly.vertices[i]);
        }
        // Update the polygon's list of vertices
        vertexIds.splice(0, clickedIndex);
        // Update the model as well
        const polyModel = self.activePolygonId && self.getObject(self.activePolygonId);
        if (polyModel && isPolygonModel(polyModel)) {
          polyModel.points.splice(0, clickedIndex);
        }
      }
      // Remove the phantom point from the list of vertices
      const index = vertexIds.findIndex(v => v === self.phantomPoint?.id);
      if (index > 1) {
        vertexIds.splice(index,1);

        const change: JXGChange = {
          operation: "update",
          target: "polygon",
          targetID: poly.id,
          parents: vertexIds
        };
        const result = syncChange(board, change);
        if (isPolygon(result)) {
          poly = result;
        }

        fixVertexAngle(board, poly, poly.vertices[index-1]);
        fixVertexAngle(board, poly, poly.vertices[index]);
      } else {
        // If index === 1, only a single non-phantom point remains, so we delete the polygon object.
        self.deleteObjects([poly.id]);
        const change: JXGChange = {
          operation: "delete",
          target: "polygon",
          targetID: poly.id
        };
        syncChange(board, change);
        poly = undefined;
      }
      self.activePolygonId = undefined;
      return poly;
    }

    /**
     * Use the given point as the tangent point for the active circle.
     * @param board
     * @param point
     * @returns the adjusted circle
     */
    function closeActiveCircle(board: JXG.Board, point: JXG.Point): JXG.Circle|undefined {
      if (!self.activeCircleId) return;
      // Update the model
      const circleModel = self.getCircle(self.activeCircleId);
      if (!circleModel) return;
      circleModel.tangentPoint = point.id;

      // On the board, remove the circle that attaches to the phantom point and replace it with a new circle
      syncChange(board, {
        operation: "delete",
        target: "circle",
        targetID: circleModel.id
      });
      const result = syncChange(board, {
        operation: "create",
        target: "circle",
        parents: [circleModel.centerPoint, circleModel.tangentPoint],
        properties: { id: circleModel.id, colorScheme: circleModel.colorScheme }
      });
      logGeometryEvent(self, "update", "point", [point.id, circleModel.id],
        { userAction: "join tangent point to circle" });
      self.activeCircleId = undefined;
      return isCircle(result) ? result : undefined;
    }

    function addPoints(board: JXG.Board | undefined,
                       parents: JXGUnsafeCoordPair[],
                       _properties?: JXGProperties | JXGProperties[],
                       links?: ILinkProperties): JXG.Point[] {
      const props = castArray(_properties);
      const properties = parents.map((p, i) => ({ id: uniqueId(), ...(props && props[i] || props[0]) }));

      properties.forEach((_props, i) => {
        const [x, y] = parents[i];
        const { id, ...others } = _props;
        self.addObjectModel(PointModel.create({ id, x, y, ...others }));
      });

      const change: JXGChange = {
        operation: "create",
        target: links ? "linkedPoint" : "point",
        parents,
        properties,
        links
      };
      const points = applyAndLogChange(board, change);
      return isPointArray(points) ? points : [];
    }

    function addMovableLine(board: JXG.Board, parents: JXGCoordPair[], properties?: JXGProperties) {
      const [[p1x, p1y], [p2x, p2y]] = parents;
      const { id = uniqueId(), ...props } = properties || {};
      const lineModel = MovableLineModel.create({
        id, p1: { id: `${id}-point1`, x: p1x, y: p1y }, p2: { id: `${id}-point2`, x: p2x, y: p2y }, ...props
      });
      self.addObjectModel(lineModel);

      const change: JXGChange = {
        operation: "create",
        target: "movableLine",
        parents,
        properties: {id, ...props}
      };
      const elems = applyAndLogChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
    }

    function addComment(board: JXG.Board, anchorId: string, text?: string) {
      const id = uniqueId();
      self.addObjectModel(CommentModel.create({ id, anchors: [anchorId], text }));

      const textProp = text != null ? { text } : undefined;
      const change: JXGChange = {
        operation: "create",
        target: "comment",
        properties: {id, anchor: anchorId, ...textProp }
      };
      const elems = applyAndLogChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
    }

    function setSelectedColor(color: number) {
      self.selectedColor = color;
    }

    function updateSelectedObjectsColor(board: JXG.Board, color: number) {
      const selectedIds = self.getSelectedIds(board);
      const targetIds: string[] = [];

      selectedIds.forEach(id => {
        const obj = self.getObject(id);
        if (isPolygonModel(obj) || isPointModel(obj) || isCircleModel(obj)) {
          obj.setColorScheme(color);
          targetIds.push(id);
        }
      });

      const change: JXGChange = {
        operation: "update",
        target: "object",
        targetID: targetIds,
        properties: { colorScheme: color },
        userAction: "change color"
      };

      applyAndLogChange(board, change);
      targetIds.forEach(id => updateVisualProps(board, id, true));
    }

    function removeObjects(board: JXG.Board, ids: string | string[], links?: ILinkProperties) {
      self.deselectObjects(board, ids);
      const deletable = castArray(ids).filter(id => self.isDeletable(board, id));
      self.deleteObjects(deletable);

      const change: JXGChange = {
        operation: "delete",
        target: "object",
        targetID: deletable,
        links
      };
      return applyAndLogChange(board, change);
    }

    function getCentroid(obj: GeometryObjectModelUnion) {
      const forceNumber = (num: number | undefined) => num || 0;

      if (isPointModel(obj)) {
        return [forceNumber(obj.x), forceNumber(obj.y)];
      } else if (isMovableLineModel(obj)) {
        return [(forceNumber(obj.p1.x) + forceNumber(obj.p2.x)) / 2,
          (forceNumber(obj.p1.y) + forceNumber(obj.p2.y)) / 2];
      } else if (isPolygonModel(obj)) {
        const totals = [0, 0];
        let count = 0;
        obj.points.forEach(pointId => {
          const point = self.getObject(pointId);
          if (point && isPointModel(point)) {
            totals[0] = totals[0] + forceNumber(point.x);
            totals[1] = totals[1] + forceNumber(point.y);
            count++;
          }
        });
        return [totals[0] / count, totals[1] / count];
      }
      // TODO Can comments be added to any other objects?
      return [0, 0];
    }

    function updateObjects(board: JXG.Board | undefined,
                           ids: string | string[],
                           properties: JXGProperties | JXGProperties[],
                           links?: ILinkProperties,
                           userAction?: string) {
      const propsArray = castArray(properties);
      castArray(ids).forEach((id, i) => {
        const obj = self.getAnyObject(id);
        if (obj) {
          const { position, text } = propsArray[i] || propsArray[0];
          if (position != null) {
            if (isCommentModel(obj)) {
              const comment = obj as CommentModelType;
              // TODO Handle multiple anchors
              const anchor = self.getObject(comment.anchors[0]);
              const anchorPosition = anchor ? getCentroid(anchor) : [0, 0];
              const newPosition: JXGPositionProperty =
                [position[0] - anchorPosition[0], position[1] - anchorPosition[1]];
              obj.setPosition(newPosition);
            } else {
              obj.setPosition(position);
            }
          }
          if (text != null) {
            obj.setText(text);
          }
        }
      });
      const change: JXGChange = {
              operation: "update",
              target: "object",
              targetID: ids,
              properties,
              links,
              userAction
            };
      return applyAndLogChange(board, change);
    }

    function addVertexAngle(board: JXG.Board,
                            parents: string[],
                            properties?: JXGProperties): JXG.Angle | undefined {
      const { id = uniqueId(), ...props } = properties || {};
      self.addObjectModel(VertexAngleModel.create({ id, points: parents, ...props }));

      const change: JXGChange = {
              operation: "create",
              target: "vertexAngle",
              parents,
              properties: { id, ...props }
            };
      const angle = applyAndLogChange(board, change);
      return isVertexAngle(angle) ? angle : undefined;
    }

    function updateAxisLabels(board: JXG.Board | undefined, tableId: string, links?: ILinkProperties) {
      const change: JXGChange = {
              operation: "update",
              target: "tableLink",
              targetID: tableId,
              properties: { axisLabels: true },
              links
            };
      return applyAndLogChange(board, change);
    }

    function updatePolygonSegmentLabel(board: JXG.Board | undefined, polygon: JXG.Polygon,
                                       points: [JXG.Point, JXG.Point], labelOption: ELabelOption,
                                       name: string|undefined ) {
      const polygonModel = self.getObject(polygon.id);
      if (isPolygonModel(polygonModel)) {
        polygonModel.setSegmentLabel([points[0].id, points[1].id], labelOption, name);
      }

      const parentIds = points.map(obj => obj.id);
      const change: JXGChange = {
              operation: "update",
              target: "polygon",
              targetID: polygon.id,
              parents: parentIds,
              properties: { labelOption, name }
            };
      logGeometryEvent(self, "update", "segment",
        segmentIdFromPointIds(parentIds as [string,string]),
        { text: name, labelOption });
      return board && syncChange(board, change);
    }

    function updatePolygonLabel(board: JXG.Board|undefined, polygon: JXG.Polygon,
        labelOption: ELabelOption, name: string|undefined ) {
      const polygonModel = self.getObject(polygon.id);
      if (!board || !isPolygonModel(polygonModel)) return;
      polygonModel.labelOption = labelOption;
      polygonModel.name = name;

      logGeometryEvent(self, "update", "polygon", polygon.id,
        { text: name, labelOption });

      return syncChange(board, {
        operation: "update",
        target: "polygon",
        targetID: polygon.id,
        properties: { labelOption, clientName: name }
      });
    }

    function findObjects(board: JXG.Board, test: (obj: JXG.GeometryElement) => boolean): JXG.GeometryElement[] {
      return filterBoardObjects(board, test);
    }

    function isCopyableChild(child: JXG.GeometryElement) {
      switch (child && child.elType) {
        case "angle":
          return isVertexAngle(child);
        case "line":
          return isMovableLine(child);
        case "polygon":
          return true;
        case "text":
          return isComment(child);
      }
      return false;
    }

    // returns the currently selected objects and any descendant objects
    // that should also be considered selected, i.e. all of whose
    // ancestors are selected.
    function getSelectedIdsAndChildren(board: JXG.Board) {
      // list of selected ids in order of creation
      const selectedIds = getBoardObjectIds(board)
        .filter(id => self.isSelected(id));
      const children: { [id: string]: JXG.GeometryElement } = {};
      // identify children (e.g. polygons) that may be selected as well
      selectedIds.forEach(id => {
        const obj = getBoardObject(board, id);
        if (obj) {
          each(obj.childElements, child => {
            if (child && !self.isSelected(child.id) && isCopyableChild(child)) {
              children[child.id] = child;
            }
          });
        }
      });
      // children (e.g. polygons) are selected if all ancestors are selected
      each(children, child => {
        let allVerticesSelected = true;
        each(child.ancestors, point => {
          if (!self.isSelected(point.id)) {
            allVerticesSelected = false;
          }
        });
        if (allVerticesSelected) {
          selectedIds.push(child.id);
        }
      });
      return selectedIds;
    }

    function getOneSelectedComment(board: JXG.Board) {
      const comments = self.selectedObjects(board).filter(isComment);
      return comments.length === 1 ? comments[0] : undefined;
    }

    function getOneSelectedPoint(board: JXG.Board) {
      const selected = self.selectedObjects(board);
      return (selected.length === 1 && isPoint(selected[0])) ? selected[0] : undefined;
    }

    function getOneSelectedPolygon(board: JXG.Board) {
      // all vertices of polygon must be selected to show rotate handle
      const polygons = board.objectsList
        .filter(isPolygon)
        .filter(polygon => {
          return every(polygon.ancestors, vertex => self.metadata.isSelected(vertex.id));
        });
      const selectedPolygonId = (polygons.length === 1) && polygons[0].id;
      const selectedPolygon = selectedPolygonId ? polygons[0] : undefined;
      // must not have any selected points other than the polygon vertices
      if (selectedPolygon) {
        const selectedPts = self.selectedObjects(board).filter(isPoint);
        return _size(selectedPolygon.ancestors) === selectedPts.length
                  ? selectedPolygon : undefined;
      }
    }

    function getOneSelectedSegment(board: JXG.Board) {
      const selectedObjects = self.selectedObjects(board);
      const selectedSegments = selectedObjects.filter(isVisibleEdge);
      if (selectedSegments.length === 1) {
        return selectedSegments[0];
      }
    }

    function getCommentAnchor(board: JXG.Board) {
      const selectedObjects = self.selectedObjects(board);
      if (selectedObjects.length === 1 && isPoint(selectedObjects[0])) {
        return selectedObjects[0];
      }

      const selectedPolygons = selectedObjects.filter(isPolygon);
      if (selectedPolygons.length === 1) {
        return selectedPolygons[0];
      }

      const selectedLines = selectedObjects.filter(isMovableLine);
      if (selectedLines.length === 1) {
        return selectedLines[0];
      }

      const selectedSegments = selectedObjects.filter(isVisibleEdge);
      if (selectedSegments.length === 1) {
        // Labeling polygon edges is not supported due to unpredictable IDs. However, if the polygon has only two sides,
        // then labeling an edge is equivalent to labeling the whole polygon.
        const parentPoly = selectedSegments[0].parentPolygon;
        if (parentPoly && parentPoly.vertices.length === 3) {
          return parentPoly;
        }
      }
    }

    function copySelection(board: JXG.Board) {
      // identify selected objects and children (e.g. polygons)
      const selectedIds = getSelectedIdsAndChildren(board);

      // sort into creation order
      const idToIndexMap: { [id: string]: number } = {};
      forEachBoardObject(board, (obj, index) => {
        idToIndexMap[obj.id] = index;
      });
      selectedIds.sort((a, b) => idToIndexMap[a] - idToIndexMap[b]);

      // map old ids to new ones
      const idMap: Record<string, string> = {};
      selectedIds.forEach(id => {
        idMap[id] = uniqueId();
      });

      // create change objects for each object to be copied
      const copies: GeometryObjectModelType[] = [];
      for (let i = 0; i < selectedIds.length; ++i) {
        const oldId = selectedIds[i];
        const obj = self.getObject(oldId);
        if (!obj) continue;

        const newObj = cloneGeometryObject(obj, { idMap });
        if (newObj) copies.push(newObj);
      }
      return copies;
    }

    /**
     * Delete the selected objects.
     * Adjusts for various business logic before actually deleting:
     * eg, preserving linked points and points connected to polygons that are not being deleted.
     * @param board
     */
    function deleteSelection(board: JXG.Board) {
      const selectedIds = self.getSelectedIds(board);

      // remove points from polygons; identify additional objects to delete
      const deleteIds = prepareToDeleteObjects(board, selectedIds);

      if (deleteIds.length) {
        removeObjects(board, deleteIds);
      }
    }

    function applyAndLogChange(board: JXG.Board | undefined, change: JXGChange) {
      const result = board && syncChange(board, change);
      let propsId, text, labelOption, filename;
      if (change.properties && !Array.isArray(change.properties)) {
        propsId = change.properties.id;
        text = change.properties.text;
        labelOption = change.properties.labelOption?.toString();
        filename = change.properties.filename;
      }
      const targetId = propsId || change.targetID;
      logGeometryEvent(self, change.operation, change.target, targetId,
        { text, labelOption, filename, userAction: change.userAction });
      return result;
    }

    function applyBatchChanges(board: JXG.Board, changes: JXGChange[], onCreate?: onCreateCallback) {
      applyChanges(board, changes, getDispatcherContext())
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (!isBoard(changeElem)) {
              onCreate?.(changeElem);
            }
          });
        });
    }

    function syncChange(board: JXG.Board, change: JXGChange) {
      if (board) {
        return applyChange(board, change, getDispatcherContext());
      }
    }

    return {
      views: {
        get isUserResizable() {
          return true;
        },
        get isSyncSuspended() {
          return suspendCount > 0;
        },
        get batchChangeCount() {
          return batchChanges.length;
        },
        copySelection,
        findObjects,
        getOneSelectedPoint,
        getOneSelectedPolygon,
        getOneSelectedSegment,
        getOneSelectedComment,
        getCommentAnchor,
      },
      actions: {
        initializeBoard,
        destroyBoard,
        zoomBoard,
        rescaleBoard,
        resizeBoard,
        updateScale,
        addImage,
        addPoint,
        addPoints,
        addPhantomPoint,
        setPhantomPointPosition,
        realizePhantomPoint,
        addPointToActivePolygon,
        makePolygonActive,
        clearPhantomPoint,
        createPolygonIncludingPoint,
        createCircleIncludingPoint,
        clearActivePolygon,
        closeActivePolygon,
        closeActiveCircle,
        addMovableLine,
        removeObjects,
        updateObjects,
        addVertexAngle,
        updateAxisLabels,
        updatePolygonLabel,
        updatePolygonSegmentLabel,
        deleteSelection,
        applyChange: applyAndLogChange,
        applyBatchChanges,
        syncChange,
        addComment,
        setSelectedColor,
        updateSelectedObjectsColor,

        suspendSync() {
          ++suspendCount;
        },
        resumeSync() {
          if (--suspendCount <= 0) {
            // self.changes.push(...batchChanges);
            batchChanges = [];
          }
        },
        updateImageUrl(oldUrl: string, newUrl: string) {
          if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;

          if (self.bgImage?.url === oldUrl) {
            self.bgImage.setUrl(newUrl);
          }
        }
      }
    };
  })
  .actions(self => ({
    afterAttach() {
      // This reaction monitors legacy links and shared data sets, linking to tables as their
      // sharedDataSets become available.
      addDisposer(self, reaction(() => {
        const sharedModelManager: ISharedModelManager | undefined = self.tileEnv?.sharedModelManager;

        const sharedDataSets = sharedModelManager?.isReady
          ? sharedModelManager.getSharedModelsByType("SharedDataSet")
          : [];

        return { sharedModelManager, sharedDataSets, links: self.links };
      },
      // reaction/effect
      ({ sharedModelManager, sharedDataSets, links }) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        // Link to shared models when importing legacy content
        const remainingLinks: string[] = [];
        self.links.forEach(tableId => {
          const sharedDataSet = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tableId);
          if (sharedDataSet) {
            sharedModelManager.addTileSharedModel(self, sharedDataSet);
          } else {
            // If the table doesn't yet have a sharedDataSet, save the id to attach this later
            remainingLinks.push(tableId);
          }
        });
        self.replaceLinks(remainingLinks);
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      self.forceSharedModelUpdate();
    },
    syncLinkedChange(dataSet: IDataSet, links: ITableLinkProperties) {
      // TODO: handle update
    }
  }));

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
export type GeometryContentSnapshotType = SnapshotIn<typeof GeometryContentModel>;

export type GeometryMigratedContent = [GeometryContentModelType, { title: string }];
