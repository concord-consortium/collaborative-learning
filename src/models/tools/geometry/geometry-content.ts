import { assign, castArray, each, keys, omit, size as _size } from "lodash";
import { types, Instance, SnapshotOut, IAnyStateTreeNode } from "mobx-state-tree";
import { Lambda } from "mobx";
import { Optional } from "utility-types";
import { SelectionStoreModelType } from "../../stores/selection";
import { addLinkedTable, removeLinkedTable } from "../table-links";
import { ITileExportOptions, registerToolContentInfo } from "../tool-content-info";
import {
  getRowLabelFromLinkProps, IColumnProperties, ICreateRowsProperties, IRowProperties,
  ITableChange, ITableLinkProperties
} from "../table/table-change";
import { getAxisLabelsFromDataSet, getTableContent, kLabelAttrName } from "../table/table-content";
import { canonicalizeValue, linkedPointId } from "../table/table-model-types";
import { exportGeometryJson } from "./geometry-export";
import { defaultGeometryBoardChange, preprocessImportFormat } from "./geometry-import";
import { getAxisAnnotations, getBaseAxisLabels, getObjectById, guessUserDesiredBoundingBox,
          kAxisBuffer, syncAxisLabels } from "./jxg-board";
import { ESegmentLabelOption, forEachNormalizedChange, ILinkProperties, JXGChange, JXGCoordPair,
          JXGProperties, JXGParentType, JXGUnsafeCoordPair } from "./jxg-changes";
import { applyChange, applyChanges, IDispatcherChangeContext } from "./jxg-dispatcher";
import {  kPointDefaults, kSnapUnit } from "./jxg-point";
import { prepareToDeleteObjects } from "./jxg-polygon";
import { getTableIdFromLinkChange } from "./jxg-table-link";
import {
  isAxisArray, isBoard, isComment, isFreePoint, isImage, isLinkedPoint, isMovableLine, isPoint, isPointArray,
  isPolygon, isVertexAngle, isVisibleEdge, kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, toObj
} from "./jxg-types";
import { IDataSet } from "../../data/data-set";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { getTileContentById } from "../../../utilities/mst-utils";
import { Logger, LogEventName } from "../../../lib/logger";

export const kGeometryToolID = "Geometry";

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

export function defaultGeometryContent(overrides?: JXGProperties): GeometryContentModelType {
  const { title, ...boardProps } = overrides || {};
  const changes: string[] = [];
  if (title) {
    const titleChange: JXGChange = { operation: "update", target: "metadata", properties: { title } };
    changes.push(JSON.stringify(titleChange));
  }
  const boardChange = defaultGeometryBoardChange(boardProps);
  changes.push(JSON.stringify(boardChange));
  return GeometryContentModel.create({ changes });
}

export function getGeometryContent(target: IAnyStateTreeNode, tileId: string): GeometryContentModelType | undefined {
  const content = getTileContentById(target, tileId);
  return content && content as GeometryContentModelType;
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
    title: types.maybe(types.string),
    disabled: types.array(types.string),
    selection: types.map(types.boolean),
    linkedTables: types.array(LinkedTableEntryModel)
  })
  .volatile(self => ({
    sharedSelection: undefined as any as SelectionStoreModelType,
    tableLinkDisposers: {} as { [id: string]: Lambda }
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
    },
    isLinkedToTable(tableId: string) {
      return self.linkedTables.findIndex(entry => entry.id === tableId) >= 0;
    },
    get linkedTableCount() {
      return self.linkedTables.length;
    },
    get linkedTableIds() {
      return self.linkedTables.map(t => t.id);
    },
    xAxisLabel(baseName = "x", annotation = "") {
      const links = self.linkedTables
                        .map(entry => entry.x)
                        .filter(name => name && (name !== "x") && (name !== baseName));
      annotation && links.unshift(annotation);
      return links.length ? `${baseName} (${links.join(", ")})` : baseName;
    },
    yAxisLabel(baseName = "y", annotation = "") {
      const links = self.linkedTables
                        .map(entry => entry.y)
                        .filter(name => name && (name !== "y") && (name !== baseName));
      annotation && links.unshift(annotation);
      return links.length ? `${baseName} (${links.join(", ")})` : baseName;
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      self.title = title;
    },
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
  }))
  .actions(self => ({
    addTableLink(tableId: string, axes: IAxisLabels) {
      if (self.linkedTables.findIndex(entry => entry.id === tableId) < 0) {
        const disposer = self.sharedSelection.observe(tableId, change => {
          const id = change.name;
          self.setSelection(id, self.sharedSelection.isSelected(tableId, id));
        });
        disposer && (self.tableLinkDisposers[tableId] = disposer);
        self.linkedTables.push({ id: tableId, ...axes });
      }
      addLinkedTable(tableId);
    },
    removeTableLink(tableId: string) {
      const index = self.linkedTables.findIndex(entry => entry.id === tableId);
      if (index >= 0) {
        delete self.tableLinkDisposers[tableId];
        self.linkedTables.splice(index, 1);
      }
      removeLinkedTable(tableId);
    },
    setTableLinkNames(tableId: string, x: string | undefined, y: string | undefined) {
      const found = self.linkedTables.find(entry => entry.id === tableId);
      if (found) {
        if (x != null) found.x = x;
        if (y != null) found.y = y;
      }
    },
    clearLinkedTables() {
      each(self.tableLinkDisposers, disposer => disposer());
      self.tableLinkDisposers = {};
      self.linkedTables.clear();
    }
  }));
