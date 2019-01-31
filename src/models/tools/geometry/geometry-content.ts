import { types, Instance } from "mobx-state-tree";
import { ILinkProperties, kLabelAttrName, TableContentModelType } from "../table/table-content";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange, JXGProperties, JXGCoordPair, JXGParentType } from "./jxg-changes";
import { isBoard, kGeometryDefaultPixelsPerUnit, kGeometryDefaultAxisMin } from "./jxg-board";
import { isFreePoint, kPointDefaults, isPoint } from "./jxg-point";
import { isVertexAngle } from "./jxg-vertex-angle";
import { IDataSet } from "../../data/data-set";
import { assign, castArray, each, keys, size as _size } from "lodash";
import * as uuid from "uuid/v4";
import { safeJsonParse } from "../../../utilities/js-utils";
import { Logger, LogEventName } from "../../../lib/logger";
import { kMovableLineType, kMovableLineDefaults, isMovableLine } from "./jxg-movable-line";
import { getTileContentById } from "../../../utilities/mst-utils";

export const kGeometryToolID = "Geometry";

export const kGeometryDefaultHeight = 320;

export type onCreateCallback = (elt: JXG.GeometryElement) => void;

export function defaultGeometryContent(overrides?: JXGProperties) {
  const xAxisMax = 30;
  const yAxisMax = kGeometryDefaultHeight / kGeometryDefaultPixelsPerUnit - kGeometryDefaultAxisMin;
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: assign({
                  axis: true,
                  boundingBox: [kGeometryDefaultAxisMin, yAxisMax, xAxisMax, kGeometryDefaultAxisMin],
                  grid: {}  // defaults to 1-unit gridlines
                }, overrides)
  };
  const changeJson = JSON.stringify(change);
  return GeometryContentModel.create({ changes: [changeJson] });
}

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const GeometryMetadataModel = types
  .model("GeometryMetadata", {
    id: types.string,
    selection: types.map(types.boolean),
    linkedTables: types.array(types.string)
  })
  .views(self => ({
    isSelected(id: string) {
      return !!self.selection.get(id);
    },
    hasSelection() {
      return Array.from(self.selection.values()).some(isSelected => isSelected);
    }
  }))
  .actions(self => ({
    select(id: string) {
      self.selection.set(id, true);
    },
    deselect(id: string) {
      self.selection.set(id, false);
    },
    addLinkedTable(tableId: string) {
      if (self.linkedTables.indexOf(tableId) < 0) {
        self.linkedTables.push(tableId);
      }
    },
    removeLinkedTable(tableId: string) {
      const index = self.linkedTables.indexOf(tableId);
      if (index >= 0) {
        self.linkedTables.splice(index, 1);
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
    element.setAttribute({
              fillColor: selected ? selectedFillColor : fillColor,
              strokeColor: selected ? selectedStrokeColor : strokeColor
            });
  }
}

export const GeometryContentModel = types
  .model("GeometryContent", {
    type: types.optional(types.literal(kGeometryToolID), kGeometryToolID),
    changes: types.array(types.string)
  })
  .volatile(self => ({
    metadata: undefined as any as GeometryMetadataModelType
  }))
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
      return self.metadata.linkedTables.indexOf(tableId) >= 0;
    },
    getTableContent(tileId: string) {
      const content = getTileContentById(self, tileId);
      return content && content as TableContentModelType;
    }
  }))
  .views(self => ({
    getDeletableSelectedIds(board: JXG.Board) {
      return self.selectedIds
                  .filter(id => {
                    const elt = board.objects[id];
                    return elt && !elt.getAttribute("fixed");
                  });
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
      self.metadata.linkedTables.forEach(tableId => {
        const tableContent = self.getTableContent(tableId);
        tableContent && tableContent.removeLinkedGeometry(self.metadata.id);
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

    let viewCount = 0;
    let suspendCount = 0;
    let batchChanges: string[] = [];

    function onChangeApplied(change: JXGChange) {
      const op = change.operation.toLowerCase();
      const target = change.target.toLowerCase();
      if (target === "tablelink") {
        const tableId = change.parents && change.parents[0] as string;
        if (tableId) {
          if (op === "create") {
            self.metadata.addLinkedTable(tableId);
          }
          else if (op === "delete") {
            self.metadata.removeLinkedTable(tableId);
          }
        }
      }
    }

    // views

    // actions
    function initializeBoard(domElementID: string, onCreate?: onCreateCallback): JXG.Board | undefined {
      const changes = self.changes.map(change => JSON.parse(change));
      let board: JXG.Board | undefined;
      applyChanges(domElementID, changes, onChangeApplied)
        .filter(result => result != null)
        .forEach(elt => {
          if (isBoard(elt)) {
            board = elt as JXG.Board;
            board.suspendUpdate();
          }
          else if (Array.isArray(elt)) {
            if (onCreate) {
              elt.forEach(el => onCreate(el as JXG.GeometryElement));
            }
          }
          else if (elt && onCreate) {
            onCreate(elt as JXG.GeometryElement);
          }
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
      const scaledWidth = width / (scale || 1);
      const scaledHeight = height / (scale || 1);
      const unitXY = kGeometryDefaultPixelsPerUnit;
      const [xMin, , , yMin] = board.attr.boundingbox;
      const newXMax = scaledWidth / unitXY + xMin;
      const newYMax = scaledHeight / unitXY + yMin;
      board.resizeContainer(scaledWidth, scaledHeight, false, true);
      board.setBoundingBox([xMin, newYMax, newXMax, yMin], true);
      board.update();
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

    function removeObjects(board: JXG.Board | undefined, id: string | string[], links?: ILinkProperties) {
      const change: JXGChange = {
        operation: "delete",
        target: "object",
        targetID: id,
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

    function addLinkedTable(board: JXG.Board, tableId: string, dataSet: IDataSet, links: ILinkProperties) {
      const xAttr = dataSet.attributes.length >= 1 ? dataSet.attributes[0] : undefined;
      const yAttr = dataSet.attributes.length >= 2 ? dataSet.attributes[1] : undefined;
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
      self.metadata.addLinkedTable(tableId);
      const change: JXGChange = {
              operation: "create",
              target: "tableLink",
              parents: [tableId],
              properties: { ids, points },
              links
            };
      const pts = _applyChange(board, change);
      return (pts || []) as JXG.Point[];
    }

    function removeLinkedTable(board: JXG.Board | undefined, tableId: string, links?: ILinkProperties) {
      self.metadata.removeLinkedTable(tableId);
      const change: JXGChange = {
              operation: "delete",
              target: "tableLink",
              parents: [tableId],
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
      const selectedIds = self.selectedIds;
      const children: { [id: string]: JXG.GeometryElement } = {};
      // identify children (e.g. polygons) that may be selected as well
      selectedIds.forEach(id => {
        const obj = board.objects[id];
        if (obj) {
          each(obj.childElements, child => {
            if (child && isCopyableChild(child)) {
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
      const newIds: { [oldId: string]: string } = {};
      selectedIds.forEach(id => {
        newIds[id] = uuid();
      });

      // create change objects for each object to be copied
      const changes: string[] = [];
      selectedIds.forEach(id => {
        const obj = board.objects[id];
        if (obj) {
          let x: number;
          let y: number;
          const change: JXGChange = {
                  operation: "create",
                  properties: { id: newIds[id], name: obj.name }
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
            case "point":
              [ , x, y] = (obj as JXG.Point).coords.usrCoords;
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
        return applyChange(board, change);
      }
    }

    return {
      views: {
        get nextViewId() {
          return ++viewCount;
        },
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
        addLinkedTable,
        removeLinkedTable,
        findObjects,
        deleteSelection,
        applyChange: _applyChange,
        syncChange,

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
