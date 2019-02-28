import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { ITableChange, ITableLinkProperties, kLabelAttrName, TableContentModelType } from "../table/table-content";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { forEachNormalizedChange, ILinkProperties, JXGChange, JXGProperties, JXGCoordPair, JXGParentType
        } from "./jxg-changes";
import { guessUserDesiredBoundingBox, isBoard, kAxisBuffer, kGeometryDefaultAxisMin, kGeometryDefaultHeight,
          kGeometryDefaultWidth, kGeometryDefaultPixelsPerUnit, syncAxisLabels } from "./jxg-board";
import { isComment } from "./jxg-comment";
import { isMovableLine } from "./jxg-movable-line";
import { isFreePoint, isPoint, kPointDefaults, kSnapUnit } from "./jxg-point";
import { isPolygon, isVisibleEdge, prepareToDeleteObjects } from "./jxg-polygon";
import { isLinkedPoint } from "./jxg-table-link";
import { isVertexAngle } from "./jxg-vertex-angle";
import { IDataSet } from "../../data/data-set";
import { assign, castArray, each, keys, omit, size as _size } from "lodash";
import * as uuid from "uuid/v4";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { Logger, LogEventName } from "../../../lib/logger";
import { getTileContentById } from "../../../utilities/mst-utils";
import { gImageMap } from "../../image-map";

export const kGeometryToolID = "Geometry";

export { kGeometryDefaultHeight };

export type onCreateCallback = (elt: JXG.GeometryElement) => void;

function getAxisUnits(protoRange: JXGCoordPair | undefined) {
  const pRange = protoRange && castArray(protoRange);
  if (!pRange || !pRange.length) return [kGeometryDefaultPixelsPerUnit, kGeometryDefaultPixelsPerUnit];
  // a single value is treated as the y-range
  if (pRange.length === 1) {
    const [yProtoRange] = pRange;
    const yUnit = kGeometryDefaultHeight / yProtoRange;
    return [yUnit, yUnit];
  }
  else {
    const [xProtoRange, yProtoRange] = pRange as JXGCoordPair;
    return [kGeometryDefaultWidth / xProtoRange, kGeometryDefaultHeight / yProtoRange];
  }
}

function getBoardBounds(axisMin?: JXGCoordPair, protoRange?: JXGCoordPair) {
  const [xAxisMin, yAxisMin] = axisMin || [kGeometryDefaultAxisMin, kGeometryDefaultAxisMin];
  const [xPixelsPerUnit, yPixelsPerUnit] = getAxisUnits(protoRange);
  const xAxisMax = xAxisMin + kGeometryDefaultWidth / xPixelsPerUnit;
  const yAxisMax = yAxisMin + kGeometryDefaultHeight / yPixelsPerUnit;
  return [xAxisMin, yAxisMax, xAxisMax, yAxisMin];
}

function defaultGeometryBoardChange(overrides?: JXGProperties) {
  // TODO: refactor this
  const [xMin, yMax, xMax, yMin] = getBoardBounds();
  const unitX = kGeometryDefaultPixelsPerUnit;
  const unitY = kGeometryDefaultPixelsPerUnit;
  const xBufferRange = kAxisBuffer / unitX;
  const yBufferRange = kAxisBuffer / unitY;
  const boundingBox = [xMin - xBufferRange, yMax + yBufferRange, xMax + xBufferRange, yMin - yBufferRange];
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: {
                  axis: true,
                  boundingBox,
                  unitX,
                  unitY,
                  ...overrides
                }
  };
  return change;
}

export function defaultGeometryContent(overrides?: JXGProperties) {
  const change = defaultGeometryBoardChange(overrides);
  const changeJson = JSON.stringify(change);
  return GeometryContentModel.create({ changes: [changeJson] });
}

export interface IAxisLabels {
  x: string | undefined;
  y: string | undefined;
}

