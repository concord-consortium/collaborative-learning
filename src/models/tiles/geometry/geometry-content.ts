import { castArray, difference, each, size as _size, union } from "lodash";
import { reaction } from "mobx";
import { addDisposer, applySnapshot, detach, Instance, SnapshotIn, types } from "mobx-state-tree";
import { SharedDataSet, SharedDataSetType } from "../../shared/shared-data-set";
import { SelectionStoreModelType } from "../../stores/selection";
import { ITableLinkProperties, linkedPointId } from "../table-link-types";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../tile-model-hooks";
import { ICreateRowsProperties, IRowProperties, ITableChange } from "../table/table-change";
import { canonicalizeValue } from "../table/table-model-types";
import { convertModelToChanges, exportGeometryJson } from "./geometry-migrate";
import { preprocessImportFormat } from "./geometry-import";
import {
  cloneGeometryObject, CommentModel, CommentModelType, GeometryBaseContentModel, GeometryObjectModelType,
  GeometryObjectModelUnion, ImageModel, ImageModelType, isCommentModel, isMovableLineModel, isMovableLinePointId,
  isPointModel, isPolygonModel, MovableLineModel, PointModel, PolygonModel, PolygonModelType, VertexAngleModel
} from "./geometry-model";
import {
  getBoardUnitsAndBuffers, getObjectById, guessUserDesiredBoundingBox, kXAxisTotalBuffer, kYAxisTotalBuffer,
  resumeBoardUpdates, suspendBoardUpdates
} from "./jxg-board";
import {
  ESegmentLabelOption, ILinkProperties, JXGChange, JXGCoordPair, JXGPositionProperty, JXGProperties, JXGUnsafeCoordPair
} from "./jxg-changes";
import { applyChange, applyChanges, IDispatcherChangeContext } from "./jxg-dispatcher";
import { prepareToDeleteObjects } from "./jxg-polygon";
import {
  isAxisArray, isBoard, isComment, isImage, isMovableLine, isPoint, isPointArray, isPolygon,
  isVertexAngle, isVisibleEdge, kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin,
  kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth, toObj
} from "./jxg-types";
import { SharedModelType } from "../../shared/shared-model";
import { ISharedModelManager } from "../../shared/shared-model-manager";
import { IDataSet } from "../../data/data-set";
import { uniqueId } from "../../../utilities/js-utils";
import { gImageMap } from "../../image-map";
import { IClueTileObject } from "../../annotations/clue-object";
import { appendVertexId, getPolygon, logGeometryEvent } from "./geometry-utils";
import { getPointVisualProps } from "./jxg-point";

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

