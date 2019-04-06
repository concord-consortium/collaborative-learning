import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../base";
import { Alert, Intent } from "@blueprintjs/core";
import { DocumentContentModelType } from "../../../models/document/document-content";
import { IGeometryProps, IActionHandlers, SizeMeProps } from "./geometry-shared";
import { GeometryContentModelType, GeometryMetadataModelType, setElementColor
        } from "../../../models/tools/geometry/geometry-content";
import { copyCoords, getEventCoords, getAllObjectsUnderMouse, getClickableObjectUnderMouse,
          isDragTargetOrAncestor } from "../../../models/tools/geometry/geometry-utils";
import { RotatePolygonIcon } from "./rotate-polygon-icon";
import { kGeometryDefaultPixelsPerUnit, isAxis, isAxisLabel, isBoard } from "../../../models/tools/geometry/jxg-board";
import { JXGChange, ILinkProperties } from "../../../models/tools/geometry/jxg-changes";
import { isComment } from "../../../models/tools/geometry/jxg-comment";
import { isPoint, isFreePoint, isVisiblePoint, kSnapUnit } from "../../../models/tools/geometry/jxg-point";
import { getPointsForVertexAngle, getPolygonEdges, isPolygon, isVisibleEdge
        } from "../../../models/tools/geometry/jxg-polygon";
import { getVertexAngle, isVertexAngle, updateVertexAngle, updateVertexAnglesFromObjects
        } from "../../../models/tools/geometry/jxg-vertex-angle";
import { injectIsValidTableLinkFunction } from "../../../models/tools/geometry/jxg-table-link";
import { extractDragTileType, kDragTileContent, kDragTileId, dragTileSrcDocId } from "../tool-tile";
import { ImageMapEntryType, gImageMap } from "../../../models/image-map";
import { getParentWithTypeName } from "../../../utilities/mst-utils";
import { getUrlFromImageContent } from "../../../utilities/image-utils";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { assign, castArray, debounce, each, filter, find, keys, size as _size, values } from "lodash";
import { isVisibleMovableLine, isMovableLine, isMovableLineControlPoint, isMovableLineEquation,
  handleControlPointClick} from "../../../models/tools/geometry/jxg-movable-line";
import * as uuid from "uuid/v4";
import { Logger, LogEventName, LogEventMethod } from "../../../lib/logger";
import MovableLineDialog from "./movable-line-dialog";
import AxisSettingsDialog from "./axis-settings-dialog";
const placeholderImage = require("../../../assets/image_placeholder.png");
import DocumentDialog from "../../utilities/document-dialog";

import "./geometry-tool.sass";

export interface IProps extends IGeometryProps {
  onSetBoard: (board: JXG.Board) => void;
  onSetActionHandlers: (handlers: IActionHandlers) => void;
}

interface IState extends SizeMeProps {
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
  selectedComment?: JXG.Text;
  selectedLine?: JXG.Line;
  showInvalidTableDataAlert?: boolean;
  axisSettingsOpen: boolean;
}

interface JXGPtrEvent {
  evt: any;
  coords: JXG.Coords;
}

interface IBoardContentMapEntry {
  modelId: string;
  metadata: GeometryMetadataModelType;
}
const sBoardContentMetadataMap: { [id: string]: IBoardContentMapEntry } = {};

injectIsValidTableLinkFunction((boardDomId: string, tableId?: string) => {
  const entry = boardDomId && sBoardContentMetadataMap[boardDomId];
  const metadata = entry && entry.metadata;
  return metadata && tableId ? metadata.isLinkedToTable(tableId) : false;
});

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
      const elts = castArray(result).filter(elt => elt instanceof JXG.GeometryElement) as JXG.GeometryElement[];
      newElements.push(...elts);
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