const LinkedTableEntryModel = types
  .model("LinkedTableEntryModel", {
    id: types.string,
    x: types.maybe(types.string),
    y: types.maybe(types.string)
  });

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const GeometryMetadataModel = types
  .model("GeometryMetadata", {
    id: types.string,
    selection: types.map(types.boolean),
    linkedTables: types.array(LinkedTableEntryModel)
  })
  .views(self => ({
    isSelected(id: string) {
      return !!self.selection.get(id);
    },
    hasSelection() {
      return Array.from(self.selection.values()).some(isSelected => isSelected);
    },
    isLinkedToTable(tableId: string) {
      return self.linkedTables.findIndex(entry => entry.id === tableId) >= 0;
    },
    get xAxisLabel() {
      const links = self.linkedTables
                        .map(entry => entry.x)
                        .filter(name => name && name !== "x");
      return links.length ? `x (${links.join(", ")})` : "x";
    },
    get yAxisLabel() {
      const links = self.linkedTables
                        .map(entry => entry.y)
                        .filter(name => name && name !== "y");
      return links.length ? `y (${links.join(", ")})` : "y";
    }
  }))
  .actions(self => ({
    select(id: string) {
      self.selection.set(id, true);
    },
    deselect(id: string) {
      self.selection.set(id, false);
    },
    addTableLink(tableId: string, axes: IAxisLabels) {
      if (self.linkedTables.findIndex(entry => entry.id === tableId) < 0) {
        self.linkedTables.push({ id: tableId, ...axes });
      }
    },
    removeTableLink(tableId: string) {
      const index = self.linkedTables.findIndex(entry => entry.id === tableId);
      if (index >= 0) {
        self.linkedTables.splice(index, 1);
      }
    },
    setTableLinkNames(tableId: string, x: string | undefined, y: string | undefined) {
      const found = self.linkedTables.find(entry => entry.id === tableId);
      if (found) {
        if (x != null) found.x = x;
        if (y != null) found.y = y;
      }
    },
    clearLinkedTables() {
      self.linkedTables.clear();
    }
  }));
export type GeometryMetadataModelType = Instance<typeof GeometryMetadataModel>;

export function setElementColor(board: JXG.Board, id: string, selected: boolean) {
  const element = board.objects[id];
  if (element) {
    const fillColor = element.getAttribute("clientFillColor") || kPointDefaults.fillColor;
    const strokeColor = element.getAttribute("clientStrokeColor") || kPointDefaults.strokeColor;
    const selectedFillColor = element.getAttribute("clientSelectedFillColor") || kPointDefaults.selectedFillColor;
    const selectedStrokeColor = element.getAttribute("clientSelectedStrokeColor") || kPointDefaults.selectedStrokeColor;
    const clientCssClass = selected
                            ? element.getAttribute("clientSelectedCssClass")
                            : element.getAttribute("clientCssClass");
    const cssClass = clientCssClass ? { cssClass: clientCssClass } : undefined;
    element.setAttribute({
              fillColor: selected ? selectedFillColor : fillColor,
              strokeColor: selected ? selectedStrokeColor : strokeColor,
              ...cssClass
            });
  }
}

function isUndoableChange(change: JXGChange) {
  if ((change.operation === "delete") && (change.target === "tableLink")) return false;
  return true;
}

