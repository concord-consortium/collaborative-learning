import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { GeometryContentModelType, kGeometryDefaultPixelsPerUnit, setElementColor
        } from "../../models/tools/geometry/geometry-content";
import { getEventCoords, copyCoords } from "./geometry-tool/geometry-utils";
import { RotatePolygonIcon } from "./geometry-tool/rotate-polygon-icon";
import { isPoint, isFreePoint, isVisiblePoint } from "../../models/tools/geometry/jxg-point";
import { isPolygon } from "../../models/tools/geometry/jxg-polygon";
import { JXGCoordPair, JXGProperties } from "../../models/tools/geometry/jxg-changes";
import { assign, each, isEqual, size as _size, some, values } from "lodash";
import { SizeMe } from "react-sizeme";
import { extractDragTileType, kDragTileContent, IToolApiInterface } from "./tool-tile";
import { getImageDimensions } from "../../utilities/image-utils";
import { safeJsonParse } from "../../utilities/js-utils";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { HotKeys } from "../../utilities/hot-keys";
import * as uuid from "uuid/v4";

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
  syncedChanges: number;
  disableRotate: boolean;
}

interface JXGPtrEvent {
  evt: any;
  coords: JXG.Coords;
}

// For snap to grid
const kSnapUnit = 0.2;