export function setElementColor(board: JXG.Board, id: string, selected: boolean) {
  const element = getObjectById(board, id);
  if (element) {
    if (isPoint(element)) {
      const props = getPointVisualProps(selected,
        element.getAttribute("colorScheme"), element.getAttribute("isPhantom"));
      element.setAttribute(props);
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
    updateSharedModels: 0
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
    getLinkedPointsData() {
      const data: Map<string,{coords:JXGCoordPair[],properties:{id:string, colorScheme:number}[]}> = new Map();
      self.linkedDataSets.forEach(link => {
        const coords: JXGCoordPair[] = [];
        const properties: Array<{ id: string, colorScheme: number }> = [];
        for (let ci = 0; ci < link.dataSet.cases.length; ++ci) {
          const x = link.dataSet.attributes[0]?.numValue(ci);
          for (let ai = 1; ai < link.dataSet.attributes.length; ++ai) {
            const attr = link.dataSet.attributes[ai];
            const colorScheme = self.getColorForAttributeId(attr.id) || 0;
            const id = linkedPointId(link.dataSet.cases[ci].__id__, attr.id);
            const y = attr.numValue(ci);
            if (isFinite(x) && isFinite(y)) {
              coords.push([x, y]);
              properties.push({ id, colorScheme });
            }
          }
        }
        data.set(link.providerId, { coords, properties });
      });
      return data;
    }
  }))
  .views(self => ({
    // Returns any object in the model, even a subobject (like a movable line's point)
    getAnyObject(id: string) {
      if (isMovableLinePointId(id)) {
        // Special case for movableLine points, which aren't in self.objects
        return self.getMovableLinePoint(id);
      } else {
        return self.getObject(id);
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
      return this.getSelectedIds(board).filter(id => {
        const obj = getObjectById(board, id);
        return obj && !obj.getAttribute("fixed") && !obj.getAttribute("clientUndeletable");
      });
    }
  }))
  .views(self => ({
    hasDeletableSelection(board: JXG.Board) {
      return self.getDeletableSelectedIds(board).length > 0;
    },
    selectedObjects(board: JXG.Board) {
      return board.objectsList.filter(obj => self.isSelected(obj.id));
    },
    exportJson(options?: ITileExportOptions) {
      const changes = convertModelToChanges(self, { addBuffers: false, includeUnits: false});
      const jsonChanges = changes.map(change => JSON.stringify(change));
      return exportGeometryJson(jsonChanges, options);
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
        const elt = board && board.objects[id];
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
        self.deselectElement(board, id);
      });
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
    // views

    // actions
    function initializeBoard(domElementID: string, onCreate?: onCreateCallback): JXG.Board | undefined {
      let board: JXG.Board | undefined;
      const changes = convertModelToChanges(self, { addBuffers: true, includeUnits: true});
      applyChanges(domElementID, changes, getDispatcherContext())
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (isBoard(changeElem)) {
              board = changeElem;
              suspendBoardUpdates(board);
            }
            else if (onCreate) {
              onCreate(changeElem);
            }
          });
        });
      if (board) {
        resumeBoardUpdates(board);
      }
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
      // TODO log change
    }

    function rescaleBoard(board: JXG.Board, params: IAxesParams) {
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
      if (self.board) {
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
      const axes = applyAndLogChange(board, change);
      return isAxisArray(axes) ? axes : undefined;
    }

    function updateScale(board: JXG.Board, scale: number) {
      // Ostensibly, the "right" thing to do here is to call
      // board.updateCSSTransforms(), but that call inexplicably incorporates
      // the scale factor multiple times as it walks the DOM hierarchy, so we
      // just skip the DOM walk and set the transform to the correct value.
      if (board) {
        const invScale = 1 / (scale || 1);
        const cssTransMat = [
                [1, 0, 0],
                [0, invScale, 0],
                [0, 0, invScale]
              ];
        board.cssTransMat = cssTransMat;
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

    function addPhantomPoint(board: JXG.Board, parents: JXGCoordPair, polygonId?: string):
        JXG.Point | undefined {
      if (!board) return undefined;

      const props = {
        id: uniqueId(),
        isPhantom: true
      };
      const pointModel = PointModel.create({ x: parents[0], y: parents[1], ...props });
      self.phantomPoint = pointModel;

      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: { ...props }
      };
      const point = syncChange(board, change);

      // If a polygon ID was provided, display the phantom point as if it was part of that polygon
      if (polygonId) {
        const poly = getPolygon(board, polygonId);
        if (poly) {
          const vertexIds = poly.vertices.map(v => v.id);
          const change2: JXGChange = {
            operation: "update",
            target: "polygon",
            targetID: polygonId,
            parents: appendVertexId(vertexIds, pointModel.id)
          };
          syncChange(board, change2);
        } else {
          console.warn("didn't find polygon", polygonId);
        }
      }

      return isPoint(point) ? point : undefined;
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
     * Make the current phantom point into a real point.
     * The new point is persisted into the model. It remains a part of the active polygon if any.
     * @param board
     * @param position
     * @param polygonId
     * @returns the point, now considered "real".
     */
    function realizePhantomPoint(board: JXG.Board, position: JXGCoordPair, makePolygon: boolean):
        { point: JXG.Point | undefined, polygon: JXG.Polygon | undefined } {
      // Transition the current phantom point into a real point.
      const newRealPoint = self.phantomPoint;
      if (!newRealPoint) return { point: undefined, polygon: undefined };
      detach(newRealPoint);
      self.addObjectModel(newRealPoint);

      // Create a new phantom point
      const phantomPoint = addPhantomPoint(board, position);
      if (!phantomPoint) {
        console.warn("Failed to create phantom point");
        return { point: undefined, polygon: undefined };
      }

      // Update the previously-existing JSXGraph point to be real, not phantom
      const change: JXGChange = {
        operation: "update",
        target: "object",
        targetID: newRealPoint.id,
        properties: {
          isPhantom: false,
          position
        }
      };
      syncChange(board, change);

      let newPolygon = undefined;
      if (makePolygon) {
        const poly = self.activePolygonId && getPolygon(board, self.activePolygonId);
        if (poly) {
          // Add new phantom point to existing polygon
          const vertexIds = poly.vertices.map(v => v.id);
          const change2: JXGChange = {
            operation: "update",
            target: "polygon",
            targetID: poly.id,
            parents: appendVertexId(vertexIds, phantomPoint?.id)
          };
          syncChange(board, change2);

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
            properties: { id: self.activePolygonId }
          };
          const result = syncChange(board, change2);
          if (isPolygon(result)) {
            newPolygon = result;

            // Update the model
            const polygonModel = PolygonModel.create({ id: newPolygon.id, points: [newRealPoint.id] });
            self.addObjectModel(polygonModel);
            self.activePolygonId = polygonModel.id;
          }
        }
      }

      // Log event
      logGeometryEvent(self, "create",
        makePolygon ? "vertex" : "point",
        self.activePolygonId ? [newRealPoint.id, self.activePolygonId] : newRealPoint.id);

      // Return newly-created objects
      const obj = board.objects[newRealPoint.id];
      const point = isPoint(obj) ? obj : undefined;
      return { point, polygon: newPolygon };
    }

    function clearPhantomPoint(board: JXG.Board) {
      if (self.phantomPoint) {
        const phantomId = self.phantomPoint.id;

        // remove from polygon, if it's in one.
        if (self.activePolygonId) {
          const poly = getPolygon(board, self.activePolygonId);
          if (poly) {
            const remainingVertices = poly.vertices.map(v => v.id).filter(id => id !== phantomId);
            const change1: JXGChange = {
              operation: "update",
              target: "polygon",
              targetID: self.activePolygonId,
              parents: remainingVertices
            };
            syncChange(board, change1);
          }
        }

        const change: JXGChange = {
          operation: "delete",
          target: "point",
          targetID: self.phantomPoint.id
        };
        syncChange(board, change);
        self.phantomPoint = undefined;
      }
    }

    function clearActivePolygon() {
      self.activePolygonId = undefined;
    }

    function closeActivePolygon(board: JXG.Board) {
      if (!self.activePolygonId) return;
      let poly = getPolygon(board, self.activePolygonId);
      if (!poly) return;
      const vertexIds = poly.vertices.map(v => v.id);
      // Remove the phantom point from the list of vertices & update polygon
      const index = vertexIds.findIndex(v => v === self.phantomPoint?.id);
      if (index >= 1) {
        vertexIds.splice(index,1);

        const change: JXGChange = {
          operation: "update",
          target: "polygon",
          targetID: poly.id,
          parents: vertexIds,
        };
        const result = syncChange(board, change);
        if (isPolygon(result)) {
          poly = result;
        }
      } else {
        // If index === 1, only a single point remains, no need for a polygon object.
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

    function removeObjects(board: JXG.Board | undefined, ids: string | string[], links?: ILinkProperties) {
      board && self.deselectObjects(board, ids);
      self.deleteObjects(castArray(ids));

      const change: JXGChange = {
        operation: "delete",
        target: "object",
        targetID: ids,
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
                                       points: [JXG.Point, JXG.Point], labelOption: ESegmentLabelOption) {
      const polygonModel = self.getObject(polygon.id);
      if (isPolygonModel(polygonModel)) {
        polygonModel.setSegmentLabel([points[0].id, points[1].id], labelOption);
      }

      const parentIds = points.map(obj => obj.id);
      const change: JXGChange = {
              operation: "update",
              target: "polygon",
              targetID: polygon.id,
              parents: parentIds,
              properties: { labelOption }
            };
      return applyAndLogChange(board, change);
    }

    function findObjects(board: JXG.Board, test: (obj: JXG.GeometryElement) => boolean): JXG.GeometryElement[] {
      return board.objectsList.filter(test);
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
      const selectedIds = board.objectsList
                               .map(obj => obj.id)
                               .filter(id => self.isSelected(id));
      const children: { [id: string]: JXG.GeometryElement } = {};
      // identify children (e.g. polygons) that may be selected as well
      selectedIds.forEach(id => {
        const obj = board.objects[id];
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
      return (selected.length === 1 && isPoint(selected[0]));
    }

    function getOneSelectedPolygon(board: JXG.Board) {
      // all vertices of polygon must be selected to show rotate handle
      const polygonSelection: { [id: string]: { any: boolean, all: boolean } } = {};
      const polygons = board.objectsList
                            .filter(isPolygon)
                            .filter(polygon => {
                              const selected = { any: false, all: true };
                              each(polygon.ancestors, vertex => {
                                if (self.metadata.isSelected(vertex.id)) {
                                  selected.any = true;
                                }
                                else {
                                  selected.all = false;
                                }
                              });
                              polygonSelection[polygon.id] = selected;
                              return selected.any;
                            });
      const selectedPolygonId = (polygons.length === 1) && polygons[0].id;
      const selectedPolygon = selectedPolygonId && polygonSelection[selectedPolygonId].all
                                ? polygons[0] : undefined;
      // must not have any selected points other than the polygon vertices
      if (selectedPolygon) {
        type IEntry = [string, boolean];
        const selectionEntries = Array.from(self.metadata.selection.entries()) as IEntry[];
        const selectedPts = selectionEntries
                              .filter(entry => {
                                const id = entry[0];
                                const obj = board.objects[id];
                                const isSelected = entry[1];
                                return obj && (obj.elType === "point") && isSelected;
                              });
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
        if (parentPoly && parentPoly.borders.length === 2) {
          return parentPoly;
        }
      }
    }

    function copySelection(board: JXG.Board) {
      // identify selected objects and children (e.g. polygons)
      const selectedIds = getSelectedIdsAndChildren(board);

      // sort into creation order
      const idToIndexMap: { [id: string]: number } = {};
      board.objectsList.forEach((obj, index) => {
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

    function deleteSelection(board: JXG.Board) {
      const selectedIds = self.getDeletableSelectedIds(board);

      // remove points from polygons; identify additional objects to delete
      selectedIds.push(...prepareToDeleteObjects(board, selectedIds));

      self.deselectAll(board);
      board.showInfobox(false);
      if (selectedIds.length) {
        removeObjects(board, selectedIds);
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
        clearPhantomPoint,
        clearActivePolygon,
        closeActivePolygon,
        addMovableLine,
        removeObjects,
        updateObjects,
        addVertexAngle,
        updateAxisLabels,
        updatePolygonSegmentLabel,
        deleteSelection,
        applyChange: applyAndLogChange,
        applyBatchChanges,
        syncChange,
        addComment,

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
  .views(self => ({
    getPositionOfPoint(dataSet: IDataSet, caseId: string, attrId: string): JXGUnsafeCoordPair {
      const attrCount = dataSet.attributes.length;
      const xAttr = attrCount > 0 ? dataSet.attributes[0] : undefined;
      const yAttr = dataSet.attrFromID(attrId);
      const xValue = xAttr ? dataSet.getValue(caseId, xAttr.id) : undefined;
      const yValue = yAttr ? dataSet.getValue(caseId, yAttr.id) : undefined;
      return [canonicalizeValue(xValue), canonicalizeValue(yValue)];
    }
  }))
  .views(self => ({
    getPointPositionsForColumns(dataSet: IDataSet, attrIds: string[]): [string[], JXGUnsafeCoordPair[]] {
      const pointIds: string[] = [];
      const positions: JXGUnsafeCoordPair[] = [];
      dataSet.cases.forEach(aCase => {
        const caseId = aCase.__id__;
        attrIds.forEach(attrId => {
          pointIds.push(linkedPointId(caseId, attrId));
          positions.push(self.getPositionOfPoint(dataSet, caseId, attrId));
        });
      });
      return [pointIds, positions];
    },
    getPointPositionsForRowsChange(dataSet: IDataSet, change: ITableChange): [string[], JXGUnsafeCoordPair[]] {
      const pointIds: string[] = [];
      const positions: JXGUnsafeCoordPair[] = [];
      const caseIds = castArray(change.ids);
      const propsArray: IRowProperties[] = change.action === "create"
                                            ? (change.props as ICreateRowsProperties)?.rows
                                            : castArray(change.props as any);
      const xAttrId = dataSet.attributes.length > 0 ? dataSet.attributes[0].id : undefined;
      caseIds.forEach((caseId, caseIndex) => {
        const tableProps = propsArray[caseIndex] || propsArray[0];
        // if x value changes, all points in row are affected
        if (xAttrId && tableProps[xAttrId] != null) {
          for (let attrIndex = 1; attrIndex < dataSet.attributes.length; ++attrIndex) {
            const attrId = dataSet.attributes[attrIndex].id;
            const pointId = linkedPointId(caseId, attrId);
            const position = self.getPositionOfPoint(dataSet, caseId, attrId);
            if (pointId && position) {
              pointIds.push(pointId);
              positions.push(position);
            }
          }
        }
        // otherwise, only points with y-value changes are affected
        else {
          each(tableProps, (value, attrId) => {
            const pointId = linkedPointId(caseId, attrId);
            const position = self.getPositionOfPoint(dataSet, caseId, attrId);
            if (pointId && position) {
              pointIds.push(pointId);
              positions.push(position);
            }
          });
        }
      });
      return [pointIds, positions];
    }
  }))
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