let sViewCount = 0;
function nextViewId() {
  return ++sViewCount;
}
​
@inject("stores")
@observer
export class GeometryContentComponent extends BaseComponent<IProps, IState> {

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    const { model: { content }, scale } = nextProps;
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
          // Board initialization creates 2 objects: the info box and the grid.
          // These won't be recreated if the board already exists so we don't delete them.
          const kDefaultBoardObjects = 2;
          for (let i = board.objectsList.length - 1; i >= kDefaultBoardObjects; i--) {
            board.removeObject(board.objectsList[i]);
          }
          board.unsuspendUpdate();
        }
        const syncedChanges = prevState.syncedChanges > geometryContent.changes.length
                                ? 0
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
          redoStack: [],
          axisSettingsOpen: false,
        };

  private modelId: string;
  private elementId: string;
  private domElement: HTMLDivElement | null;
  private _isMounted: boolean;

  private disposeSelectionObserver: any;

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

  constructor(props: IProps) {
    super(props);

    const { context, model, onSetActionHandlers } = props;

    this.modelId = model.id;
    this.elementId = `${context}-${model.id}-${nextViewId()}`;
    sBoardContentMetadataMap[this.elementId] = {
      modelId: model.id,
      metadata: (model.content as GeometryContentModelType).metadata
    };

    if (onSetActionHandlers) {
      const handlers: IActionHandlers = {
        handleCut: this.handleCut,
        handleCopy: this.handleCopy,
        handlePaste: this.handlePaste,
        handleDuplicate: this.handleDuplicate,
        handleDelete: this.handleDelete,
        handleUndo: this.handleUndo,
        handleRedo: this.handleRedo,
        handleToggleVertexAngle: this.handleToggleVertexAngle,
        handleCreateMovableLine: this.handleCreateMovableLine,
        handleCreateComment: this.handleCreateComment
      };
      onSetActionHandlers(handlers);
    }
  }

  public componentDidMount() {
    this._isMounted = true;

    this.initializeContent();

    if (this.props.toolApiInterface) {
      this.props.toolApiInterface.register(this.props.model.id, {
        hasSelection: () => {
          const geometryContent = this.props.model.content as GeometryContentModelType;
          // Note: hasSelection() returns true when there is a selection whether or not
          // the selection is deletable. We could test for hasDeletableSelection() here,
          // but the effect of that would be that the document toolbar would still enable
          // the delete button when undeletable content is selected, but now clicking the
          // delete button would delete the entire tile. For now, we preserve the current
          // behavior of enabling the toolbar for an undeletable selection.
          return !!geometryContent && geometryContent.hasSelection();
        },
        deleteSelection: () => {
          const geometryContent = this.props.model.content as GeometryContentModelType;
          const { board } = this.state;
          if (geometryContent && board && !this.props.readOnly) {
            geometryContent.deleteSelection(board);
          }
        },
        getSelectionInfo: () => {
          const geometryContent = this.props.model.content as GeometryContentModelType;
          if (geometryContent) {
            return JSON.stringify(geometryContent.selectedIds);
          } else {
            return "[]";
          }
        },
        highlightSelection: (selectionInfo: string) => {
          const { board } = this.state;
          const content = this.getContent();
          if (board && content) {
            board.objectsList.forEach(obj => {
              if (content.isSelected(obj.id)) {
                setElementColor(board, obj.id, false);
              }
            });
            const selectedIds: string[] = JSON.parse(selectionInfo);
            selectedIds.forEach(key => {
              setElementColor(board, key, true);
            });
          }
        },
        unhighlightSelection: (selectionInfo: string) => {
          const { board } = this.state;
          const content = this.getContent();
          if (board && content) {
            const selectedIds: string[] = JSON.parse(selectionInfo);
            selectedIds.forEach(key => {
              setElementColor(board, key, false);
            });
            // Return selection state to normal
            board.objectsList.forEach(obj => {
              if (content.isSelected(obj.id)) {
                setElementColor(board, obj.id, true);
              }
            });
          }
        }
      });
    }
  }

  public componentDidUpdate() {
    // if we didn't initialize before now, try again
    if (!this.state.board) {
      this.initializeContent();
    }

    const { newElements } = this.state;
    if (newElements && newElements.length) {
      this.handleCreateElements(newElements);
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
      delete sBoardContentMetadataMap[this.elementId];

      // delay so any asynchronous JSXGraph actions have time to complete
      setTimeout(() => {
        JXG.JSXGraph.freeBoard(board);
      });
    }

    if (!this.props.readOnly && this.props.toolApiInterface) {
      this.props.toolApiInterface.unregister(this.modelId);
    }

    this._isMounted = false;
  }

  public render() {
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `geometry-content ${editableClass}`;
    return ([
      this.renderCommentEditor(),
      this.renderLineEditor(),
      this.renderSettingsEditor(),
      <div id={this.elementId} key="jsxgraph"
          className={classes}
          ref={elt => this.domElement = elt}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} />,
      this.renderRotateHandle(),
      this.renderInvalidTableDataAlert()
    ]);
  }

  private renderCommentEditor() {
    const comment = this.state.selectedComment;
    if (comment) {
      return (
        <DocumentDialog
          key="editor"
          parentId={comment.id}
          onAccept={this.handleUpdateComment}
          onClose={this.closeCommentDialog}
          content={comment.plaintext}
          title="Edit Comment"
          prompt="Comment"
          placeholder="Type comment here"
          maxLength={500}
        />
      );
    }
  }

  private renderLineEditor() {
    const line = this.state.selectedLine;
    if (line) {
      return (
        <MovableLineDialog
          key="editor"
          isOpen={line != null}
          onAccept={this.handleUpdateLine}
          onClose={this.closeLineDialog}
          line={line}
        />
      );
    }
  }

  private renderSettingsEditor() {
    const { board, axisSettingsOpen } = this.state;
    if (board && axisSettingsOpen) {
      return (
        <AxisSettingsDialog
          key="editor"
          board={board}
          onAccept={this.handleUpdateSettings}
          onClose={this.closeSettings}
        />
      );
    }
  }

  private renderRotateHandle() {
    const { board, disableRotate } = this.state;
    const selectedPolygon = board && !disableRotate && !this.props.readOnly
                              ? this.getContent().getOneSelectedPolygon(board) : undefined;
    const rotatablePolygon = selectedPolygon && selectedPolygon.vertices.every(pt => !pt.getAttribute("fixed"))
                              ? selectedPolygon : undefined;
    return (
      <RotatePolygonIcon
        key="rotate-polygon-icon"
        board={board}
        polygon={rotatablePolygon}
        scale={this.props.scale}
        onRotate={this.handleRotatePolygon} />
    );
  }

  private renderInvalidTableDataAlert() {
    const { showInvalidTableDataAlert } = this.state;
    if (!showInvalidTableDataAlert) return;

    return (
      <Alert
          confirmButtonText="OK"
          icon="error"
          intent={Intent.DANGER}
          isOpen={true}
          onClose={this.handleCloseInvalidTableDataAlert}
          canEscapeKeyCancel={true}
          key={"invalid-table-alert"}
      >
        <p>
          Linked data must be numeric. Please edit the table values so that all cells contain numbers.
        </p>
      </Alert>
    );
  }

  private handleCloseInvalidTableDataAlert = () => {
    this.setState({ showInvalidTableDataAlert: false });
  }

  private getContent() {
    return this.props.model.content as GeometryContentModelType;
  }

  private getTableContent(tableId: string) {
    return this.getContent().getTableContent(tableId);
  }

  private initializeContent() {
    const content = this.getContent();
    const domElt = document.getElementById(this.elementId);
    const eltBounds = domElt && domElt.getBoundingClientRect();
    // JSXGraph fails hard if the DOM element doesn't exist or has zero extent
    if (eltBounds && (eltBounds.width > 0) && (eltBounds.height > 0)) {
      const board = content.initializeBoard(this.elementId, this.handleCreateElements);
      if (board) {
        this.handleCreateBoard(board);
        const imageUrl = this.getContent().getLastImageUrl();
        if (imageUrl) {
          this.updateImageUrl(imageUrl);
        }
        this.hackAxisHandlers(board);
      }
      const newState = assign({ syncedChanges: content.changes.length },
                                board ? { board } : null);
      this.setState(newState);
    }
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

  // XXX: Hack - rescaling the board should return the new axes, but they are quickly destroyed and recreated
  // So, any time new axes could be created, we reattach the axis handlers
  private hackAxisHandlers(board: JXG.Board) {
    setTimeout(() => {
      const axes = board.objectsList.filter(el => isAxis(el)) as JXG.Line[];
      axes.forEach(this.handleCreateAxis);
    });
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

  private handleCreateMovableLine = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      this.applyChange(() => {
        const elems = content.addMovableLine(board, [[0, 0], [5, 5]]);
        this.handleCreateElements(elems);
      });
    }
  }

  private closeCommentDialog = () => {
    this.setState({ selectedComment: undefined });
  }

  private closeLineDialog = () => {
    this.setState({ selectedLine: undefined });
  }

  private closeSettings = () => {
    this.setState({ axisSettingsOpen: false });
  }

  // TODO: Create comments after the dialog is complete + prevent empty comments
  private handleCreateComment = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      const commentAnchor = content.getCommentAnchor(board);
      const activeComment = content.getOneSelectedComment(board);
      if (commentAnchor) {
        this.applyChange(() => {
            const elems = content.addComment(board, commentAnchor.id);
            const comment = elems && elems.find(elem => isComment(elem)) as JXG.Text;
            if (comment) {
              this.handleCreateText(comment);
              this.setState({selectedComment: comment});
            }
        });
      } else if (activeComment) {
        this.setState({ selectedComment: activeComment });
      }
    }
  }

  private handleOpenAxisSettings = () => {
    this.setState({ axisSettingsOpen: true });
  }

  private handleUpdateComment = (text: string, commentId: string) => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      content.updateComment(board, commentId, { text });
    }
    this.setState({ selectedComment: undefined });
  }

  private handleUpdateLine = (line: JXG.Line, point1: [number, number], point2: [number, number]) => {
    const { board } = this.state;
    const content = this.getContent();
    const ids = [line.point1.id, line.point2.id];
    const props = [{position: point1}, {position: point2}];
    this.applyChange(() => content.updateObjects(board, ids, props));
    this.setState({ selectedLine: undefined });
  }

  private handleUpdateSettings = (xMax: number, yMax: number, xMin: number, yMin: number) => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      content.rescaleBoard(board, xMax, yMax, xMin, yMin);
      this.hackAxisHandlers(board);
    }
    this.setState({ axisSettingsOpen: false });
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
    if (board && content.canUndo()) {
      const changeset = content.popChangeset();
      if (changeset) {
        board.showInfobox(false);
        this.setState({
          redoStack: this.state.redoStack.concat([changeset])
        });

        // Reverse the changes so they're logged in the order they're undone
        [...changeset].reverse().forEach(changeString => {
          const change = safeJsonParse(changeString);
          Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, change.operation, change,
            content.metadata ? content.metadata.id : "",
            LogEventMethod.UNDO);
        });
      }

      this.hackAxisHandlers(board);
    }

    return true;
  }

  private handleRedo = () => {
    const content = this.getContent();
    const { redoStack, board } = this.state;
    if (board) {
      const changeset = redoStack[redoStack.length - 1];
      if (changeset) {
        board.showInfobox(false);
        content.pushChangeset(changeset);
        this.setState({
          redoStack: redoStack.slice(0, redoStack.length - 1)
        });

        changeset.forEach(changeString => {
          const change = safeJsonParse(changeString);
          Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, change.operation, change,
            content.metadata ? content.metadata.id : "",
            LogEventMethod.REDO);
        });
      }

      this.hackAxisHandlers(board);
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
        // Mark the first and last changes to create a batch
        changes[0] = JSON.stringify({...safeJsonParse(changes[0]), startBatch: true});
        changes[changes.length - 1] = JSON.stringify({...safeJsonParse(changes[changes.length - 1]), endBatch: true});

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
          changes = changes.map((jsonChange) => {
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

  private isDragTileInSameDocument(e: React.DragEvent<HTMLDivElement>) {
    const documentContent = getParentWithTypeName(this.props.model, "DocumentContent") as DocumentContentModelType;
    const documentContentId = documentContent && documentContent.contentId;
    const srcDocId = dragTileSrcDocId(documentContentId);
    return e.dataTransfer.types.findIndex(t => t === srcDocId) >= 0;
  }

  private isAcceptableTileDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { readOnly } = this.props;
    const toolType = extractDragTileType(e.dataTransfer);
    // image drop area is central 80% in each dimension
    const kImgDropMarginPct = 0.1;
    if (!readOnly &&
        ((toolType === "image") ||
        ((toolType === "table") && this.isDragTileInSameDocument(e)))) {
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < eltBounds.bottom - kImgDropMarginY)) {
        return toolType;
      }
    }
    return undefined;
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = this.isAcceptableTileDrag(e);
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
    const tileType = this.isAcceptableTileDrag(e);
    if (tileType) {
      const dragContent = e.dataTransfer.getData(kDragTileContent);
      const parsedContent = safeJsonParse(dragContent);
      const { board } = this.state;
      if (parsedContent && board) {
        if (tileType === "image") {
          this.handleImageTileDrop(e, parsedContent);
        }
        else if (tileType === "table") {
          this.handleTableTileDrop(e, parsedContent);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  private handleImageTileDrop(e: React.DragEvent<HTMLDivElement>, parsedContent: any) {
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
    }
  }

  private getTableActionLinks(links: ILinkProperties): ILinkProperties {
    return { id: links.id, tileIds: [this.props.model.id] };
  }

  private handleTableTileDrop(e: React.DragEvent<HTMLDivElement>, parsedContent: any) {
    const { board } = this.state;
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    if (this.getContent().isLinkedToTable(dragTileId)) return;

    const tableContent = this.getTableContent(dragTileId);
    if (tableContent && parsedContent && board) {
      if (!tableContent.isValidForGeometryLink()) {
        this.setState({ showInvalidTableDataAlert: true });
        return;
      }
      const dataSet = tableContent.getSharedData();
      const geomActionLinks = tableContent.getClientLinks(uniqueId(), dataSet, true);
      this.applyChange(() => {
        const pts = this.getContent().addTableLink(board, dragTileId, dataSet, geomActionLinks);
        pts.forEach(pt => {
          this.handleCreatePoint(pt);
        });
      });
      setTimeout(() => {
        const _tableContent = this.getTableContent(dragTileId);
        const tableActionLinks = this.getTableActionLinks(geomActionLinks);
        _tableContent && _tableContent.addGeometryLink(this.props.model.id, tableActionLinks);
      });
    }
  }

  private handleCreateElements = (elts?: JXG.GeometryElement | JXG.GeometryElement[]) => {
    const _elts = elts ? castArray(elts) : [];
    _elts.forEach(elt => {
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
      else if (isMovableLine(elt)) {
        this.handleCreateLine(elt as JXG.Line);
      }
      else if (isComment(elt) || isMovableLineEquation(elt)) {
        this.handleCreateText(elt as JXG.Text);
      }
      else if (isAxis(elt)) {
        this.handleCreateAxis(elt as JXG.Line);
      }
    });
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
              this.handleCreateElements(result as JXG.GeometryElement | JXG.GeometryElement[]);
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
        if (pt && isSelected && !pt.getAttribute("fixed")) {
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

  private endDragComment(evt: any, dragTarget: JXG.Text, usrDiff: number[]) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;

     // only create a change object if there's actually a change
    if (usrDiff[1] || usrDiff[2]) {
      const id = dragTarget.id;
      const dragStart = this.dragPts[id].initial;
      if (dragStart) {
        const newUsrCoords = JXG.Math.Statistics.add(dragStart.usrCoords, usrDiff) as [number, number];
        this.applyChange(() => content.updateComment(board, id, { position: newUsrCoords }));
      }
    }
  }

  private handleCreateBoard = (board: JXG.Board) => {

    const handlePointerDown = (evt: any) => {
      const coords = getEventCoords(board, evt, this.props.scale);
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

      for (const elt of board.objectsList) {
        if (shouldInterceptPointCreation(elt) && elt.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
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

    const shouldInterceptPointCreation = (elt: JXG.GeometryElement) => {
      return isVisiblePoint(elt)
        || isVisibleEdge(elt)
        || isVisibleMovableLine(elt)
        || isAxisLabel(elt)
        || isComment(elt)
        || isMovableLineEquation(elt);
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

    if (this.props.onSetBoard) {
      this.props.onSetBoard(board);
    }

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  }

  private handleCreateAxis = (axis: JXG.Line) => {
    const handlePointerDown = (evt: any) => {
      if (!this.props.readOnly) {
        this.handleOpenAxisSettings();
      }
    };

    axis.label && axis.label.on("down", handlePointerDown);
  }

  private handleCreatePoint = (point: JXG.Point) => {

    const handlePointerDown = (evt: any) => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const { board } = this.state;
      if (!board) return;
      const id = point.id;
      const coords = copyCoords(point.coords);
      const isPointDraggable = !this.props.readOnly && !point.getAttribute("fixed");
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
        this.dragPts = isPointDraggable ? { [id]: { initial: coords } } : {};
        this.lastPointDown = { evt, coords };

        // click on selected element - deselect if appropriate modifier key is down
        if (geometryContent.isSelected(id)) {
          if (hasSelectionModifier(evt)) {
            geometryContent.deselectElement(id);
          }

          if (isMovableLineControlPoint(point)) {
            handleControlPointClick(point, geometryContent);
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

        if (isPointDraggable) {
          this.beginDragSelectedPoints(evt, point);
        }

        this.lastSelectDown = evt;
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly || point.getAttribute("fixed")) return;

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

  private handleCreateLine = (line: JXG.Line) => {

    function getVertices() {
      return filter(line.ancestors, ancestor => isPoint(ancestor)) as JXG.Point[];
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
      if (!board || (line !== getClickableObjectUnderMouse(board, evt, !readOnly, scale))) return;

      const content = this.getContent();
      const vertices = getVertices();
      const allSelected = vertices.every(vertex => content.isSelected(vertex.id));
      // deselect other elements unless appropriate modifier key is down
      if (board && !allSelected) {
        if (!hasSelectionModifier(evt)) {
          content.deselectAll(board);
        }
        vertices.forEach(vertex => content.selectElement(vertex.id));

        content.selectElement(line.id);
      }
      // we can't prevent JSXGraph from dragging the edge, so don't deselect
      // else if (hasSelectionModifier(evt)) {
      //   vertices.forEach(vertex => content.deselectElement(vertex.id));
      // }

      if (!readOnly) {
        // point handles vertex drags
        this.isVertexDrag = isInVertex(evt);
        if (!this.isVertexDrag) {
          this.beginDragSelectedPoints(evt, line);
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
        this.dragSelectedPoints(evt, line, usrDiff);
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
          this.endDragSelectedPoints(evt, line, usrDiff);
        }
      }
      // remove this polygon's vertices from the dragPts map
      vertices.forEach(vertex => delete this.dragPts[vertex.id]);
      this.isVertexDrag = false;
    };

    line.on("down", handlePointerDown);
    line.on("drag", handleDrag);
    line.on("up", handlePointerUp);
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
      let selectPolygon = false;
      // let deselectVertices = false;
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (board && !hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        selectPolygon = true;
        this.lastSelectDown = evt;
      }
      // we can't prevent JSXGraph from dragging the polygon, so don't deselect
      // else if (!inVertex && allVerticesSelected) {
      //   if (board && hasSelectionModifier(evt)) {
      //     deselectVertices = true;
      //   }
      // }
      if (selectPolygon) {
        geometryContent.selectElement(polygon.id);
        each(polygon.ancestors, point => {
          const pt = point as JXG.Point;
          if (board && !inVertex) {
            geometryContent.selectElement(pt.id);
          }
        });
      }

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
    edges.forEach(edge => this.handleCreateLine(edge));

    polygon.on("down", handlePointerDown);
    polygon.on("drag", handleDrag);
    polygon.on("up", handlePointerUp);
  }

  private handleCreateVertexAngle = (angle: JXG.Angle) => {
    updateVertexAngle(angle);
  }

  private handleCreateText = (text: JXG.Text) => {
    const handlePointerDown = (evt: any) => {
      const content = this.getContent();
      const { readOnly } = this.props;
      const { board } = this.state;
      if (isComment(text)) {
        const coords = copyCoords(text.coords);
        if (this.isDoubleClick(this.lastPointDown, { evt, coords }) && !readOnly) {
          this.setState({selectedComment: text});
          this.lastPointDown = undefined;
        } else {
          this.lastPointDown = { evt, coords };
        }

        if (board) {
          if (!hasSelectionModifier(evt)) {
            content.deselectAll(board);
          }

          content.selectElement(text.id);
        }
      } else if (isMovableLineEquation(text)) {
        if (board) {
          const parentLine = values(text.ancestors)[0] as JXG.Line;
          if (parentLine && !readOnly) {
            this.setState({selectedLine: parentLine});
          }
        }
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly) return;

      const id = text.id;
      let dragEntry = this.dragPts[id];
      if (!dragEntry) {
        dragEntry = this.dragPts[id] = { initial: copyCoords(text.coords) };
      }
      dragEntry.final = copyCoords(text.coords);
    };

    const handlePointerUp = (evt: any) => {
      const id = text.id;
      const dragEntry = this.dragPts[id];
      if (!dragEntry) { return; }

      if (!this.props.readOnly) {
        dragEntry.final = copyCoords(text.coords);
        const usrDiff = JXG.Math.Statistics.subtract(dragEntry.final.usrCoords,
                                                     dragEntry.initial.usrCoords) as number[];
        this.endDragComment(evt, text, usrDiff);
      }

      delete this.dragPts[id];
    };

    text.on("down", handlePointerDown);
    text.on("drag", handleDrag);
    text.on("up", handlePointerUp);
  }
}