function syncBoardChanges(board: JXG.Board, content: GeometryContentModelType,
                          syncedChanges?: number, readOnly?: boolean) {
  for (let i = syncedChanges || 0; i < content.changes.length; ++i) {
    try {
      const change = JSON.parse(content.changes[i]);
      const result = content.syncChange(board, change);
      if (readOnly && (result instanceof JXG.GeometryElement)) {
        const obj = result as JXG.GeometryElement;
        obj.setAttribute({ fixed: true });
      }
    }
    catch (e) {
      // ignore exceptions
    }
  }
  return content.changes.length;
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
        nextState.syncedChanges = syncBoardChanges(prevState.board, geometryContent,
                                                  prevState.syncedChanges, readOnly);
      }
      nextState.content = geometryContent;
    }
    return nextState;
  }

  public state: IState = {
          syncedChanges: 0,
          disableRotate: false
        };

  private domElement: HTMLDivElement | null;

  private disposeSelectionObserver: any;

  private hotKeys: HotKeys = new HotKeys();

  private lastBoardDown: JXGPtrEvent;
  private lastPointDown?: JXGPtrEvent;
  private lastSelectDown?: any;
  private dragPts: { [id: string]: { initial: JXG.Coords, final?: JXG.Coords,
                                      isTarget?: boolean, snapToGrid?: boolean }} = {};
  private isVertexDrag: boolean;

  private lastPasteId: string;
  private lastPasteCount: number;

  public componentDidMount() {
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
  }

  public componentWillUnmount() {
    if (this.disposeSelectionObserver) {
      this.disposeSelectionObserver();
    }
    if (this.state.board) {
      JXG.JSXGraph.freeBoard(this.state.board);
    }
  }

  public render() {
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `geometry-tool ${editableClass}`;
    return ([
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

  private renderRotateHandle() {
    const { board, disableRotate } = this.state;
    const selectedPolygon = board && !disableRotate && !this.props.readOnly
                              ? this.getOneSelectedPolygon() : undefined;
    return (
      <RotatePolygonIcon
        key="rotate-polygon-icon"
        board={board}
        polygon={selectedPolygon}
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
      "cmd-v": this.handlePaste
    });
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
        if (this.lastPasteCount > 0) {
          changes = changes.map(jsonChange => {
            const change = safeJsonParse(jsonChange);
            const delta = this.lastPasteCount * 0.4;
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
                }
                else if (change.target === "polygon") {
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
            return JSON.stringify(change);
          });
        }
        this.applyBatchChanges(changes);
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
      let parsedContent;
      try {
        parsedContent = JSON.parse(dragContent);
      }
      catch (e) {
        // ignore errors
      }
      const { board } = this.state;
      if (parsedContent && board) {
        const { model: { content } } = this.props;
        const geometryContent = content as GeometryContentModelType;
        const droppedContent = parsedContent.content;
        const urlOrProxy = droppedContent && droppedContent.url;
        getImageDimensions(undefined, urlOrProxy).then((dimensions: any) => {
          const width = dimensions.width / kGeometryDefaultPixelsPerUnit;
          const height = dimensions.height / kGeometryDefaultPixelsPerUnit;
          const imageIds = geometryContent
                            .findObjects(board, obj => obj.elType === "image")
                            .map(obj => obj.id);
          this.applyChanges(() => {
            if (imageIds.length) {
              // change URL if there's already an image present
              const imageId = imageIds[imageIds.length - 1];
              geometryContent.updateObjects(board, imageId, {
                                              url: urlOrProxy,
                                              size: [width, height]
                                            });
            }
            else {
              geometryContent.addImage(board, urlOrProxy, [0, 0], [width, height]);
            }
          });
        });
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
            snapToGrid: pt.getAttribute("snapToGrid"),
            // targets are dragged by JSXGraph
            isTarget: (id === dragTarget.id) ||
                      (values(dragTarget.ancestors)
                        .findIndex(ancestor => ancestor.id === id) >= 0)
          };
          pt.setAttribute({ snapToGrid: false });
        }
      });
    }
  }

  private dragSelectedPoints(evt: any, usrDiff: number[]) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;

    each(this.dragPts, (entry, id) => {
      if (entry && content) {
        const obj = board.objects[id];
        const pt = isPoint(obj) ? obj as JXG.Point : undefined;
        // move the points not dragged by JSXGraph
        if (pt && !entry.isTarget) {
          const newUsrCoords = JXG.Math.Statistics.add(entry.initial.usrCoords, usrDiff) as number[];
          pt.setPosition(JXG.COORDS_BY_USER, newUsrCoords);
          entry.final = copyCoords(pt.coords);
        }
      }
    });
  }

  private endDragSelectedPoints(evt: any, usrDiff: number[]) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;

    each(this.dragPts, (entry, id) => {
      const obj = board.objects[id];
      if (obj) {
        obj.setAttribute({ snapToGrid: !!entry.snapToGrid });
      }
    });

    this.dragSelectedPoints(evt, usrDiff);

    // only create a change object if there's actually a change
    if ((usrDiff[0] !== 0) || (usrDiff[1] !== 0)) {
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

      const index = evt[JXG.touchProperty] ? 0 : undefined;
      const coords = getEventCoords(board, evt, scale, index);
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
      const index = evt[JXG.touchProperty] ? 0 : undefined;
      const coords = getEventCoords(board, evt, scale, index);
      const [ , x, y] = this.lastBoardDown.coords.usrCoords;
      if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) {
        return;
      }

      // clicks on background (or images) of board clear the selection
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const elements = board.getAllObjectsUnderMouse(evt)
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

      // clicks on visible points don't create new points
      for (const elt of board.objectsList) {
        if (isVisiblePoint(elt) && elt.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
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

    // synchronize selection changes
    const _geometryContent = this.props.model.content as GeometryContentModelType;
    this.disposeSelectionObserver = _geometryContent.metadata.selection.observe(change => {
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
      this.dragSelectedPoints(evt, usrDiff);
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
        this.endDragSelectedPoints(evt, usrDiff);
      }

      this.dragPts = {};
    };

    point.on("down", handlePointerDown);
    point.on("drag", handleDrag);
    point.on("up", handlePointerUp);
  }

  private handleCreatePolygon = (polygon: JXG.Polygon) => {

    const isInVertex = (evt: any) => {
      const { scale } = this.props;
      const { board } = this.state;
      if (!board) return false;
      const index = evt[JXG.touchProperty] ? 0 : undefined;
      const coords = getEventCoords(board, evt, scale, index);
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
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const { board } = this.state;
      const inVertex = isInVertex(evt);
      const allVerticesSelected = areAllVerticesSelected();
      let selectVertices = false;
      let deselectVertices = false;
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (board && !hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        selectVertices = true;
        this.lastSelectDown = evt;
      }
      else if (!inVertex && allVerticesSelected) {
        if (board && hasSelectionModifier(evt)) {
          deselectVertices = true;
        }
      }
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        if (board && !inVertex) {
          if (selectVertices) {
            geometryContent.selectElement(pt.id);
          }
          else if (deselectVertices) {
            geometryContent.deselectElement(pt.id);
          }
        }
      });

      if (!this.props.readOnly) {
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
        this.dragSelectedPoints(evt, usrDiff);
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
          this.endDragSelectedPoints(evt, usrDiff);
        }
      }

      this.dragPts = {};
      this.isVertexDrag = false;
    };

    polygon.on("down", handlePointerDown);
    polygon.on("drag", handleDrag);
    polygon.on("up", handlePointerUp);
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