export const GeometryContentModel = types
  .model("GeometryContent", {
    type: types.optional(types.literal(kGeometryToolID), kGeometryToolID),
    changes: types.array(types.string)
  })
  .volatile(self => ({
    metadata: undefined as any as GeometryMetadataModelType
  }))
  .preProcessSnapshot(snapshot => preprocessImportFormat(snapshot))
  .views(self => ({
    isSelected(id: string) {
      return self.metadata.isSelected(id);
    },
    hasSelection() {
      return self.metadata.hasSelection();
    },
    get selectedIds() {
      const selected: string[] = [];
      self.metadata.selection.forEach((isSelected, id) => {
        isSelected && selected.push(id);
      });
      return selected;
    },
    get isLinked() {
      return self.metadata.linkedTables.length > 0;
    },
    isLinkedToTable(tableId: string) {
      return self.metadata.isLinkedToTable(tableId);
    },
    get xAxisLabel() {
      return self.metadata.xAxisLabel;
    },
    get yAxisLabel() {
      return self.metadata.yAxisLabel;
    },
    getTableContent(tileId: string) {
      const content = getTileContentById(self, tileId);
      return content && content as TableContentModelType;
    }
  }))
  .views(self => ({
    getDeletableSelectedIds(board: JXG.Board) {
      // returns the ids in creation order
      return board.objectsList
                  .filter(obj => self.isSelected(obj.id) &&
                          !obj.getAttribute("fixed") && !obj.getAttribute("clientUndeletable"))
                  .map(obj => obj.id);
    },
    canUndo() {
      const hasUndoableChanges = self.changes.length > 1;
      if (!hasUndoableChanges) return false;
      const lastChange = hasUndoableChanges ? self.changes[self.changes.length - 1] : undefined;
      const lastChangeParsed: JXGChange = lastChange && safeJsonParse(lastChange);
      if (!isUndoableChange(lastChangeParsed)) return false;
      const lastChangeLinks = lastChangeParsed && lastChangeParsed.links;
      if (!lastChangeLinks) return true;
      const linkedTiles = lastChangeLinks ? lastChangeLinks.tileIds : undefined;
      const linkedTile = linkedTiles && linkedTiles[0];
      const tableContent = linkedTile ? self.getTableContent(linkedTile) : undefined;
      return tableContent ? tableContent.canUndoLinkedChange(lastChangeParsed) : false;
    },
    canUndoLinkedChange(change: ITableChange) {
      const hasUndoableChanges = self.changes.length > 1;
      if (!hasUndoableChanges) return false;
      const lastChange = hasUndoableChanges ? self.changes[self.changes.length - 1] : undefined;
      const lastChangeParsed = lastChange && safeJsonParse(lastChange);
      const lastChangeLinks = lastChangeParsed && lastChangeParsed.links;
      if (!lastChangeLinks) return false;
      const geometryActionLinkId = lastChangeLinks && lastChangeLinks.id;
      const tableActionLinkId = change.links && change.links.id;
      return geometryActionLinkId && tableActionLinkId && (geometryActionLinkId === tableActionLinkId);
    }
  }))
  .actions(self => ({
    selectElement(id: string) {
      if (!self.isSelected(id)) {
        self.metadata.select(id);
      }
    },
    deselectElement(id: string) {
      if (self.isSelected(id)) {
        self.metadata.deselect(id);
      }
    },
    selectedObjects(board: JXG.Board) {
      return self.selectedIds.map(id => board.objects[id]);
    }
  }))
  .actions(self => ({
    doPostCreate(metadata: GeometryMetadataModelType) {
      self.metadata = metadata;
    },
    willRemoveFromDocument() {
      self.metadata.linkedTables.forEach(({ id: tableId }) => {
        const tableContent = self.getTableContent(tableId);
        tableContent && tableContent.removeGeometryLink(self.metadata.id);
      });
      self.metadata.clearLinkedTables();
    },
    selectObjects(ids: string | string[]) {
      const _ids = Array.isArray(ids) ? ids : [ids];
      _ids.forEach(id => {
        self.selectElement(id);
      });
    },
    deselectObjects(board: JXG.Board, ids: string | string[]) {
      const _ids = Array.isArray(ids) ? ids : [ids];
      _ids.forEach(id => {
        self.deselectElement(id);
      });
    },
    deselectAll(board: JXG.Board) {
      self.metadata.selection.forEach((value, id) => {
        self.deselectElement(id);
      });
    }
  }))
  .extend(self => {

    let suspendCount = 0;
    let batchChanges: string[] = [];

    function handleWillApplyChange(board: JXG.Board | string, change: JXGChange) {
      const op = change.operation.toLowerCase();
      const target = change.target.toLowerCase();
      if (target === "tablelink") {
        const tableId = (change.targetID as string) ||
                          (change.parents && change.parents[0] as string);
        if (tableId) {
          const links = change.links as ITableLinkProperties;
          const labels = links && links.labels;
          const xEntry = labels && labels.find(entry => entry.id === "xAxis");
          const yEntry = labels && labels.find(entry => entry.id === "yAxis");
          if (op === "create") {
            const tableContent = self.getTableContent(tableId);
            if (tableContent) {
              const axes: IAxisLabels = { x: xEntry && xEntry.label, y: yEntry && yEntry.label };
              self.metadata.addTableLink(tableId, axes);
            }
          }
          else if (op === "delete") {
            self.metadata.removeTableLink(tableId);
          }
          else if (op === "update") {
            if (xEntry || yEntry) {
              self.metadata.setTableLinkNames(tableId, xEntry && xEntry.label, yEntry && yEntry.label);
            }
          }
        }
      }
    }

    function handleDidApplyChange(board: JXG.Board | undefined, change: JXGChange) {
      const target = change.target.toLowerCase();
      if (board && (target === "tablelink")) {
        syncAxisLabels(board, self.xAxisLabel, self.yAxisLabel);
      }
    }

    // views

    // actions
    function initializeBoard(domElementID: string, onCreate?: onCreateCallback): JXG.Board | undefined {
      const changes = self.changes.map(change => JSON.parse(change));
      let board: JXG.Board | undefined;
      applyChanges(domElementID, changes, handleWillApplyChange, handleDidApplyChange)
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (isBoard(changeElem)) {
              board = changeElem as JXG.Board;
              board.suspendUpdate();
            }
            else if (onCreate) {
              onCreate(changeElem as JXG.GeometryElement);
            }
          });
        });
      if (board) {
        board.unsuspendUpdate();
      }
      return board;
    }

    function destroyBoard(board: JXG.Board) {
      JXG.JSXGraph.freeBoard(board);
    }

    function resizeBoard(board: JXG.Board, width: number, height: number, scale?: number) {
      // JSX Graph canvasWidth and canvasHeight are truncated to integers,
      // so we need to do the same to get the new canvasWidth and canvasHeight values
      const scaledWidth = Math.trunc(width) / (scale || 1);
      const scaledHeight = Math.trunc(height) / (scale || 1);
      const widthMultiplier = (scaledWidth - kAxisBuffer * 2) / (board.canvasWidth - kAxisBuffer * 2);
      const heightMultiplier = (scaledHeight - kAxisBuffer * 2) / (board.canvasHeight - kAxisBuffer * 2);
      const unitX = board.unitX || kGeometryDefaultPixelsPerUnit;
      const unitY = board.unitY || kGeometryDefaultPixelsPerUnit;
      // Remove the buffers to correct the graph proportions
      const [xMin, yMax, xMax, yMin] = guessUserDesiredBoundingBox(board);
      const xBufferRange = kAxisBuffer / unitX;
      const yBufferRange = kAxisBuffer / unitY;
      // Add the buffers back post-scaling
      const newBoundingBox: JXG.BoundingBox = [
        xMin * widthMultiplier - xBufferRange,
        yMax * heightMultiplier + yBufferRange,
        xMax * widthMultiplier + xBufferRange,
        yMin * heightMultiplier - yBufferRange
      ];
      board.resizeContainer(scaledWidth, scaledHeight, false, true);
      board.setBoundingBox(newBoundingBox, false);
      board.update();
    }

    function rescaleBoard(board: JXG.Board, xMax: number, yMax: number, xMin: number, yMin: number) {
      const { canvasWidth, canvasHeight } = board;
      const width = canvasWidth - kAxisBuffer * 2;
      const height = canvasHeight - kAxisBuffer * 2;
      const unitX = width / (xMax - xMin);
      const unitY = height / (yMax - yMin);
      const change: JXGChange = {
        operation: "update",
        target: "board",
        targetID: board.id,
        properties: { boardScale: {xMin, yMin, unitX, unitY, canvasWidth: width, canvasHeight: height} }
      };
      _applyChange(undefined, change);
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

    function addChange(change: JXGChange) {
      self.changes.push(JSON.stringify(change));
    }

    function popChangeset() {
      // The first change is board creation and should not be popped
      if (self.changes.length > 1) {
        const changes: string[] = [];
        let changeStr = self.changes.pop();
        if (changeStr) {
          // earlier changes go earlier in the array to maintain order
          changes.unshift(changeStr);

          let change = safeJsonParse(changeStr);
          if (change.endBatch) {
            while (change && !change.startBatch) {
              changeStr = self.changes.pop();
              if (changeStr) {
                changes.unshift(changeStr);
              }
              change = safeJsonParse(changeStr);
            }
          }
        }
        return changes;
      } else {
        return null;
      }
    }

    function pushChangeset(changes: string[]) {
      self.changes.push(...changes);
    }

    function addImage(board: JXG.Board,
                      url: string,
                      coords: JXGCoordPair,
                      size: JXGCoordPair,
                      properties?: JXGProperties): JXG.Image | undefined {
      const change: JXGChange = {
        operation: "create",
        target: "image",
        parents: [url, coords, size],
        properties: assign({ id: uuid() }, properties)
      };
      const image = _applyChange(board, change);
      return image ? image as JXG.Image : undefined;
    }

    function addPoint(board: JXG.Board | undefined,
                      parents: JXGCoordPair,
                      properties?: JXGProperties): JXG.Point | undefined {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: assign({ id: uuid() }, properties)
      };
      const point = _applyChange(board, change);
      return point ? point as JXG.Point : undefined;
    }

    function addPoints(board: JXG.Board | undefined,
                       parents: JXGCoordPair[],
                       properties?: JXGProperties | JXGProperties[],
                       links?: ILinkProperties): JXG.Point[] {
      const props = castArray(properties);
      const change: JXGChange = {
        operation: "create",
        target: links ? "linkedPoint" : "point",
        parents,
        properties: parents.map((p, i) => ({ id: uuid(), ...(props && props[i] || props[0]) })),
        links
      };
      const points = _applyChange(board, change);
      return points ? points as JXG.Point[] : [];
    }

    function addMovableLine(board: JXG.Board, parents: any, properties?: JXGProperties) {
      const change: JXGChange = {
        operation: "create",
        target: "movableLine",
        parents,
        properties: {id: uuid(), ...properties}
      };
      const elems = _applyChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
    }

    function addComment(board: JXG.Board, anchorId: string) {
      const change: JXGChange = {
        operation: "create",
        target: "comment",
        properties: {id: uuid(), anchor: anchorId }
      };
      const elems = _applyChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
    }

    function updateComment(board: JXG.Board, commentId: string, properties: JXGProperties) {
      const change: JXGChange = {
        operation: "update",
        target: "comment",
        targetID: commentId,
        properties
      };
      const comment = _applyChange(undefined, change);
      return comment ? comment as JXG.Text : undefined;
    }

    function removeObjects(board: JXG.Board | undefined, ids: string | string[], links?: ILinkProperties) {
      const change: JXGChange = {
        operation: "delete",
        target: "object",
        targetID: ids,
        links
      };
      return _applyChange(board, change);
    }

    function updateObjects(board: JXG.Board | undefined,
                           ids: string | string[],
                           properties: JXGProperties | JXGProperties[],
                           links?: ILinkProperties) {
      const change: JXGChange = {
              operation: "update",
              target: "object",
              targetID: ids,
              properties,
              links
            };
      return _applyChange(board, change);
    }

    function createPolygonFromFreePoints(board: JXG.Board, properties?: JXGProperties): JXG.Polygon | undefined {
      const freePtIds = board.objectsList
                          .filter(elt => isFreePoint(elt))
                          .map(pt => pt.id);
      if (freePtIds && freePtIds.length > 1) {
        const change: JXGChange = {
                operation: "create",
                target: "polygon",
                parents: freePtIds,
                properties: assign({ id: uuid() }, properties)
              };
        const polygon = _applyChange(board, change);
        return polygon ? polygon as any as JXG.Polygon : undefined;
      }
    }

    function addVertexAngle(board: JXG.Board,
                            parents: JXGParentType[],
                            properties?: JXGProperties): JXG.Angle | undefined {
      const change: JXGChange = {
              operation: "create",
              target: "vertexAngle",
              parents,
              properties: assign({ id: uuid(), radius: 1 }, properties)
            };
      const angle = _applyChange(board, change);
      return angle ? angle as any as JXG.Angle : undefined;
    }

    function addTableLink(board: JXG.Board, tableId: string, dataSet: IDataSet, links: ILinkProperties) {
      const xAttr = dataSet.attributes.length >= 1 ? dataSet.attributes[0] : undefined;
      const yAttr = dataSet.attributes.length >= 2 ? dataSet.attributes[1] : undefined;
      const axes = {
                    x: xAttr ? xAttr.name : undefined,
                    y: yAttr ? yAttr.name : undefined
                  };
      const labelAttr = dataSet.attrFromName(kLabelAttrName);
      const caseCount = dataSet.cases.length;
      const ids: string[] = [];
      const points: Array<{ label?: string, coords: JXGCoordPair }> = [];
      for (let i = 0; i < caseCount; ++i) {
        const id = dataSet.cases[i].__id__;
        const label = labelAttr ? String(dataSet.getValue(id, labelAttr.id)) : undefined;
        const x = xAttr ? Number(dataSet.getValue(id, xAttr.id)) : undefined;
        const y = yAttr ? Number(dataSet.getValue(id, yAttr.id)) : undefined;
        if (id && (x != null) && isFinite(x) && (y != null) && isFinite(y)) {
          ids.push(id);
          points.push({ label, coords: [x, y] });
        }
      }
      self.metadata.addTableLink(tableId, axes);
      const change: JXGChange = {
              operation: "create",
              target: "tableLink",
              targetID: tableId,
              properties: { ids, points },
              links
            };
      const pts = _applyChange(board, change);
      return (pts || []) as JXG.Point[];
    }

    function removeTableLink(board: JXG.Board | undefined, tableId: string, links?: ILinkProperties) {
      self.metadata.removeTableLink(tableId);
      const change: JXGChange = {
              operation: "delete",
              target: "tableLink",
              targetID: tableId,
              links
            };
      return _applyChange(board, change);
    }

    function updateAxisLabels(board: JXG.Board | undefined, tableId: string, links?: ILinkProperties) {
      const change: JXGChange = {
              operation: "update",
              target: "tableLink",
              targetID: tableId,
              properties: { axisLabels: true },
              links
            };
      return _applyChange(board, change);
    }

    function findObjects(board: JXG.Board, test: (obj: JXG.GeometryElement) => boolean): JXG.GeometryElement[] {
      return board.objectsList.filter(test);
    }

    function isCopyableChild(child: JXG.GeometryElement) {
      switch (child && child.elType) {
        case "angle":
          return isVertexAngle(child);
        case "polygon":
          return true;
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
      const comments = self.selectedObjects(board).filter(el => isComment(el));
      return comments.length === 1 ? comments[0] as JXG.Text : undefined;
    }

    function getOneSelectedPolygon(board: JXG.Board) {
      // all vertices of polygon must be selected to show rotate handle
      const polygonSelection: { [id: string]: { any: boolean, all: boolean } } = {};
      const polygons = board.objectsList
                            .filter(el => el.elType === "polygon")
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
                                ? polygons[0] as JXG.Polygon : undefined;
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

    function gatherObjectProperties(selectedIds: string[]) {
      const properties: { [id: string]: any } = {};
      selectedIds.forEach(id => { properties[id] = {}; });

      self.changes.forEach(chg => {
        const parsedChange: JXGChange = safeJsonParse(chg);
        forEachNormalizedChange(parsedChange, change => {
          const id = change.targetID as string;
          if (id && properties[id]) {
            assign(properties[id], omit(change.properties, ["position"]));
          }
        });
      });
      return properties;
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

      const selectedSegments = selectedObjects.filter(isVisibleEdge) as JXG.Line[];
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
      const properties = gatherObjectProperties(selectedIds);

      // sort into creation order
      const idToIndexMap: { [id: string]: number } = {};
      board.objectsList.forEach((obj, index) => {
        idToIndexMap[obj.id] = index;
      });
      selectedIds.sort((a, b) => idToIndexMap[a] - idToIndexMap[b]);

      // map old ids to new ones
      const newIds: { [oldId: string]: string } = {};
      selectedIds.forEach(id => {
        newIds[id] = uuid();
      });

      // create change objects for each object to be copied
      const changes: string[] = [];
      selectedIds.forEach(id => {
        const obj = board.objects[id];
        const props = properties[id];
        if (obj) {
          // make any final adjustments to properties
          if (isLinkedPoint(obj)) {
            // copies of linked points should snap
            assign(props, { snapToGrid: true, snapSizeX: kSnapUnit, snapSizeY: kSnapUnit });
          }
          const change: JXGChange = {
                  operation: "create",
                  properties: { ...props, id: newIds[id], name: obj.name }
                } as any;
          switch (obj.elType) {
            case "angle":
              if (isVertexAngle(obj)) {
                const va = obj as JXG.Angle;
                // parents must be in correct order
                const parents = [va.point2, va.point1, va.point3];
                assign(change, {
                  target: "vertexAngle",
                  parents: parents.map(parent => newIds[parent.id])
                });
              }
              break;
            case "line":
              if (isMovableLine(obj)) {
                const movableLine = obj as JXG.Line;
                const [ , x1, y1] = movableLine.point1.coords.usrCoords;
                const [ , x2, y2] = movableLine.point2.coords.usrCoords;
                assign(change, {
                  target: "movableLine",
                  parents: [[x1, y1], [x2, y2]]
                });
              }
              break;
            case "point":
              // don't copy movable line points independently
              if (obj.getAttribute("clientType") === "movableLine") return;
              const [ , x, y] = (obj as JXG.Point).coords.usrCoords;
              assign(change, {
                target: "point",
                parents: [x, y]
              });
              break;
            case "polygon":
              assign(change, {
                target: "polygon",
                parents: Array.from(keys(obj.ancestors))
                          .map(parentId => newIds[parentId])
              });
              break;
          }
          if (change.target) {
            changes.push(JSON.stringify(change));
          }
        }
      });
      return changes;
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

    function _applyChange(board: JXG.Board | undefined, change: JXGChange) {
      const result = board && syncChange(board, change);
      const jsonChange = JSON.stringify(change);
      if (suspendCount <= 0) {
        self.changes.push(jsonChange);
      }
      else {
        batchChanges.push(jsonChange);
      }

      let loggedChangeProps = {...change};
      if (!Array.isArray(change.properties)) {
        // flatten change.properties
        delete loggedChangeProps.properties;
        loggedChangeProps = {
          ...loggedChangeProps,
          ...change.properties
        };
      } else {
        // or clean up MST array
        loggedChangeProps.properties = Array.from(change.properties);
      }
      delete loggedChangeProps.operation;
      Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, change.operation,
        loggedChangeProps, self.metadata ? self.metadata.id : "");

      return result;
    }

    function syncChange(board: JXG.Board, change: JXGChange) {
      if (board) {
        return applyChange(board, change, handleWillApplyChange, handleDidApplyChange);
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
        getLastImageUrl(): string | undefined{
          for (let i = self.changes.length - 1; i >= 0; --i) {
            const jsonChange = self.changes[i];
            const change: JXGChange = safeJsonParse(jsonChange);
            if (change && (change.operation === "create") && (change.target === "image")) {
              return change.parents && change.parents[0] as string;
            }
            if (change && (change.operation === "update") && change.properties &&
                !Array.isArray(change.properties) && change.properties.url) {
              return change.properties.url;
            }
          }
        }
      },
      actions: {
        initializeBoard,
        destroyBoard,
        rescaleBoard,
        resizeBoard,
        updateScale,
        addChange,
        popChangeset,
        pushChangeset,
        addImage,
        addPoint,
        addPoints,
        addMovableLine,
        removeObjects,
        updateObjects,
        createPolygonFromFreePoints,
        addVertexAngle,
        addTableLink,
        removeTableLink,
        updateAxisLabels,
        findObjects,
        getOneSelectedPolygon,
        getOneSelectedComment,
        getCommentAnchor,
        deleteSelection,
        applyChange: _applyChange,
        syncChange,
        addComment,
        updateComment,

        suspendSync() {
          ++suspendCount;
        },
        resumeSync() {
          if (--suspendCount <= 0) {
            self.changes.push.apply(self.changes, batchChanges);
            batchChanges = [];
          }
        },
        updateImageUrl(oldUrl: string, newUrl: string) {
          if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
          // identify change entries to be modified
          const updates: Array<{ index: number, change: string }> = [];
          self.changes.forEach((changeJson, index) => {
            const change: JXGChange = safeJsonParse(changeJson);
            switch (change && change.operation) {
              case "create":
                if (change.parents) {
                  const createUrl = change.parents[0];
                  if ((change.target === "image") && (createUrl === oldUrl)) {
                    change.parents[0] = newUrl;
                    updates.push({ index, change: JSON.stringify(change) });
                  }
                }
                break;
              case "update":
                const updateUrl = change.properties &&
                                    !Array.isArray(change.properties) &&
                                    change.properties.url;
                if (updateUrl && (updateUrl === oldUrl)) {
                  (change.properties as JXGProperties).url = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
            }
          });
          // make the corresponding changes
          updates.forEach(update => {
            self.changes[update.index] = update.change;
          });
        }
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;

interface IBoardImportProps {
  axisMin?: JXGCoordPair;
  axisRange?: JXGCoordPair;
  [prop: string]: any;
}
interface IBoardImportSpec {
  properties?: IBoardImportProps;
}

interface IPointImportSpec {
  type: "point";
  parents: [number, number];
  properties?: any;
}

interface IVertexImportSpec extends IPointImportSpec {
  angleLabel?: boolean;
}

interface IPolygonImportSpec {
  type: "polygon";
  parents: IVertexImportSpec[];
  properties?: any;
}

interface IImageImportSpec {
  type: "image";
  parents: {
    url: string;
    coords: JXGCoordPair;
    size: JXGCoordPair;
  };
  properties?: any;
}

interface IMovableLineImportSpec {
  type: "movableLine";
  parents: [IPointImportSpec, IPointImportSpec];
  properties?: any;
}

type IObjectImportSpec = IPointImportSpec | IPolygonImportSpec | IImageImportSpec | IMovableLineImportSpec;

function preprocessImportFormat(snapshot: any) {
  const boardSpecs = snapshot.board as IBoardImportSpec;
  const objectSpecs = snapshot.objects as IObjectImportSpec[];
  if (!objectSpecs) return snapshot;

  function addBoard(boardSpec: IBoardImportSpec) {
    const { properties } = boardSpec || {} as IBoardImportSpec;
    const { axisMin, axisRange, ...others } = properties || {} as IBoardImportProps;
    const boundingBox = getBoardBounds(axisMin, axisRange);
    const [unitX, unitY] = getAxisUnits(axisRange);
    changes.push(defaultGeometryBoardChange({ unitX, unitY, boundingBox, ...others }));
  }

  const changes: JXGChange[] = [];
  addBoard(boardSpecs);

  function addPoint(pointSpec: IPointImportSpec) {
    const { type, properties: _properties, ...others } = pointSpec;
    const id = uniqueId();
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "point", properties, ...others });
    return id;
  }

  function addPolygon(polygonSpec: IPolygonImportSpec) {
    const { parents: parentSpecs, properties: _properties } = polygonSpec;
    const id = uniqueId();
    const vertices: Array<{ id: string, angleLabel?: boolean }> = [];
    const parents = parentSpecs.map(spec => {
                      const ptId = addPoint(spec);
                      vertices.push({ id: ptId, angleLabel: spec.angleLabel });
                      return ptId;
                    });
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "polygon", parents, properties });
    const lastIndex = vertices.length - 1;
    vertices.forEach((pt, i) => {
      let angleParents;
      if (pt.angleLabel) {
        const prev = i === 0 ? vertices[lastIndex].id : vertices[i - 1].id;
        const self = vertices[i].id;
        const next = i === lastIndex ? vertices[0].id : vertices[i + 1].id;
        angleParents = [prev, self, next];
      }
      changes.push({ operation: "create", target: "vertexAngle", parents: angleParents });
    });
    return id;
  }

  function addImage(imageSpec: IImageImportSpec) {
    const { type, parents: _parents, properties: _properties, ...others } = imageSpec;
    const { url, coords, size: pxSize } = _parents;
    const size = pxSize.map(s => s / kGeometryDefaultPixelsPerUnit) as JXGCoordPair;
    const parents = [url, coords, size];
    const id = uniqueId();
    const properties = { id, ..._properties };
    gImageMap.getImage(url);  // register with image map
    changes.push({ operation: "create", target: "image", parents, properties, ...others });
    return id;
  }

  function addMovableLine(movableLineSpec: IMovableLineImportSpec) {
    const { type, parents: _parents, properties: _properties, ...others } = movableLineSpec;
    const id = uniqueId();
    const [pt1Spec, pt2Spec] = _parents;
    const parents = _parents.map(ptSpec => ptSpec.parents);
    const properties = { id, pt1: pt1Spec.properties, pt2: pt2Spec.properties, ..._properties };
    changes.push({ operation: "create", target: "movableLine", parents, properties, ...others });
    return id;
  }

  objectSpecs.forEach(spec => {
    switch (spec.type) {
      case "point":
        addPoint(spec);
        break;
      case "polygon":
        addPolygon(spec);
        break;
      case "image":
        addImage(spec);
        break;
      case "movableLine":
        addMovableLine(spec);
        break;
    }
  });

  return {
    changes: changes.map(change => JSON.stringify(change))
  };
}

export function mapTileIdsInGeometrySnapshot(snapshot: SnapshotOut<GeometryContentModelType>,
                                             idMap: { [id: string]: string }) {
  snapshot.changes = snapshot.changes.map(changeJson => {
    const change: JXGChange = safeJsonParse(changeJson);
    if ((change.operation === "create") && (change.target === "tableLink")) {
      change.targetID = idMap[change.targetID as string];
    }
    if (change.links) {
      change.links.tileIds = change.links.tileIds.map(id => idMap[id]);
    }
    return JSON.stringify(change);
  });
  return snapshot;
}
