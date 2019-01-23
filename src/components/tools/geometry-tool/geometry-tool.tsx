import * as React from "react";
import { Button, Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import { renderUnicodeCharAsIconElement } from "../../utilities/blueprint";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { GeometryContentModelType, setElementColor } from "../../../models/tools/geometry/geometry-content";
import { copyCoords, getEventCoords, getAllObjectsUnderMouse, getClickableObjectUnderMouse,
          isDragTargetOrAncestor } from "../../../models/tools/geometry/geometry-utils";
import { RotatePolygonIcon } from "./rotate-polygon-icon";
import { kGeometryDefaultPixelsPerUnit } from "../../../models/tools/geometry/jxg-board";
import { isPoint, isFreePoint, isVisiblePoint, kSnapUnit } from "../../../models/tools/geometry/jxg-point";
import { getPointsForVertexAngle, getPolygonEdges, isPolygon, isVisibleEdge
        } from "../../../models/tools/geometry/jxg-polygon";
import { canSupportVertexAngle, getVertexAngle, isVertexAngle, updateVertexAngle, updateVertexAnglesFromObjects
        } from "../../../models/tools/geometry/jxg-vertex-angle";
import { JXGChange } from "../../../models/tools/geometry/jxg-changes";
import { extractDragTileType, kDragTileContent, IToolApiInterface } from "../tool-tile";
import { ImageMapEntryType, gImageMap } from "../../../models/image-map";
import { getUrlFromImageContent } from "../../../utilities/image-utils";
import { safeJsonParse } from "../../../utilities/js-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { HotKeys } from "../../../utilities/hot-keys";
import { assign, castArray, debounce, each, filter, find, keys, size as _size } from "lodash";
import { SizeMe } from "react-sizeme";
import * as uuid from "uuid/v4";
import { GeometryToolbarView } from "./geometry-toolbar";
const placeholderImage = require("../../../assets/image_placeholder.png");

import "./geometry-tool.sass";

interface SizeMeProps {
  size?: {
    width: number | null;
    height: number | null;
  };
}

interface IProps extends SizeMeProps {
  context: string;
  scale?: number;
  tabIndex?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
  toolApiInterface?: IToolApiInterface;
  onSetCanAcceptDrop: (tileId?: string) => void;
}

interface IState extends SizeMeProps {
  elementId?: string;
  scale?: number;
  board?: JXG.Board;
  content?: GeometryContentModelType;
  newElements?: JXG.GeometryElement[];
  isLoading?: boolean;
  imageContentUrl?: string;
  imageEntry?: ImageMapEntryType;
  syncedChanges: number;
  disableRotate: boolean;
  redoStack: string[][];
}

interface JXGPtrEvent {
  evt: any;
  coords: JXG.Coords;
}

function syncBoardChanges(board: JXG.Board, content: GeometryContentModelType,
                          prevSyncedChanges?: number, readOnly?: boolean) {
  const newElements: JXG.GeometryElement[] = [];
  const changedElements: JXG.GeometryElement[] = [];
  const syncedChanges = content.changes.length;
  board.suspendUpdate();
  for (let i = prevSyncedChanges || 0; i < syncedChanges; ++i) {
    try {
      const change: JXGChange = JSON.parse(content.changes[i]);
      const result = content.syncChange(board, change);
      if (result instanceof JXG.GeometryElement) {
        newElements.push(result);
      }
      if (change.operation === "update") {
        const ids = castArray(change.targetID);
        const targets = ids.map(id => board.objects[id]);
        changedElements.push(...targets);
      }
    }
    catch (e) {
      // ignore exceptions
    }
  }

  // update vertex angles affected by changed points
  updateVertexAnglesFromObjects(changedElements);
  board.unsuspendUpdate();

  return { newElements: newElements.length ? newElements : undefined, syncedChanges };
}
​
@inject("stores")
@observer
class GeometryToolComponentImpl extends BaseComponent<IProps, IState> {

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    const { context, model: { id, content }, scale } = nextProps;
    if (!prevState.elementId) {
      // elide uuid for readability/debugging
      const debugId = `${id.slice(0, 4)}_${id.slice(id.length - 4)}`;
      const viewId = (content as GeometryContentModelType).nextViewId;
      return { content, elementId: `${context}-${debugId}-${viewId}` };
    }

    if (!prevState.board) { return null; }

    const nextState: IState = {} as any;

    const { readOnly, size } = nextProps;
    const geometryContent = content as GeometryContentModelType;
    if (size && size.width && size.height && (!prevState.size ||
        ((size.width !== prevState.size.width) || (size.height !== prevState.size.height)))) {
      geometryContent.resizeBoard(prevState.board, size.width, size.height, scale);
      nextState.size = size;
    }

    if (scale && (scale !== prevState.scale)) {
      // let JSXGraph know about the scale change
      geometryContent.updateScale(prevState.board, scale);
      nextState.scale = scale;
    }

    if (content !== prevState.content) {
      if (geometryContent.changes.length !== prevState.syncedChanges) {
        // synchronize background image changes
        let lastUrl;
        for (let i = prevState.syncedChanges; i < geometryContent.changes.length; ++i) {
          const jsonChange = geometryContent.changes[i];
          const change = jsonChange && safeJsonParse(jsonChange);
          const url = change && change.properties &&
                        !Array.isArray(change.properties) &&
                        change.properties.url;
          if (url) lastUrl = url;
        }
        if (lastUrl) {
          // signal update to be triggered in componentDidUpdate
          nextState.imageContentUrl = lastUrl;
        }
        // If the incoming list of changes is shorter, an undo has occurred.
        // In this case, clear the board and replay it.
        if (prevState.syncedChanges > geometryContent.changes.length) {
          const board = prevState.board;
          board.suspendUpdate();
          for (let i = board.objectsList.length - 1; i > 17; i--) {
            board.removeObject(board.objectsList[i]);
          }
          board.unsuspendUpdate();
        }
        const syncedChanges = prevState.syncedChanges > geometryContent.changes.length
                                ? 1
                                : prevState.syncedChanges;
        assign(nextState, syncBoardChanges(prevState.board, geometryContent, syncedChanges, readOnly));
      } else {
        nextState.redoStack = [];
      }
      nextState.content = geometryContent;
    }
    return nextState;
  }

  public state: IState = {
          syncedChanges: 0,
          disableRotate: false,
          redoStack: []
        };

  private domElement: HTMLDivElement | null;
  private _isMounted: boolean;

  private disposeSelectionObserver: any;

  private hotKeys: HotKeys = new HotKeys();

  private lastBoardDown: JXGPtrEvent;
  private lastPointDown?: JXGPtrEvent;
  private lastSelectDown?: any;
  private dragPts: { [id: string]: { initial: JXG.Coords, final?: JXG.Coords, snapToGrid?: boolean }} = {};
  private isVertexDrag: boolean;

  private lastPasteId: string;
  private lastPasteCount: number;

  private debouncedUpdateImage = debounce((url: string) => {
            gImageMap.getImage(url)
              .then(image => {
                if (!this._isMounted) return;
                // update JSXGraph state
                const { board } = this.state;
                if (board) {
                  const bgImage = this.getBackgroundImage(this.state.board);
                  if (bgImage) {
                    bgImage.url = image.displayUrl || placeholderImage;
                    board.update();
                  }
                }
                // update react state
                this.setState({
                  isLoading: false,
                  imageContentUrl: undefined,
                  imageEntry: image
                });
                // update mst content if conversion occurred
                if (image.contentUrl && (url !== image.contentUrl)) {
                  this.getContent().updateImageUrl(url, image.contentUrl);
                }
              })
              .catch(() => {
                this.setState({
                  isLoading: false,
                  imageContentUrl: undefined,
                  imageEntry: undefined
                });
              });
          }, 100);

  public componentDidMount() {
    this._isMounted = true;

    this.initializeContent();

    if (!this.props.readOnly && this.props.toolApiInterface) {
      this.props.toolApiInterface.register(this.props.model.id, {
        hasSelection: () => {
          const geometryContent = this.props.model.content as GeometryContentModelType;
          return geometryContent.hasSelection();
        },
        deleteSelection: () => {
          const geometryContent = this.props.model.content as GeometryContentModelType;
          const { board } = this.state;
          if (board) {
            geometryContent.deleteSelection(board);
          }
        }
      });
    }

    this.initializeHotKeys();
  }

  public componentDidUpdate() {
    // if we didn't initialize before now, try again
    if (!this.state.board) {
      this.initializeContent();
    }

    const { newElements } = this.state;
    if (newElements && newElements.length) {
      newElements.forEach(elt => this.handleCreateElement(elt));
      this.setState({ newElements: undefined });
    }

    if (this.state.imageContentUrl) {
      this.updateImageUrl(this.state.imageContentUrl);
    }
  }

  public componentWillUnmount() {
    if (this.disposeSelectionObserver) {
      this.disposeSelectionObserver();
    }
    const board = this.state.board;
    if (board) {
      // delay so any asynchronous JSXGraph actions have time to complete
      setTimeout(() => {
        JXG.JSXGraph.freeBoard(board);
      });
    }

    this._isMounted = false;
  }

  public render() {
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `geometry-tool ${editableClass}`;
    return ([
      this.renderToolbar(),
      <div id={this.state.elementId} key="jsxgraph"
          className={classes}
          ref={elt => this.domElement = elt}
          tabIndex={this.props.tabIndex}
          onKeyDown={this.handleKeyDown}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} />,
      this.renderRotateHandle()
    ]);
  }

  private renderToolbar() {
    const { board } = this.state;
    if (!board) return;
    const { readOnly } = this.props;
    const content = this.getContent();

    const selectedObjects = this.getContent().selectedObjects(board);
    const selectedPoints = selectedObjects && selectedObjects.filter(isPoint);
    const selectedPoint = selectedPoints && (selectedPoints.length === 1)
                            ? selectedPoints[0] as JXG.Point : undefined;
    const supportsVertexAngle = selectedPoint && canSupportVertexAngle(selectedPoint);
    const hasVertexAngle = !!selectedPoint && !!getVertexAngle(selectedPoint);
    const disableVertexAngle = readOnly || !supportsVertexAngle;
    const disableDelete = readOnly || !board || !content.hasSelection();
    const disableDuplicate = readOnly || !board || !this.getOneSelectedPolygon();

    return (
      <GeometryToolbarView
        key="geometry-toolbar-view"
        model={this.props.model}
        onAngleLabelClick={this.handleToggleVertexAngle}
        isAngleLabelDisabled={disableVertexAngle}
        isAngleLabelSelected={hasVertexAngle}
        onDeleteClick={this.handleDelete}
        isDeleteDisabled={disableDelete}
        onDuplicateClick={this.handleDuplicate}
        isDuplicateDisabled={disableDuplicate}
      />
    );
  }

  private renderRotateHandle() {
    const { board, disableRotate } = this.state;
    const selectedPolygon = board && !disableRotate && !this.props.readOnly
                              ? this.getOneSelectedPolygon() : undefined;
    return (
      <RotatePolygonIcon
        key="rotate-polygon-icon"
        board={board}
        polygon={selectedPolygon}
        scale={this.props.scale}
        onRotate={this.handleRotatePolygon} />
    );
  }

  private getContent() {
    return this.props.model.content as GeometryContentModelType;
  }

  private initializeContent() {
    const { model: { content } } = this.props;
    if ((content.type !== "Geometry") || !this.state.elementId) { return; }

    const domElt = document.getElementById(this.state.elementId);
    const eltBounds = domElt && domElt.getBoundingClientRect();
    // JSXGraph fails hard if the DOM element doesn't exist or has zero extent
    if (eltBounds && (eltBounds.width > 0) && (eltBounds.height > 0)) {
      const board = content.initializeBoard(this.state.elementId, this.handleCreateElement);
      if (board) {
        this.handleCreateBoard(board);
        const imageUrl = this.getContent().getLastImageUrl();
        if (imageUrl) {
          this.updateImageUrl(imageUrl);
        }
      }
      const newState = assign({ syncedChanges: content.changes.length },
                                board ? { board } : null);
      this.setState(newState);
    }
  }

  private initializeHotKeys() {
    this.hotKeys.register({
      "backspace": this.handleDelete,
      "delete": this.handleDelete,
      "cmd-c": this.handleCopy,
      "cmd-x": this.handleCut,
      "cmd-v": this.handlePaste,
      "cmd-z": this.handleUndo,
      "cmd-shift-z": this.handleRedo,
    });
  }

  private getBackgroundImage(_board?: JXG.Board) {
    const board = _board || this.state.board;
    if (!board) return;
    const images = this.getContent()
                      .findObjects(board, obj => obj.elType === "image");
    return images.length > 0
            ? images[images.length - 1] as JXG.Image
            : undefined;
  }

  private updateImageUrl(url: string) {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    this.debouncedUpdateImage(url);
  }

  private handleToggleVertexAngle = () => {
    const { board } = this.state;
    const selectedObjects = board && this.getContent().selectedObjects(board);
    const selectedPoints = selectedObjects && selectedObjects.filter(isPoint);
    const selectedPoint = selectedPoints && selectedPoints[0] as JXG.Point;
    if (board && selectedPoint) {
      const vertexAngle = getVertexAngle(selectedPoint);
      if (!vertexAngle) {
        const anglePts = getPointsForVertexAngle(selectedPoint);
        if (anglePts) {
          const anglePtIds = anglePts.map(pt => pt.id);
          this.applyChange(() => {
            const angle = this.getContent().addVertexAngle(board, anglePtIds);
            if (angle) {
              this.handleCreateVertexAngle(angle);
            }
          });
        }
      }
      else {
        this.applyChange(() => {
          this.getContent().removeObjects(board, vertexAngle.id);
        });
      }
    }
  }

  private getOneSelectedPolygon() {
    const { board } = this.state;
    if (!board) return;

    // all vertices of polygon must be selected to show rotate handle
    const content = this.getContent();
    const polygonSelection: { [id: string]: { any: boolean, all: boolean } } = {};
    const polygons = board.objectsList
                          .filter(el => el.elType === "polygon")
                          .filter(polygon => {
                            const selected = { any: false, all: true };
                            each(polygon.ancestors, vertex => {
                              if (content.isSelected(vertex.id)) {
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
      const selectedPts = Array.from(content.metadata.selection.entries())
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

  private handleRotatePolygon = (polygon: JXG.Polygon, vertexCoords: JXG.Coords[], isComplete: boolean) => {
    const { board } = this.state;
    if (!board) return;

    polygon.vertices.forEach((vertex, index) => {
      if (index < polygon.vertices.length - 1) {
        const coords = vertexCoords[index];
        vertex.setAttribute({ snapToGrid: false });
        vertex.setPosition(JXG.COORDS_BY_USER, coords.usrCoords.slice(1));
      }
    });
    board.update();

    if (isComplete) {
      const vertexCount = polygon.vertices.length - 1;
      this.getContent()
          .updateObjects(
            board,
            polygon.vertices
              .map(vertex => vertex.id)
              .slice(0, vertexCount),
            vertexCoords
              .map(coords => ({ snapToGrid: false,
                                position: coords.usrCoords.slice(1) }))
              .slice(0, vertexCount));
    }
  }

  private handleDelete = () => {
    const content = this.getContent();
    const { readOnly } = this.props;
    const { board } = this.state;
    if (!readOnly && board && content.hasSelection()) {
      content.deleteSelection(board);
      return true;
    }
  }

  private handleDuplicate = () => {
    this.handleCopy();
    this.handlePaste();
  }

  private handleUndo = () => {
    const content = this.getContent();
    const { board } = this.state;
    if (board) {
      const changes = content.popChangeset();
      if (changes) {
        this.setState({
          redoStack: this.state.redoStack.concat([changes])
        });
      }
    }

    return true;
  }

  private handleRedo = () => {
    const content = this.getContent();
    const { redoStack } = this.state;
    const changeset = redoStack[redoStack.length - 1];
    if (changeset) {
      content.pushChangeset(changeset);
      this.setState({
        redoStack: redoStack.slice(0, redoStack.length - 1)
      });
    }

    return true;
  }

  private handleCopy = () => {
    const content = this.getContent();
    const { board } = this.state;
    if (board && content.hasSelection()) {
      const { clipboard } = this.stores;
      const changes = content.copySelection(board);
      clipboard.clear();
      clipboard.addTileContent(content.metadata.id, content.type, changes, this.stores);
      return true;
    }
  }

  private handleCut = () => {
    this.handleCopy();
    return this.handleDelete();
  }

  private handlePaste = () => {
    const content = this.getContent();
    const { readOnly } = this.props;
    const { board } = this.state;
    if (!readOnly && board) {
      const { clipboard } = this.stores;
      let changes: string[] = clipboard.getTileContent(content.type);
      if (changes && changes.length) {
        const pasteId = clipboard.getTileContentId(content.type);
        const isSameTile = clipboard.isSourceTile(content.type, content.metadata.id);
        // track the number of times the same content has been pasted
        if (pasteId) {
          if (pasteId !== this.lastPasteId) {
            this.lastPasteId = pasteId;
            this.lastPasteCount = isSameTile ? 1 : 0;
          }
          else {
            ++this.lastPasteCount;
          }
        }
        // To handle multiple pastes of the same clipboard content,
        // we must re-map ids to avoid duplication. We also offset
        // the locations of points slightly so multiple pastes
        // don't appear exactly on top of each other.
        const idMap: { [id: string]: string } = {};
        const newPointIds: string[] = [];
        if (this.lastPasteCount > 0) {
          changes = changes.map((jsonChange, index) => {
            const change = safeJsonParse(jsonChange);
            const delta = this.lastPasteCount * 0.8;
            switch (change && change.operation) {
              case "create":
                // map ids of newly create object
                if (change.properties && change.properties.id) {
                  idMap[change.properties.id] = uuid();
                  change.properties.id = idMap[change.properties.id];
                }
                // after the first paste, names/labels are auto-generated
                if (change.properties && change.properties.name) {
                  delete change.properties.name;
                }
                if (change.target === "point") {
                  // offset locations of points
                  change.parents[0] += delta;
                  change.parents[1] -= delta;
                  newPointIds.push(change.properties.id);
                }
                else if (["polygon", "vertexAngle"].indexOf(change.target) >= 0) {
                  // map ids of parent object references
                  change.parents = change.parents.map((parentId: string) => idMap[parentId]);
                }
                break;
              case "update":
              case "delete":
                if (Array.isArray(change.targetID)) {
                  change.targetID = change.targetID.map((id: string) => idMap[id]);
                }
                else {
                  change.targetID = idMap[change.targetID];
                }
                break;
            }
            if (index === 0) {
              change.startBatch = true;
            } else if (index === changes.length - 1) {
              change.endBatch = true;
            }
            return JSON.stringify(change);
          });
        }
        this.applyBatchChanges(changes);
        // select newly pasted points
        if (newPointIds.length) {
          content.deselectAll(board);
          content.selectObjects(newPointIds);
        }
      }
      return true;
    }
  }

  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    this.hotKeys.dispatch(e);
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { readOnly } = this.props;
    const toolType = extractDragTileType(e.dataTransfer);
    // image drop area is central 80% in each dimension
    const kImgDropMarginPct = 0.1;
    if (!readOnly && (toolType === "image")) {
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < eltBounds.bottom - kImgDropMarginY)) {
        return true;
      }
    }
    return false;
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = this.isAcceptableImageDrag(e);
    this.props.onSetCanAcceptDrop(isAcceptableDrag ? this.props.model.id : undefined);
    if (isAcceptableDrag) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
  }

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.props.onSetCanAcceptDrop();
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.isAcceptableImageDrag(e)) {
      const dragContent = e.dataTransfer.getData(kDragTileContent);
      const parsedContent = safeJsonParse(dragContent);
      const { board } = this.state;
      if (parsedContent && board) {
        const { model: { content } } = this.props;
        const geometryContent = content as GeometryContentModelType;
        const droppedContent = parsedContent.content;
        const url = getUrlFromImageContent(droppedContent);
        if (url) {
          gImageMap.getImage(url)
            .then(image => {
              if (!this._isMounted || !image.contentUrl) return;
              const width = image.width! / kGeometryDefaultPixelsPerUnit;
              const height = image.height! / kGeometryDefaultPixelsPerUnit;
              const imageIds = geometryContent
                                .findObjects(board, obj => obj.elType === "image")
                                .map(obj => obj.id);
              const contentUrl = image.contentUrl || url;
              this.applyChanges(() => {
                if (imageIds.length) {
                  // change URL if there's already an image present
                  const imageId = imageIds[imageIds.length - 1];
                  geometryContent.updateObjects(board, imageId, {
                                                  url: contentUrl,
                                                  size: [width, height]
                                                });
                }
                else {
                  geometryContent.addImage(board, contentUrl, [0, 0], [width, height]);
                }
              });
              this.updateImageUrl(contentUrl);
            });
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  private handleCreateElement = (elt: JXG.GeometryElement) => {
    if (this.props.readOnly && (elt != null)) {
      elt.setAttribute({ fixed: true });
    }
    if (isPoint(elt)) {
      this.handleCreatePoint(elt as JXG.Point);
    }
    else if (isPolygon(elt)) {
      this.handleCreatePolygon(elt as JXG.Polygon);
    }
    else if (isVertexAngle(elt)) {
      this.handleCreateVertexAngle(elt as JXG.Angle);
    }
  }

  private applyChange(change: () => void) {
    this.setState({ syncedChanges: this.state.syncedChanges + 1 }, change);
  }

  private applyChanges(changes: () => void) {
    const { model: { content } } = this.props;
    const geometryContent = content as GeometryContentModelType;
    const { board } = this.state;
    if (!geometryContent || !board) return;

    // update the geometry without updating the model
    geometryContent.suspendSync();
    changes();

    // update the model as a batch
    const changeCount = geometryContent.batchChangeCount;
    this.setState({ syncedChanges: this.state.syncedChanges + changeCount },
                  () => geometryContent.resumeSync());
  }

  private applyBatchChanges(changes: string[]) {
    this.applyChanges(() => {
      changes.forEach(change => {
        const content = this.getContent();
        const { board } = this.state;
        if (board) {
          const parsedChange = safeJsonParse(change);
          if (parsedChange) {
            const result = content.applyChange(board, parsedChange);
            if (result) {
              this.handleCreateElement(result as JXG.GeometryElement);
            }
          }
        }
      });
    });
  }

  private isSqrDistanceWithinThreshold(threshold: number, c1?: JXG.Coords, c2?: JXG.Coords) {
    if ((c1 == null) || (c2 == null)) { return false; }
    const [ , c1x, c1y] = c1.scrCoords;
    const [ , c2x, c2y] = c2.scrCoords;
    if ((c1x == null) || !isFinite(c1x) || (c1y == null) || !isFinite(c1y)) { return false; }
    if ((c2x == null) || !isFinite(c2x) || (c2y == null) || !isFinite(c2y)) { return false; }
    const dx = c2x - c1x;
    const dy = c2y - c1y;
    return dx * dx + dy * dy < threshold;
  }

  private isDoubleClick(c1?: JXGPtrEvent, c2?: JXGPtrEvent) {
    return (c1 && c2 && (c2.evt.timeStamp - c1.evt.timeStamp < 300) &&
            this.isSqrDistanceWithinThreshold(9, c1.coords, c2.coords));
  }

  private beginDragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement) {
    const { board } = this.state;
    const content = this.getContent();
    if (board && !hasSelectionModifier(evt)) {
      content.metadata.selection.forEach((isSelected, id) => {
        const obj = board.objects[id];
        const pt = isPoint(obj) ? obj as JXG.Point : undefined;
        if (pt && isSelected) {
          this.dragPts[id] = {
            initial: copyCoords(pt.coords),
            snapToGrid: pt.getAttribute("snapToGrid")
          };
        }
      });
    }
  }

  private dragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement, usrDiff: number[]) {
    const { board } = this.state;
    if (!board) return;

    each(this.dragPts, (entry, id) => {
      if (entry) {
        const obj = board.objects[id];
        const pt = isPoint(obj) ? obj as JXG.Point : undefined;
        // move the points not dragged by JSXGraph
        if (pt && !isDragTargetOrAncestor(pt, dragTarget)) {
          const newUsrCoords = JXG.Math.Statistics.add(entry.initial.usrCoords, usrDiff) as number[];
          pt.setAttribute({ snapToGrid: false });
          pt.setPosition(JXG.COORDS_BY_USER, newUsrCoords);
          entry.final = copyCoords(pt.coords);
        }
      }
    });

    const affectedObjects = keys(this.dragPts).map(id => board.objects[id]);
    updateVertexAnglesFromObjects(affectedObjects);
  }

  private endDragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement, usrDiff: number[]) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;

    each(this.dragPts, (entry, id) => {
      const obj = board.objects[id];
      if (obj) {
        obj.setAttribute({ snapToGrid: !!entry.snapToGrid });
      }
    });

    this.dragSelectedPoints(evt, dragTarget, usrDiff);

    // only create a change object if there's actually a change
    if (usrDiff[1] || usrDiff[2]) {
      const ids: string[] = [];
      const props: Array<{ position: number[] }> = [];
      each(this.dragPts, (entry, id) => {
        if (entry && content) {
          const obj = board.objects[id];
          const pt = isPoint(obj) ? obj as JXG.Point : undefined;
          if (pt) {
            const newUsrCoords = JXG.Math.Statistics.add(entry.initial.usrCoords, usrDiff) as number[];
            ids.push(id);
            props.push({ position: newUsrCoords });
          }
        }
      });

      this.applyChange(() => content.updateObjects(board, ids, props));
    }
  }

  private handleCreateBoard = (board: JXG.Board) => {

    const handlePointerDown = (evt: any) => {
      const { model, scale } = this.props;
      const { ui } = this.stores;

      // clicked tile gets keyboard focus
      if (this.domElement) {
        // requires non-empty tabIndex
        this.domElement.focus();
      }
      // first click selects the tile; subsequent clicks create points
      if (!ui.isSelectedTile(model)) {
        ui.setSelectedTile(model);
        return;
      }

      const coords = getEventCoords(board, evt, scale);
      const x = coords.usrCoords[1];
      const y = coords.usrCoords[2];
      if ((x != null) && isFinite(x) && (y != null) || isFinite(y)) {
        this.lastBoardDown = { evt, coords };
      }
    };

    const handlePointerUp = (evt: any) => {
      const { readOnly, scale } = this.props;
      if (!this.lastBoardDown) { return; }

      // cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
      const coords = getEventCoords(board, evt, scale);
      const [ , x, y] = this.lastBoardDown.coords.usrCoords;
      if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) {
        return;
      }

      // clicks on background (or images) of board clear the selection
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const elements = getAllObjectsUnderMouse(board, evt, scale)
                            .filter(obj => obj && (obj.elType !== "image"));
      if (!elements.length && !hasSelectionModifier(evt) && geometryContent.hasSelection()) {
        geometryContent.deselectAll(board);
        return;
      }

      if (readOnly) return;

      // extended clicks don't create new points
      const clickTimeThreshold = 500;
      if (evt.timeStamp - this.lastBoardDown.evt.timeStamp > clickTimeThreshold) {
        return;
      }

      // clicks that move don't create new points
      const clickSqrDistanceThreshold = 9;
      if (!this.isSqrDistanceWithinThreshold(clickSqrDistanceThreshold, this.lastBoardDown.coords, coords)) {
        return;
      }

      // clicks on visible points and edges don't create new points
      for (const elt of board.objectsList) {
        if ((isVisiblePoint(elt) || isVisibleEdge(elt)) &&
            elt.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
          return;
        }
      }

      // clicks that affect selection don't create new points
      if (this.lastSelectDown &&
          (evt.timeStamp - this.lastSelectDown.timeStamp < clickTimeThreshold)) {
        return;
      }

      // clicks on board background create new points
      if (!hasSelectionModifier(evt)) {
        const props = { snapToGrid: true, snapSizeX: kSnapUnit, snapSizeY: kSnapUnit };
        this.applyChange(() => {
          const point = geometryContent.addPoint(board, [x, y], props) as JXG.Point;
          if (point) {
            this.handleCreatePoint(point);
          }
        });
      }
    };

    // synchronize initial selection
    const content = this.getContent();
    content.findObjects(board, elt => isPoint(elt))
      .forEach(pt => {
        if (content.isSelected(pt.id)) {
          setElementColor(board, pt.id, true);
        }
      });

    // synchronize selection changes
    this.disposeSelectionObserver = content.metadata.selection.observe(change => {
      if (this.state.board) {
        setElementColor(this.state.board, change.name, (change as any).newValue.value);
      }
    });

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  }

  private handleCreatePoint = (point: JXG.Point) => {

    const handlePointerDown = (evt: any) => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const { board } = this.state;
      if (!board) return;
      const id = point.id;
      const coords = copyCoords(point.coords);
      if (isFreePoint(point) && this.isDoubleClick(this.lastPointDown, { evt, coords })) {
        if (board) {
          this.applyChange(() => {
            const polygon = geometryContent.createPolygonFromFreePoints(board) as JXG.Polygon;
            if (polygon) {
              this.handleCreatePolygon(polygon);
            }
          });
          this.lastPointDown = undefined;
        }
      }
      else {
        this.dragPts = { [id]: { initial: coords } };
        this.lastPointDown = { evt, coords };

        // click on selected element - deselect if appropriate modifier key is down
        if (geometryContent.isSelected(id)) {
          if (hasSelectionModifier(evt)) {
            geometryContent.deselectElement(id);
          }
        }
        // click on unselected element
        else {
          // deselect other elements unless appropriate modifier key is down
          if (!hasSelectionModifier(evt)) {
            geometryContent.deselectAll(board);
          }
          geometryContent.selectElement(id);
        }

        if (!this.props.readOnly) {
          this.beginDragSelectedPoints(evt, point);
        }

        this.lastSelectDown = evt;
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly) return;

      const id = point.id;
      let dragEntry = this.dragPts[id];
      if (!dragEntry) {
        dragEntry = this.dragPts[id] = { initial: copyCoords(point.coords) };
      }
      dragEntry.final = copyCoords(point.coords);
      this.setState({ disableRotate: true });

      const usrDiff = JXG.Math.Statistics.subtract(dragEntry.final.usrCoords,
                                                  dragEntry.initial.usrCoords) as number[];
      this.dragSelectedPoints(evt, point, usrDiff);
    };

    const handlePointerUp = (evt: any) => {
      this.setState({ disableRotate: false });
      const id = point.id;
      const dragEntry = this.dragPts[id];
      if (!dragEntry) { return; }

      if (!this.props.readOnly) {
        dragEntry.final = copyCoords(point.coords);
        const usrDiff = JXG.Math.Statistics.subtract(dragEntry.final.usrCoords,
                                                    dragEntry.initial.usrCoords) as number[];
        this.endDragSelectedPoints(evt, point, usrDiff);
      }

      delete this.dragPts[id];
    };

    point.on("down", handlePointerDown);
    point.on("drag", handleDrag);
    point.on("up", handlePointerUp);
  }

  private handleCreatePolygonEdge = (edge: JXG.Line) => {

    function getVertices() {
      return filter(edge.ancestors, ancestor => isPoint(ancestor)) as JXG.Point[];
    }

    const isInVertex = (evt: any) => {
      const { scale } = this.props;
      const { board } = this.state;
      if (!board) return false;
      const coords = getEventCoords(board, evt, scale);
      return find(getVertices(), vertex => vertex.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) != null;
    };

    const handlePointerDown = (evt: any) => {
      const { readOnly } = this.props;
      const { board, scale } = this.state;
      if (!board || (edge !== getClickableObjectUnderMouse(board, evt, !readOnly, scale))) return;

      const content = this.getContent();
      const vertices = getVertices();
      const allSelected = vertices.every(vertex => content.isSelected(vertex.id));
      // deselect other elements unless appropriate modifier key is down
      if (board && !allSelected) {
        if (!hasSelectionModifier(evt)) {
          content.deselectAll(board);
        }
        vertices.forEach(vertex => content.selectElement(vertex.id));
      }
      // we can't prevent JSXGraph from dragging the edge, so don't deselect
      // else if (hasSelectionModifier(evt)) {
      //   vertices.forEach(vertex => content.deselectElement(vertex.id));
      // }

      if (!readOnly) {
        // point handles vertex drags
        this.isVertexDrag = isInVertex(evt);
        if (!this.isVertexDrag) {
          this.beginDragSelectedPoints(evt, edge);
        }
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly || this.isVertexDrag) return;

      const vertices = getVertices();
      const vertex = vertices[0];
      const dragEntry = this.dragPts[vertex.id];
      if (dragEntry && dragEntry.initial) {
        const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                    dragEntry.initial.usrCoords) as number[];
        this.dragSelectedPoints(evt, edge, usrDiff);
      }
      this.setState({ disableRotate: true });
    };

    const handlePointerUp = (evt: any) => {
      this.setState({ disableRotate: false });

      const vertices = getVertices();
      if (!this.props.readOnly && !this.isVertexDrag) {
        const vertex = vertices[0];
        const dragEntry = this.dragPts[vertex.id];
        if (dragEntry && dragEntry.initial) {
          const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                      dragEntry.initial.usrCoords) as number[];
          this.endDragSelectedPoints(evt, edge, usrDiff);
        }
      }
      // remove this polygon's vertices from the dragPts map
      vertices.forEach(vertex => delete this.dragPts[vertex.id]);
      this.isVertexDrag = false;
    };

    edge.on("down", handlePointerDown);
    edge.on("drag", handleDrag);
    edge.on("up", handlePointerUp);
  }

  private handleCreatePolygon = (polygon: JXG.Polygon) => {

    const isInVertex = (evt: any) => {
      const { scale } = this.props;
      const { board } = this.state;
      if (!board) return false;
      const coords = getEventCoords(board, evt, scale);
      let inVertex = false;
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        if (pt.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
          inVertex = true;
        }
      });
      return inVertex;
    };

    const areAllVerticesSelected = () => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      let allSelected = true;
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        if (!geometryContent.isSelected(pt.id)) {
          allSelected = false;
        }
      });
      return allSelected;
    };

    const handlePointerDown = (evt: any) => {
      const { readOnly } = this.props;
      const { board, scale } = this.state;
      if (!board || (polygon !== getClickableObjectUnderMouse(board, evt, !readOnly, scale))) return;
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const inVertex = isInVertex(evt);
      const allVerticesSelected = areAllVerticesSelected();
      let selectVertices = false;
      // let deselectVertices = false;
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (board && !hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        selectVertices = true;
        this.lastSelectDown = evt;
      }
      // we can't prevent JSXGraph from dragging the polygon, so don't deselect
      // else if (!inVertex && allVerticesSelected) {
      //   if (board && hasSelectionModifier(evt)) {
      //     deselectVertices = true;
      //   }
      // }
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        if (board && !inVertex) {
          if (selectVertices) {
            geometryContent.selectElement(pt.id);
          }
          // we can't prevent JSXGraph from dragging the polygon, so don't deselect
          // else if (deselectVertices) {
          //   geometryContent.deselectElement(pt.id);
          // }
        }
      });

      if (!readOnly) {
        // point handles vertex drags
        this.isVertexDrag = isInVertex(evt);
        if (!this.isVertexDrag) {
          this.beginDragSelectedPoints(evt, polygon);
        }
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly || this.isVertexDrag) return;

      const vertex = polygon.vertices[0];
      const dragEntry = this.dragPts[vertex.id];
      if (dragEntry && dragEntry.initial) {
        const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                    dragEntry.initial.usrCoords) as number[];
        this.dragSelectedPoints(evt, polygon, usrDiff);
      }
      this.setState({ disableRotate: true });
    };

    const handlePointerUp = (evt: any) => {
      this.setState({ disableRotate: false });

      if (!this.props.readOnly && !this.isVertexDrag) {
        const vertex = polygon.vertices[0];
        const dragEntry = this.dragPts[vertex.id];
        if (dragEntry && dragEntry.initial) {
          const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                      dragEntry.initial.usrCoords) as number[];
          this.endDragSelectedPoints(evt, polygon, usrDiff);
        }
      }
      // remove this polygon's vertices from the dragPts map
      polygon.vertices.forEach(vertex => delete this.dragPts[vertex.id]);
      this.isVertexDrag = false;
    };

    const edges = getPolygonEdges(polygon);
    edges.forEach(edge => this.handleCreatePolygonEdge(edge));

    polygon.on("down", handlePointerDown);
    polygon.on("drag", handleDrag);
    polygon.on("up", handlePointerUp);
  }

  private handleCreateVertexAngle = (angle: JXG.Angle) => {
    updateVertexAngle(angle);
  }
}

export default class GeometryToolComponent extends React.Component<IProps, {}> {

  public static getDragImageNode(dragTargetNode: HTMLElement) {
    // dragTargetNode is the tool-tile div
    const geometryElts = dragTargetNode.getElementsByClassName("geometry-tool");
    const geometryElt = geometryElts && geometryElts[0];
    // geometryElt's firstChild is the actual SVG, which works as a drag image
    return geometryElt && geometryElt.firstChild;
  }

  public render() {
    return (
      <SizeMe monitorHeight={true}>
        {({ size }: SizeMeProps) => {
          return (
            <div className="geometry-size-me" style={{ width: "100%", height: "100%" }}>
              <GeometryToolComponentImpl size={size} {...this.props} />
            </div>
          );
        }}
      </SizeMe>
    );
  }
}