export type GeometryMetadataModelType = Instance<typeof GeometryMetadataModel>;

export function setElementColor(board: JXG.Board, id: string, selected: boolean) {
  const element = getObjectById(board, id);
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
    get title() {
      return self.metadata.title;
    },
    isSelected(id: string) {
      return self.metadata.isSelected(id);
    },
    hasSelection() {
      return self.metadata.hasSelection();
    },
    get isLinked() {
      return self.metadata.linkedTables.length > 0;
    },
    isLinkedToTable(tableId: string) {
      return self.metadata.isLinkedToTable(tableId);
    }
  }))
  .views(self => ({
    getSelectedIds(board: JXG.Board) {
      // returns the ids in creation order
      return board.objectsList
                  .filter(obj => self.isSelected(obj.id))
                  .map(obj => obj.id);
    },
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
      const lastChangeParsed = safeJsonParse<JXGChange>(lastChange);
      if (!lastChangeParsed || !isUndoableChange(lastChangeParsed)) return false;
      const lastChangeLinks = lastChangeParsed.links;
      if (!lastChangeLinks) return true;
      const linkedTiles = lastChangeLinks.tileIds;
      const linkedTile = linkedTiles?.[0];
      const tableContent = linkedTile ? getTableContent(self, linkedTile) : undefined;
      return tableContent ? tableContent.canUndoLinkedChange(/*lastChangeParsed*/) : false;
    },
    canUndoLinkedChange(change: ITableChange) {
      const hasUndoableChanges = self.changes.length > 1;
      if (!hasUndoableChanges) return false;
      const lastChange = hasUndoableChanges ? self.changes[self.changes.length - 1] : undefined;
      const lastChangeParsed = safeJsonParse<JXGChange>(lastChange);
      const lastChangeLinks = lastChangeParsed?.links;
      if (!lastChangeLinks) return false;
      const geometryActionLinkId = lastChangeLinks.id;
      const tableActionLinkId = change.links?.id;
      return geometryActionLinkId && tableActionLinkId && (geometryActionLinkId === tableActionLinkId);
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
      return exportGeometryJson(self.changes, options);
    }
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
  .actions(self => ({
    doPostCreate(metadata: GeometryMetadataModelType) {
      self.metadata = metadata;
    },
    willRemoveFromDocument() {
      self.metadata.linkedTables.forEach(({ id: tableId }) => {
        const tableContent = getTableContent(self, tableId);
        tableContent && tableContent.removeGeometryLink(self.metadata.id);
      });
      self.metadata.clearLinkedTables();
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
      const op = change.operation.toLowerCase();
      const target = change.target.toLowerCase();

      if ((op === "update") && (target === "metadata")) {
        const props = change?.properties as JXGProperties | undefined;
        if (props?.title) {
          self.metadata.setTitle(props.title);
        }
      }

      const tableId = getTableIdFromLinkChange(change);
      if (tableId) {
        const links = change.links as ITableLinkProperties;
        const xLabel = links?.labels?.find(entry => entry.id === "xAxis")?.label;
        const yLabel = links?.labels?.find(entry => entry.id === "yAxis")?.label;
        if (op === "create") {
          const tableContent = getTableContent(self, tableId);
          if (tableContent) {
            const axes: IAxisLabels = { x: xLabel, y: yLabel };
            self.metadata.addTableLink(tableId, axes);
          }
          else {
            return false; // table is no longer present; ignore the change
          }
        }
        else if (op === "delete") {
          self.metadata.removeTableLink(tableId);
        }
        else if (op === "update") {
          if (xLabel || yLabel) {
            self.metadata.setTableLinkNames(tableId, xLabel, yLabel);
          }
        }
      }
    }

    function getLinkedTableChange(change: JXGChange) {
      const links = change.links as ITableLinkProperties | undefined;
      const linkId = links?.id;
      const tableId = links?.tileIds[0];
      const tableContent = tableId ? getTableContent(self, tableId) : undefined;
      return linkId ? tableContent?.getLinkedChange(linkId) : undefined;
    }

    function handleDidApplyChange(board: JXG.Board | undefined, change: JXGChange) {
      const { operation } = change;
      const target = change.target.toLowerCase();
      if (board && (target === "tablelink" || (target === "board" && operation !== "delete"))) {
        const [xName, yName] = getBaseAxisLabels(board);
        const [xAnnotation, yAnnotation] = getAxisAnnotations(board);
        syncAxisLabels(board,
                        self.metadata.xAxisLabel(xName, xAnnotation),
                        self.metadata.yAxisLabel(yName, yAnnotation));
      }
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
      const changes = self.changes.map(change => JSON.parse(change));
      let board: JXG.Board | undefined;
      applyChanges(domElementID, changes, getDispatcherContext())
        .filter(result => result != null)
        .forEach(changeResult => {
          const changeElems = castArray(changeResult);
          changeElems.forEach(changeElem => {
            if (isBoard(changeElem)) {
              board = changeElem;
              board.suspendUpdate();
            }
            else if (onCreate) {
              onCreate(changeElem);
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

    function rescaleBoard(board: JXG.Board, params: IAxesParams) {
      const { canvasWidth, canvasHeight } = board;
      const { xName, xAnnotation, xMin, xMax, yName, yAnnotation, yMin, yMax } = params;
      const width = canvasWidth - kAxisBuffer * 2;
      const height = canvasHeight - kAxisBuffer * 2;
      const unitX = width / (xMax - xMin);
      const unitY = height / (yMax - yMin);
      const change: JXGChange = {
        operation: "update",
        target: "board",
        targetID: board.id,
        properties: { boardScale: {
                        xMin, yMin, unitX, unitY,
                        ...toObj("xName", xName), ...toObj("yName", yName),
                        ...toObj("xAnnotation", xAnnotation), ...toObj("yAnnotation", yAnnotation),
                        canvasWidth: width, canvasHeight: height
                      } }
      };
      const axes = _applyChange(undefined, change);
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

          let change = safeJsonParse<JXGChange>(changeStr);
          if (change?.endBatch) {
            while (change && !change.startBatch) {
              changeStr = self.changes.pop();
              if (changeStr) {
                changes.unshift(changeStr);
              }
              change = safeJsonParse<JXGChange>(changeStr);
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
        properties: assign({ id: uniqueId() }, properties)
      };
      const image = _applyChange(board, change);
      return isImage(image) ? image : undefined;
    }

    function addPoint(board: JXG.Board | undefined,
                      parents: JXGCoordPair,
                      properties?: JXGProperties): JXG.Point | undefined {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: assign({ id: uniqueId() }, properties)
      };
      const point = _applyChange(board, change);
      return isPoint(point) ? point : undefined;
    }

    function addPoints(board: JXG.Board | undefined,
                       parents: JXGUnsafeCoordPair[],
                       properties?: JXGProperties | JXGProperties[],
                       links?: ILinkProperties): JXG.Point[] {
      const props = castArray(properties);
      const change: JXGChange = {
        operation: "create",
        target: links ? "linkedPoint" : "point",
        parents,
        properties: parents.map((p, i) => ({ id: uniqueId(), ...(props && props[i] || props[0]) })),
        links
      };
      const points = _applyChange(board, change);
      return isPointArray(points) ? points : [];
    }

    function addMovableLine(board: JXG.Board, parents: any, properties?: JXGProperties) {
      const change: JXGChange = {
        operation: "create",
        target: "movableLine",
        parents,
        properties: {id: uniqueId(), ...properties}
      };
      const elems = _applyChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
    }

    function addComment(board: JXG.Board, anchorId: string) {
      const change: JXGChange = {
        operation: "create",
        target: "comment",
        properties: {id: uniqueId(), anchor: anchorId }
      };
      const elems = _applyChange(board, change);
      return elems ? elems as JXG.GeometryElement[] : undefined;
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

    function updateTitle(board: JXG.Board | undefined, title: string) {
      const change: JXGChange = {
              operation: "update",
              target: "metadata",
              properties: { title }
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

    function createPolygonFromFreePoints(
              board: JXG.Board, linkedTableId?: string, linkedColumnId?: string, properties?: JXGProperties
            ): JXG.Polygon | undefined {
      const freePtIds = board.objectsList
                          .filter(elt => isFreePoint(elt) &&
                                          (linkedTableId === elt.getAttribute("linkedTableId")) &&
                                          (linkedColumnId === elt.getAttribute("linkedColId")))
                          .map(pt => pt.id);
      if (freePtIds && freePtIds.length > 1) {
        const change: JXGChange = {
                operation: "create",
                target: "polygon",
                parents: freePtIds,
                properties: assign({ id: uniqueId() }, properties)
              };
        const polygon = _applyChange(board, change);
        return isPolygon(polygon) ? polygon : undefined;
      }
    }

    function addVertexAngle(board: JXG.Board,
                            parents: JXGParentType[],
                            properties?: JXGProperties): JXG.Angle | undefined {
      const change: JXGChange = {
              operation: "create",
              target: "vertexAngle",
              parents,
              properties: assign({ id: uniqueId(), radius: 1 }, properties)
            };
      const angle = _applyChange(board, change);
      return isVertexAngle(angle) ? angle : undefined;
    }

    function addTableLink(
              board: JXG.Board | undefined, tableId: string, dataSet: IDataSet, links: ITableLinkProperties) {
      const axes = {
                    x: links.labels?.find(entry => entry.id === "xAxis")?.label,
                    y: links.labels?.find(entry => entry.id === "yAxis")?.label
                  };
      if (!axes.x || !axes.y) {
        const [xAxisLabel, yAxisLabel] = getAxisLabelsFromDataSet(dataSet);
        !axes.x && xAxisLabel && (axes.x = xAxisLabel);
        !axes.y && yAxisLabel && (axes.y = yAxisLabel);
      }

      // takes labels from dataSet (added by TableContent.getSharedData) if not in links.labels
      const xAttr = dataSet.attributes.length >= 1 ? dataSet.attributes[0] : undefined;
      const labelAttr = dataSet.attrFromName(kLabelAttrName);
      const caseCount = dataSet.cases.length;
      const ids: string[] = [];
      const points: Array<{ label?: string, coords: JXGUnsafeCoordPair }> = [];
      for (let i = 0; i < caseCount; ++i) {
        const caseId = dataSet.cases[i].__id__;
        const labelFromLinks = getRowLabelFromLinkProps(links, caseId);
        const label = labelFromLinks ||
                        (labelAttr ? String(dataSet.getValue(caseId, labelAttr.id)) : undefined);
        const x = xAttr ? Number(dataSet.getValue(caseId, xAttr.id)) : undefined;
        for (let attrIndex = 1; attrIndex < dataSet.attributes.length; ++attrIndex) {
          const yAttr = dataSet.attributes[attrIndex];
          if (caseId && yAttr) {
            const y = yAttr ? Number(dataSet.getValue(caseId, yAttr.id)) : undefined;
            ids.push(`${caseId}:${yAttr.id}`);
            points.push({ label, coords: [x, y] });
          }
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

    function updatePolygonSegmentLabel(board: JXG.Board | undefined, polygon: JXG.Polygon,
                                       points: [JXG.Point, JXG.Point], labelOption: ESegmentLabelOption) {
      const parentIds = points.map(obj => obj.id);
      const change: JXGChange = {
              operation: "update",
              target: "polygon",
              targetID: polygon.id,
              parents: parentIds,
              properties: { labelOption }
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

    function gatherObjectProperties(selectedIds: string[]) {
      const properties: { [id: string]: any } = {};
      selectedIds.forEach(id => { properties[id] = {}; });

      self.changes.forEach(chg => {
        const parsedChange = safeJsonParse<JXGChange>(chg);
        if (parsedChange) {
          forEachNormalizedChange(parsedChange, change => {
            const id = change.targetID;
            if (id && properties[id]) {
              assign(properties[id], omit(change.properties, ["position"]));
            }
          });
        }
      });
      return properties;
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
        newIds[id] = uniqueId();
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
                const va = obj;
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
                const movableLine = obj;
                const [ , x1, y1] = movableLine.point1.coords.usrCoords;
                const [ , x2, y2] = movableLine.point2.coords.usrCoords;
                assign(change, {
                  target: "movableLine",
                  parents: [[x1, y1], [x2, y2]]
                });
              }
              break;
            case "point": {
              // don't copy movable line points independently
              if (obj.getAttribute("clientType") === "movableLine") return;
              const [ , x, y] = (obj as JXG.Point).coords.usrCoords;
              assign(change, {
                target: "point",
                parents: [x, y]
              });
              break;
            }
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

      let loggedChangeProps: Optional<JXGChange, "operation"> = {...change};
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
        getLinkedTableChange,
        copySelection,
        findObjects,
        getOneSelectedPoint,
        getOneSelectedPolygon,
        getOneSelectedSegment,
        getOneSelectedComment,
        getCommentAnchor,
        getLastImageUrl(): string[] | undefined {
          for (let i = self.changes.length - 1; i >= 0; --i) {
            const jsonChange = self.changes[i];
            const change = safeJsonParse<JXGChange>(jsonChange);
            const [imageUrl, filename] = getImageUrl(change) || [];
            if (imageUrl) {
              return [imageUrl, filename];
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
        updateTitle,
        updateObjects,
        createPolygonFromFreePoints,
        addVertexAngle,
        addTableLink,
        removeTableLink,
        updateAxisLabels,
        updatePolygonSegmentLabel,
        deleteSelection,
        applyChange: _applyChange,
        syncChange,
        addComment,

        suspendSync() {
          ++suspendCount;
        },
        resumeSync() {
          if (--suspendCount <= 0) {
            self.changes.push(...batchChanges);
            batchChanges = [];
          }
        },
        updateImageUrl(oldUrl: string, newUrl: string) {
          if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
          // identify change entries to be modified
          const updates: Array<{ index: number, change: string }> = [];
          self.changes.forEach((changeJson, index) => {
            const change = safeJsonParse<JXGChange>(changeJson);
            switch (change?.operation) {
              case "create":
                if (change.parents) {
                  const createUrl = change.parents[0];
                  if ((change.target === "image") && (createUrl === oldUrl)) {
                    change.parents[0] = newUrl;
                    updates.push({ index, change: JSON.stringify(change) });
                  }
                }
                break;
              case "update": {
                const updateUrl = change.properties &&
                                    !Array.isArray(change.properties) &&
                                    change.properties.url;
                if (updateUrl && (updateUrl === oldUrl)) {
                  (change.properties as JXGProperties).url = newUrl;
                  updates.push({ index, change: JSON.stringify(change) });
                }
                break;
              }
            }
          });
          // make the corresponding changes
          updates.forEach(update => {
            self.changes[update.index] = update.change;
          });
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
    syncColumnsChange(dataSet: IDataSet, change: ITableChange, links: ITableLinkProperties) {
      const tableId = links.tileIds[0];
      let shouldUpdateAxisLabels = false;
      switch (change.action) {
        case "create": {
          // new column => new point for each case
          const attrIds = castArray(change.ids);
          const [pointIds, positions] = self.getPointPositionsForColumns(dataSet, attrIds);
          const props = pointIds.map(id => ({ id }));
          pointIds && pointIds.length && self.addPoints(undefined, positions, props, links);
          shouldUpdateAxisLabels = true;
          break;
        }
        case "update": {
          const ids = castArray(change.ids);
          const attrIdsWithExpr: string[] = [];
          const changeProps: IColumnProperties[] = castArray(change.props as any);
          ids.forEach((attrId, index) => {
            const props = changeProps[index] || changeProps[0];
            // update column name => update axis labels
            if (props.name != null) {
              shouldUpdateAxisLabels = true;
            }
            // update column expression => update points associated with column
            if (props.expression != null) {
              attrIdsWithExpr.push(attrId);
            }
          });
          if (attrIdsWithExpr.length) {
            const [pointIds, positions] = self.getPointPositionsForColumns(dataSet, attrIdsWithExpr);
            const props = positions.map(position => ({ position }));
            pointIds && pointIds.length && self.updateObjects(undefined, pointIds, props, links);
          }
          break;
        }
        case "delete": {
          // delete column => remove points associated with column
          const pointIds: string[] = [];
          const ids = castArray(change.ids);
          ids.forEach(attrId => {
            dataSet.cases.forEach(aCase => {
              const caseId = aCase.__id__;
              pointIds.push(linkedPointId(caseId, attrId));
            });
            shouldUpdateAxisLabels = true;
          });
          pointIds && pointIds.length && self.removeObjects(undefined, pointIds, links);
          break;
        }
      }
      shouldUpdateAxisLabels && self.updateAxisLabels(undefined, tableId, links);
    },
    syncRowsChange(dataSet: IDataSet, change: ITableChange, links: ITableLinkProperties) {
      switch (change.action) {
        case "create": {
          // new table row => new points for each attribute in row
          const [pointIds, positions] = self.getPointPositionsForRowsChange(dataSet, change);
          const props = pointIds.map(id => ({ id }));
          pointIds && pointIds.length && self.addPoints(undefined, positions, props, links);
          break;
        }
        case "update": {
          // update table row => update points associated with row
          const [pointIds, positions] = self.getPointPositionsForRowsChange(dataSet, change);
          const props = positions.map(position => ({ position }));
          pointIds && pointIds.length && self.updateObjects(undefined, pointIds, props, links);
          break;
        }
        case "delete": {
          // delete table row => remove points associated with row
          const pointIds: string[] = [];
          const caseIds = castArray(change.ids);
          caseIds.forEach(caseId => {
            for (let attrIndex = 1; attrIndex < dataSet.attributes.length; ++attrIndex) {
              pointIds.push(linkedPointId(caseId, dataSet.attributes[attrIndex].id));
            }
          });
          change.ids && self.removeObjects(undefined, pointIds, links);
          break;
        }
      }
    },
    syncTableLinkChange(dataSet: IDataSet, change: ITableChange, links: ITableLinkProperties) {
      const tableId = links.tileIds[0];
      switch (change.action) {
        case "create":
          self.addTableLink(undefined, tableId, dataSet, links);
          break;
        case "delete":
          self.removeTableLink(undefined, tableId, links);
          break;
      }
    }
  }))
  .actions(self => ({
    syncLinkedChange(dataSet: IDataSet, change: ITableChange, links: ITableLinkProperties) {
      switch (change.target) {
        case "columns":
          self.syncColumnsChange(dataSet, change, links);
          break;
        case "rows":
          self.syncRowsChange(dataSet, change, links);
          break;
        case "geometryLink":
          self.syncTableLinkChange(dataSet, change, links);
          break;
      }
    }
  }));

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;

export function mapTileIdsInGeometrySnapshot(snapshot: SnapshotOut<GeometryContentModelType>,
                                             idMap: { [id: string]: string }) {
  snapshot.changes = snapshot.changes.map((changeJson: any) => {
    const change = safeJsonParse<JXGChange>(changeJson);
    if ((change?.target === "tableLink") && change.targetID) {
      change.targetID = Array.isArray(change.targetID)
                          ? change.targetID.map(id => idMap[id])
                          : idMap[change.targetID];
    }
    if (change?.links) {
      change.links.tileIds = change.links.tileIds.map(id => idMap[id]);
    }
    return JSON.stringify(change);
  });
  return snapshot;
}

export function getImageUrl(change?: JXGChange): string[] | undefined {
  if (!change) return;

  if (change.operation === "create" && change.target === "image" && change.parents) {
    return [change.parents[0] as string, (change.properties as JXGProperties)?.filename];
  } else if (change.operation === "update" && change.properties &&
              !Array.isArray(change.properties) && change.properties.url) {
    return [change.properties.url, change.properties.filename];
  }
}

registerToolContentInfo({
  id: kGeometryToolID,
  tool: "geometry",
  titleBase: "Graph",
  modelClass: GeometryContentModel,
  metadataClass: GeometryMetadataModel,
  addSidecarNotes: true,
  defaultHeight: kGeometryDefaultHeight,
  exportNonDefaultHeight: true,
  defaultContent: defaultGeometryContent,
  snapshotPostProcessor: mapTileIdsInGeometrySnapshot
});
