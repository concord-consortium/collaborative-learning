import { castArray, debounce, each, filter, find, keys as _keys, throttle, values } from "lodash";
import { observe } from "mobx";
import { inject, observer } from "mobx-react";
import { getSnapshot, onSnapshot } from "mobx-state-tree";
import objectHash from "object-hash";
import React from "react";
import { SizeMeProps } from "react-sizeme";
import { BaseComponent } from "../../base";
import { DocumentContentModelType } from "../../../models/document/document-content";
import { getTableLinkColors } from "../../../models/tools/table-links";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import {
  GeometryContentModelType, IAxesParams, isGeometryContentReady, setElementColor
} from "../../../models/tools/geometry/geometry-content";
import { convertModelObjectsToChanges } from "../../../models/tools/geometry/geometry-migrate";
import {
  cloneGeometryObject, GeometryObjectModelType, isPointModel
} from "../../../models/tools/geometry/geometry-model";
import { copyCoords, getEventCoords, getAllObjectsUnderMouse, getClickableObjectUnderMouse,
          isDragTargetOrAncestor } from "../../../models/tools/geometry/geometry-utils";
import { RotatePolygonIcon } from "./rotate-polygon-icon";
import { getPointsByCaseId } from "../../../models/tools/geometry/jxg-board";
import { ESegmentLabelOption, JXGCoordPair } from "../../../models/tools/geometry/jxg-changes";
import { kSnapUnit } from "../../../models/tools/geometry/jxg-point";
import {
  getAssociatedPolygon, getPointsForVertexAngle, getPolygonEdges
} from "../../../models/tools/geometry/jxg-polygon";
import {
  isAxis, isAxisLabel, isComment, isFreePoint, isImage, isLine, isMovableLine,
  isMovableLineControlPoint, isMovableLineLabel, isPoint, isPolygon, isVertexAngle,
  isVisibleEdge, isVisibleMovableLine, isVisiblePoint, kGeometryDefaultPixelsPerUnit
} from "../../../models/tools/geometry/jxg-types";
import {
  getVertexAngle, updateVertexAngle, updateVertexAnglesFromObjects
} from "../../../models/tools/geometry/jxg-vertex-angle";
import { injectGetTableLinkColorsFunction } from "../../../models/tools/geometry/jxg-table-link";
import { extractDragTileType, kDragTileContent, kDragTileId, dragTileSrcDocId } from "../tool-tile";
import { ImageMapEntryType, gImageMap } from "../../../models/image-map";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";
import { getParentWithTypeName } from "../../../utilities/mst-utils";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { getDataSetBounds, IDataSet } from "../../../models/data/data-set";
import AxisSettingsDialog from "./axis-settings-dialog";
import { EditableTileTitle } from "../editable-tile-title";
import LabelSegmentDialog from "./label-segment-dialog";
import MovableLineDialog from "./movable-line-dialog";
import placeholderImage from "../../../assets/image_placeholder.png";
import { LinkTableButton } from "./link-table-button";
import ErrorAlert from "../../utilities/error-alert";
import SingleStringDialog from "../../utilities/single-string-dialog";

import "./geometry-tool.sass";

export interface IGeometryContentProps extends IGeometryProps {
  onSetBoard: (board: JXG.Board) => void;
  onSetActionHandlers: (handlers: IActionHandlers) => void;
  onContentChange: () => void;
  onLinkTableButtonClick?: () => void;
}
export interface IProps extends IGeometryContentProps, SizeMeProps {
  isLinkButtonEnabled: boolean;
  measureText: (text: string) => number;
}

// cf. https://mariusschulz.com/blog/mapped-type-modifiers-in-typescript#removing-the-readonly-mapped-type-modifier
type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
};

interface IState extends Mutable<SizeMeProps> {
  scale?: number;
  board?: JXG.Board;
  content?: GeometryContentModelType;
  newElements?: JXG.GeometryElement[];
  isLoading?: boolean;
  isEditingTitle?: boolean;
  imageContentUrl?: string;
  imageFilename?: string;
  imageEntry?: ImageMapEntryType;
  disableRotate: boolean;
  redoStack: string[][];
  selectedComment?: JXG.Text;
  selectedLine?: JXG.Line;
  showSegmentLabelDialog?: boolean;
  showInvalidTableDataAlert?: boolean;
  axisSettingsOpen: boolean;
}

interface JXGPtrEvent {
  evt: any;
  coords: JXG.Coords;
}

interface IDragPoint {
  initial: JXG.Coords;
  final?: JXG.Coords;
  snapToGrid?: boolean;
}

injectGetTableLinkColorsFunction(getTableLinkColors);

interface IPasteContent {
  pasteId: string;
  isSameTile: boolean;
  objects: GeometryObjectModelType[];
}

let sInstanceId = 0;

@inject("stores")
@observer
export class GeometryContentComponent extends BaseComponent<IProps, IState> {

  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    const { model: { content }, scale } = nextProps;
    if (!prevState.board) { return null; }

    const nextState: IState = {} as any;

    const { size } = nextProps;
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

    return nextState;
  };

  public state: IState = {
          size: { width: null, height: null },
          disableRotate: false,
          redoStack: [],
          axisSettingsOpen: false,
        };

  private instanceId = ++sInstanceId;
  private elementId: string;
  private domElement: HTMLDivElement | null;
  private _isMounted: boolean;

  private disposers: any[];

  private lastBoardDown: JXGPtrEvent;
  private lastPointDown?: JXGPtrEvent;
  private lastSelectDown?: any;
  private dragPts: { [id: string]: IDragPoint } = {};
  private isVertexDrag: boolean;

  private lastPasteId: string;
  private lastPasteCount = 0;

  private suspendSnapshotResponse = 0;
  private boardPromise: Promise<JXG.Board> | undefined;

  private debouncedUpdateImage = debounce((url: string, filename?: string) => {
            gImageMap.getImage(url, { filename })
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
                // Update legacy Firestore URLs, if they exist
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

    this.elementId = `${context}-${model.id}-${this.instanceId}`;

    if (onSetActionHandlers) {
      const handlers: IActionHandlers = {
        handleArrows: this.handleArrowKeys,
        handleCut: this.handleCut,
        handleCopy: this.handleCopy,
        handlePaste: this.handlePaste,
        handleDuplicate: this.handleDuplicate,
        handleDelete: this.handleDelete,
        handleUndo: this.handleUndo,
        handleRedo: this.handleRedo,
        handleToggleVertexAngle: this.handleToggleVertexAngle,
        handleCreateLineLabel: this.handleCreateLineLabel,
        handleCreateMovableLine: this.handleCreateMovableLine,
        handleCreateComment: this.handleCreateComment,
        handleUploadImageFile: this.handleUploadBackgroundImage,
        handleRequestTableLink: this.handleTableTileLinkRequest,
        handleRequestTableUnlink: this.handleTableTileUnlinkRequest
      };
      onSetActionHandlers(handlers);
    }
  }

  public componentDidMount() {
    this._isMounted = true;
    this.disposers = [];

    this.initializeContent();

    const metadata = this.getContent().metadata;
    this.props.onRegisterToolApi({
      getTitle: () => metadata.title,
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
        const { board } = this.state;
        const geometryContent = this.props.model.content as GeometryContentModelType;
        const selectedIds = board && geometryContent?.getSelectedIds(board) || [];
        return JSON.stringify(selectedIds);
      },
      setSelectionHighlight: (selectionInfo: string, isHighlighted: boolean) => {
        const { board } = this.state;
        const content = this.getContent();
        if (board && content) {
          const selectedIds: string[] = JSON.parse(selectionInfo);
          if (isHighlighted) {
            board.objectsList.forEach(obj => {
              if (content.isSelected(obj.id)) {
                setElementColor(board, obj.id, false);
              }
            });
            selectedIds.forEach(key => {
              setElementColor(board, key, true);
            });
          } else {
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
      },
      isLinked: () => {
        return this.getContent().isLinked;
      },
      // getLinkIndex: (index?: number) => {
      //   const tableLink = (index != null) && (index < metadata.linkedTableCount)
      //                       ? metadata.links[index]
      //                       : undefined;
      //   return tableLink?.id ? getLinkedTableIndex(tableLink?.id) : -1;
      // },
      getLinkedTables: () => {
        return this.getContent().linkedTableIds;
      },
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      }
    });

    this.disposers.push(onSnapshot(this.getContent(), () => {
      if (!this.suspendSnapshotResponse) {
        this.destroyBoard();
        this.setState({ board: undefined });
        this.initializeBoard();
      }
    }));
  }

  public componentDidUpdate() {
    // if we didn't initialize before now, try again
    if (!this.state.board && !this.boardPromise) {
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
    this.disposers.forEach(disposer => disposer());

    if (this.state.board) {
      // delay so any asynchronous JSXGraph actions have time to complete
      setTimeout(() => this.destroyBoard());
    }

    this.props.onUnregisterToolApi();

    this._isMounted = false;
  }

  public render() {
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const isLinkedClass = this.getContent().isLinked ? "is-linked" : "";
    const classes = `geometry-content ${editableClass} ${isLinkedClass}`;
    return ([
      this.renderCommentEditor(),
      this.renderLineEditor(),
      this.renderSettingsEditor(),
      this.renderSegmentLabelDialog(),
      <div id={this.elementId} key="jsxgraph"
          className={classes}
          ref={elt => this.domElement = elt}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} />,
      this.renderRotateHandle(),
      this.renderTitleArea(),
      this.renderInvalidTableDataAlert()
    ]);
  }

  private renderCommentEditor() {
    const comment = this.state.selectedComment;
    if (comment) {
      return (
        <SingleStringDialog
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

  private renderSegmentLabelDialog() {
    const content = this.getContent();
    const { board, showSegmentLabelDialog } = this.state;
    if (board && showSegmentLabelDialog) {
      const segment = content.getOneSelectedSegment(board);
      const points = content.selectedObjects(board).filter(obj => isPoint(obj));
      const polygon = segment && getAssociatedPolygon(segment);
      if (!polygon || !segment || (points.length !== 2)) return;
      const handleClose = () => this.setState({ showSegmentLabelDialog: false });
      const handleAccept = (poly: JXG.Polygon, pts: [JXG.Point, JXG.Point], labelOption: ESegmentLabelOption) =>
                            {
                              this.handleLabelSegment(poly, pts, labelOption);
                              handleClose();
                            };
      return (
        <LabelSegmentDialog
          key="editor"
          board={board}
          polygon={polygon}
          points={points as [JXG.Point, JXG.Point]}
          onAccept={handleAccept}
          onClose={handleClose}
        />
      );
    }
  }

  private renderRotateHandle() {
    const { board, disableRotate } = this.state;
    const selectedPolygon = board && !disableRotate && !this.props.readOnly
                              ? this.getContent().getOneSelectedPolygon(board) : undefined;
    const rotatablePolygon = selectedPolygon &&
                              selectedPolygon.vertices.every((pt: JXG.Point) => !pt.getAttribute("fixed"))
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

  private handleBeginEditTitle = () => {
    this.setState({ isEditingTitle: true });
  };

  private handleTitleChange = (title?: string) => {
    title && this.applyChange(() => this.getContent().updateTitle(this.state.board, title));
    this.setState({ isEditingTitle: false });
  };

  private renderTitleArea() {
    return (
      <div className="title-area-wrapper" key="title-area">
        <div className="title-area">
          {this.renderTitle()}
          {this.renderTableLinkButton()}
        </div>
      </div>
    );
  }

  private renderTitle() {
    const getTitle = () => this.getContent().title || "";
    const { measureText, readOnly, size, scale } = this.props;
    return (
      <EditableTileTitle key="geometry-title" size={size} scale={scale} getTitle={getTitle}
                              readOnly={readOnly} measureText={measureText}
                              onBeginEdit={this.handleBeginEditTitle} onEndEdit={this.handleTitleChange} />
    );
  }

  private renderTableLinkButton() {
    const { isLinkButtonEnabled, onLinkTableButtonClick } = this.props;
    return (!this.state.isEditingTitle && !this.props.readOnly &&
      <LinkTableButton key="link-button" isEnabled={isLinkButtonEnabled} onClick={onLinkTableButtonClick}/>
    );
  }

  private renderInvalidTableDataAlert() {
    const { showInvalidTableDataAlert } = this.state;
    if (!showInvalidTableDataAlert) return;

    return (
      <ErrorAlert
        content="Linked data must be numeric. Please edit the table values so that all cells contain numbers."
        onClose={this.handleCloseInvalidTableDataAlert}
      />
    );
  }

  private handleCloseInvalidTableDataAlert = () => {
    this.setState({ showInvalidTableDataAlert: false });
  };

  private getContent() {
    return this.props.model.content as GeometryContentModelType;
  }

  private async initializeBoard(): Promise<JXG.Board> {
    return new Promise((resolve, reject) => {
      isGeometryContentReady(this.getContent()).then(() => {
        const board = this.getContent().initializeBoard(this.elementId, this.handleCreateElements);
        if (board) {
          this.handleCreateBoard(board);
          const { url, filename } = this.getContent().bgImage || {};
          if (url) {
            this.updateImageUrl(url, filename);
          }
          this.setState({ board });
          resolve(board);
        }
      });
    });
  }

  private destroyBoard() {
    const { board } = this.state;
    board && JXG.JSXGraph.freeBoard(board);
  }

  private async initializeContent() {
    const content = this.getContent();
    content.metadata.setSharedSelection(this.stores.selection);
    const domElt = document.getElementById(this.elementId);
    const eltBounds = domElt && domElt.getBoundingClientRect();
    // JSXGraph fails hard if the DOM element doesn't exist or has zero extent
    if (eltBounds && (eltBounds.width > 0) && (eltBounds.height > 0)) {
      this.boardPromise = this.initializeBoard();
      await this.boardPromise;
    }
    // if we haven't been assigned a title already, request one now
    // we set the title without updating the content, so the title is ephemeral
    if (!content.metadata.title) {
      const { model: { id }, onRequestUniqueTitle } = this.props;
      const title = onRequestUniqueTitle(id);
      title && content.metadata.setTitle(title);
    }
  }

  private getBackgroundImage(_board?: JXG.Board) {
    const board = _board || this.state.board;
    if (!board) return;
    const images = this.getContent().findObjects(board, isImage) as JXG.Image[];
    return images.length > 0
            ? images[images.length - 1]
            : undefined;
  }

  private updateImageUrl(url: string, filename?: string) {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    this.debouncedUpdateImage(url, filename);
  }

  private rescaleBoardAndAxes(params: IAxesParams) {
    const { board } = this.state;
    if (board) {
      this.applyChange(() => {
        const content = this.getContent();
        const axes = content.rescaleBoard(board, params);
        if (axes) {
          axes.forEach(this.handleCreateAxis);
        }
      });
    }
  }

  private autoRescaleBoardAndAxes(dataSet: IDataSet) {
    const { board } = this.state;
    if (board && (dataSet.attributes.length >= 2) && (dataSet.cases.length >= 1)) {
      const dataBounds = getDataSetBounds(dataSet);
      if (dataBounds.every((b, i) => (i >= 2) || (isFinite(b.min) && isFinite(b.max)))) {
        const xDataMin = Math.floor(dataBounds[0].min - 1);
        const xDataMax = Math.ceil(dataBounds[0].max + 1);
        const yDataMin = Math.floor(dataBounds[1].min - 1);
        const yDataMax = Math.ceil(dataBounds[1].max + 1);

        const boundingBox = board.getBoundingBox();
        let [xMin, yMax, xMax, yMin] = boundingBox;
        if (xDataMin < xMin) xMin = xDataMin;
        if (xDataMax > xMax) xMax = xDataMax;
        if (yDataMin < yMin) yMin = yDataMin;
        if (yDataMax > yMax) yMax = yDataMax;

        this.rescaleBoardAndAxes({ xMax, yMax, xMin, yMin });
      }
    }
  }

  private handleArrowKeys = (e: React.KeyboardEvent, keys: string) => {
    const { board } = this.state;
    const selectedObjects = board && this.getContent().selectedObjects(board);
    const selectedPoints = selectedObjects && selectedObjects.filter(isPoint);
    const hasSelectedPoints = selectedPoints ? selectedPoints.length > 0 : false;
    let dx = 0;
    let dy = 0;
    switch (keys) {
      case "left":  dx = -kSnapUnit; break;
      case "right": dx =  kSnapUnit; break;
      case "up":    dy =  kSnapUnit; break;
      case "down":  dy = -kSnapUnit; break;
    }
    if (!e.repeat && hasSelectedPoints && (dx || dy)) {
      const nudge = () => this.moveSelectedPoints(dx, dy);
      (throttle(nudge, 250))();
    }
    return hasSelectedPoints;
  };

  private handleToggleVertexAngle = () => {
    const { board } = this.state;
    const selectedObjects = board && this.getContent().selectedObjects(board);
    const selectedPoints = selectedObjects?.filter(isPoint);
    const selectedPoint = selectedPoints?.[0];
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
  };

  private handleCreateMovableLine = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      this.applyChange(() => {
        const elems = content.addMovableLine(board, [[0, 0], [5, 5]]);
        this.handleCreateElements(elems);
      });
    }
  };

  private closeCommentDialog = () => {
    this.setState({ selectedComment: undefined });
  };

  private closeLineDialog = () => {
    this.setState({ selectedLine: undefined });
  };

  private closeSettings = () => {
    this.setState({ axisSettingsOpen: false });
  };

  private handleCreateLineLabel = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      const segment = content.getOneSelectedSegment(board);
      if (segment) {
        this.setState({ showSegmentLabelDialog: true });
      }
    }
  };
      // Currently, we don't allow commenting of polygon edges because the commenting feature
      // requires that objects have persistent/unique IDs, but polygon edges don't have such
      // IDs because their IDs are generated by JSXGraph.
      // If we ever support commenting on polygon segments, then we can change the Comment
      // button logic when a line segment is selected.
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
          const comment = elems?.find(isComment);
          if (comment) {
            this.handleCreateText(comment);
            this.setState({selectedComment: comment});
          }
        });
      } else if (activeComment) {
        this.setState({ selectedComment: activeComment });
      }
    }
  };

  private handleLabelSegment =
            (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ESegmentLabelOption) => {
    this.applyChange(() => {
      this.getContent().updatePolygonSegmentLabel(this.state.board, polygon, points, labelOption);
    });
  };

  private handleOpenAxisSettings = () => {
    this.setState({ axisSettingsOpen: true });
  };

  private handleUpdateComment = (text: string, commentId?: string) => {
    const { board } = this.state;
    const content = this.getContent();
    if (board) {
      this.applyChange(() => {
        content.updateObjects(board, [commentId || ""], { text });
      });
    }
    this.setState({ selectedComment: undefined });
  };

  private handleUpdateLine = (line: JXG.Line, point1: [number, number], point2: [number, number]) => {
    const { board } = this.state;
    const content = this.getContent();
    const ids = [line.point1.id, line.point2.id];
    const props = [{position: point1}, {position: point2}];
    this.applyChange(() => content.updateObjects(board, ids, props));
    this.setState({ selectedLine: undefined });
  };

  private handleUpdateSettings = (params: IAxesParams) => {
    this.rescaleBoardAndAxes(params);
    this.setState({ axisSettingsOpen: false });
  };

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
      this.applyChange(() => {
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
      });
    }
  };

  private handleDelete = () => {
    const content = this.getContent();
    const { readOnly } = this.props;
    const { board } = this.state;
    if (!readOnly && board && content.hasSelection()) {
      this.applyChange(() => {
        content.deleteSelection(board);
      });
      return true;
    }
  };

  private handleDuplicate = () => {
    // copy the selected objects locally without affecting the clipboard
    const copiedObjects = (this.handleCopy(false) || []) as GeometryObjectModelType[];
    if (copiedObjects?.length) {
      // hash the copied objects to create a pasteId tied to the content
      const excludeKeys = (key: string) => ["id", "anchors", "points"].includes(key);
      const hash = objectHash(copiedObjects.map(obj => getSnapshot(obj)), { excludeKeys });
      this.handlePaste({ pasteId: hash, isSameTile: true, objects: copiedObjects });
    }
  };

  private handleUndo = () => {
    // const content = this.getContent();
    // const { board } = this.state;
    // if (board && content.canUndo()) {
    //   const changeset = content.popChangeset();
    //   if (changeset) {
    //     board.showInfobox(false);
    //     this.setState(state => ({ redoStack: state.redoStack.concat([changeset]) }));

    //     // Reverse the changes so they're logged in the order they're undone
    //     [...changeset].reverse().forEach(changeString => {
    //       const change = safeJsonParse<JXGChange>(changeString);
    //       if (change) {
    //         Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, change.operation, change,
    //                               content.metadata?.id || "", LogEventMethod.UNDO);
    //       }
    //     });
    //   }
    // }

    return true;
  };

  private handleRedo = () => {
    // const content = this.getContent();
    // const { redoStack, board } = this.state;
    // if (board) {
    //   const changeset = redoStack[redoStack.length - 1];
    //   if (changeset) {
    //     board.showInfobox(false);
    //     content.pushChangeset(changeset);
    //     this.setState({
    //       redoStack: redoStack.slice(0, redoStack.length - 1)
    //     });

    //     changeset.forEach(changeString => {
    //       const change = safeJsonParse<JXGChange>(changeString);
    //       if (change) {
    //         Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, change.operation, change,
    //                               content.metadata?.id || "", LogEventMethod.REDO);
    //       }
    //     });
    //   }
    // }

    return true;
  };

  // handleCopy is being called with toClipboard as an event when cmd+c is pressed
  private handleCopy = (toClipboard = true) => {
    const content = this.getContent();
    const { board } = this.state;
    if (board && content.hasSelection()) {
      const { clipboard } = this.stores;
      const objects = content.copySelection(board);
      if (toClipboard) {
        const clipObjects = objects.map(obj => getSnapshot(obj));
        clipboard.clear();
        clipboard.addTileContent(content.metadata.id, content.type, clipObjects, this.stores);
        return true;
      }
      return objects;
    }
  };

  private handleCut = () => {
    this.handleCopy();
    return this.handleDelete();
  };

  private getPasteContent(pasteContent?: IPasteContent): IPasteContent {
    // We're getting some weird object as pasteContent, so make sure we have the content we actually need
    if (pasteContent && Object.hasOwn(pasteContent, "objects")
      && Object.hasOwn(pasteContent, "pasteId") && Object.hasOwn(pasteContent, "isSameTile")) {
      return pasteContent;
    }

    const content = this.getContent();
    const { clipboard } = this.stores;
    const objects = clipboard.getTileContent(content.type);
    const pasteId = clipboard.getTileContentId(content.type) || objectHash(objects);
    const isSameTile = clipboard.isSourceTile(content.type, content.metadata.id);
    return { pasteId, isSameTile, objects };
  }

  // pasteContent seems to be getting an event object, not IPasteContent
  private handlePaste = (pasteContent?: IPasteContent) => {
    const content = this.getContent();
    const { readOnly } = this.props;
    const { board } = this.state;
    if (!readOnly && board) {
      const { pasteId, isSameTile, objects } = this.getPasteContent(pasteContent);
      if (objects?.length) {
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

        // map old ids to new ones
        const idMap: Record<string, string> = {};
        objects.forEach((obj => idMap[obj.id] = uniqueId()));

        // To handle multiple pastes of the same clipboard content,
        // we must re-map ids to avoid duplication. We also offset
        // the locations of points slightly so multiple pastes
        // don't appear exactly on top of each other.
        const objectsToPaste = objects.map((obj => {
          const kPixelOffset = 30 * this.lastPasteCount;
          const offset = { x: Math.round(10 * kPixelOffset / board.unitX) / 10,
                           y: -Math.round(10 * kPixelOffset / board.unitY) / 10 };
          return cloneGeometryObject(obj, { idMap, offset });
        })).filter(obj => !!obj) as GeometryObjectModelType[];

        this.applyChange(() => content.addObjectModels(objectsToPaste));

        const changesToApply = convertModelObjectsToChanges(objectsToPaste);
        content.applyBatchChanges(board, changesToApply, this.handleCreateElements);

        const newPointIds = objects.filter(obj => isPointModel(obj)).map(obj => obj.id);
        if (newPointIds.length) {
          content.deselectAll(board);
          content.selectObjects(board, newPointIds);
        }
      }
      return true;
    }
  };

  private isDragTileInSameDocument(e: React.DragEvent<HTMLDivElement>) {
    const documentContent = getParentWithTypeName(this.props.model, "DocumentContent") as DocumentContentModelType;
    const documentContentId = documentContent && documentContent.contentId;
    const srcDocId = dragTileSrcDocId(documentContentId);
    return e.dataTransfer.types.findIndex(t => t === srcDocId) >= 0;
  }

  private isAcceptableTileDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { appConfig } = this.stores;
    const { readOnly } = this.props;
    const canAcceptTableDrops = appConfig.isFeatureSupported("GeometryLinkedTables") &&
                                  this.isDragTileInSameDocument(e);
    const toolType = extractDragTileType(e.dataTransfer);
    // image drop area is central 80% in each dimension
    const kImgDropMarginPct = 0.1;
    if (!readOnly &&
        ((toolType === "image") ||
        ((toolType === "table") && canAcceptTableDrops))) {
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
  };

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = this.isAcceptableTileDrag(e);
    this.props.onSetCanAcceptDrop(isAcceptableDrag ? this.props.model.id : undefined);
    if (isAcceptableDrag) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
  };

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.props.onSetCanAcceptDrop();
  };

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
          this.handleTableTileDrop(e);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  private handleImageTileDrop(e: React.DragEvent<HTMLDivElement>, parsedContent: any) {
    const { board } = this.state;
    if (parsedContent && board) {
        const droppedContent = parsedContent.content;
        const url = droppedContent.url;
        if (url) {
          gImageMap.getImage(url)
            .then(image => this.setBackgroundImage(image));
        }
    }
  }

  private handleUploadBackgroundImage = (file: File) => {
    this.setState({ isLoading: true }, () => {
      gImageMap.addFileImage(file)
        .then(image => this.setBackgroundImage(image));
    });
  };

  private setBackgroundImage(image: ImageMapEntryType) {
    const { board } = this.state;
    const contentUrl = image.contentUrl;
    if (!board || !this._isMounted || !contentUrl) return;
    const geometryContent = this.getContent();
    const width = image.width! / kGeometryDefaultPixelsPerUnit;
    const height = image.height! / kGeometryDefaultPixelsPerUnit;
    this.applyChange(() => {
      const properties = image.filename ? { filename: image.filename } : undefined;
      geometryContent.addImage(board, contentUrl, [0, 0], [width, height], properties);
    });
    this.updateImageUrl(contentUrl);
    if (this.props.size.height && image.height && (image.height > this.props.size.height)) {
      this.props.onRequestRowHeight(this.props.model.id, image.height);
    }
  }

  private handleTableTileDrop(e: React.DragEvent<HTMLDivElement>) {
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    if (dragTileId) {
      this.handleTableTileLinkRequest(dragTileId);
    }
  }

  private handleTableTileLinkRequest = (tableId: string) => {
    this.getContent().addLinkedTable(tableId);
  };

  private handleTableTileUnlinkRequest = (tableId: string) => {
    this.getContent().removeLinkedTable(tableId);
  };

  private handleCreateElements = (elts?: JXG.GeometryElement | JXG.GeometryElement[]) => {
    const _elts = elts ? castArray(elts) : [];
    _elts.forEach(elt => {
      if (this.props.readOnly && (elt != null)) {
        elt.setAttribute({ fixed: true });
      }
      if (isPoint(elt)) {
        this.handleCreatePoint(elt);
      }
      else if (isPolygon(elt)) {
        this.handleCreatePolygon(elt);
      }
      else if (isVertexAngle(elt)) {
        this.handleCreateVertexAngle(elt);
      }
      else if (isMovableLine(elt)) {
        this.handleCreateLine(elt);
      }
      else if (isComment(elt) || isMovableLineLabel(elt)) {
        this.handleCreateText(elt);
      }
      else if (isAxis(elt)) {
        this.handleCreateAxis(elt);
      }
    });
  };

  private applyChange(change: () => void) {
    try {
      ++this.suspendSnapshotResponse;
      change();
      // this.setState({ redoStack: [] });
    }
    finally {
      --this.suspendSnapshotResponse;
    }
  }

  // private applyBatchChanges(changes: string[]) {
  //   this.applyChanges(() => {
  //     changes.forEach(change => {
  //       const content = this.getContent();
  //       const { board } = this.state;
  //       if (board) {
  //         const parsedChange = safeJsonParse<JXGChange>(change);
  //         if (parsedChange) {
  //           const result = content.applyChange(board, parsedChange);
  //           if (result) {
  //             this.handleCreateElements(result as JXG.GeometryElement | JXG.GeometryElement[]);
  //           }
  //         }
  //       }
  //     });
  //   });
  // }

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

  private moveSelectedPoints(dx: number, dy: number) {
    this.beginDragSelectedPoints();
    if (this.endDragSelectedPoints(undefined, undefined, [0, dx, dy])) {
      const { board } = this.state;
      const content = this.getContent();
      if (board) {
        Object.keys(this.dragPts || {})
              .forEach(id => {
                const elt = board.objects[id];
                if (elt && content.isSelected(id)) {
                  board.updateInfobox(elt);
                }
              });
      }
      return true;
    }
    return false;
  }

  private beginDragSelectedPoints(evt?: any, dragTarget?: JXG.GeometryElement) {
    const { board } = this.state;
    const content = this.getContent();
    if (board && !hasSelectionModifier(evt || {})) {
      content.metadata.selection.forEach((isSelected: boolean, id: string) => {
        const obj = board.objects[id];
        const pt = isPoint(obj) ? obj : undefined;
        if (pt && isSelected && !pt.getAttribute("fixed")) {
          this.dragPts[id] = {
            initial: copyCoords(pt.coords),
            snapToGrid: pt.getAttribute("snapToGrid")
          };
        }
      });
    }
  }

  private dragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement | undefined, usrDiff: number[]) {
    const { board } = this.state;
    if (!board) return;

    each(this.dragPts, (entry, id) => {
      if (entry) {
        const obj = board.objects[id];
        const pt = isPoint(obj) ? obj : undefined;
        // move the points not dragged by JSXGraph
        if (pt && !isDragTargetOrAncestor(pt, dragTarget)) {
          const newUsrCoords = JXG.Math.Statistics.add(entry.initial.usrCoords, usrDiff) as number[];
          pt.setAttribute({ snapToGrid: false });
          pt.setPosition(JXG.COORDS_BY_USER, newUsrCoords);
          entry.final = copyCoords(pt.coords);
        }
      }
    });

    const affectedObjects = _keys(this.dragPts).map(id => board.objects[id]);
    updateVertexAnglesFromObjects(affectedObjects);
  }

  private endDragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement | undefined, usrDiff: number[]) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return false;

    let didDragPoints = false;
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
          const pt = isPoint(obj) ? obj : undefined;
          if (pt) {
            const newUsrCoords = JXG.Math.Statistics.add(entry.initial.usrCoords, usrDiff) as number[];
            ids.push(id);
            props.push({ position: newUsrCoords });
            didDragPoints = true;
          }
        }
      });

      this.applyChange(() => content.updateObjects(board, ids, props));
    }
    this.dragPts = {};

    return didDragPoints;
  }

  private endDragText(evt: any, dragTarget: JXG.Text, dragEntry: IDragPoint) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;

    // nothing to do if there's no change
    if (!dragEntry.final) return;
    if ((dragEntry.final.usrCoords[1] === dragEntry.initial.usrCoords[1]) &&
        (dragEntry.final.usrCoords[2] === dragEntry.initial.usrCoords[2])) return;

    const position = dragEntry.final.usrCoords.slice(1) as JXGCoordPair;
    this.applyChange(() => content.updateObjects(board, dragTarget.id, { position }));
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
          const point = geometryContent.addPoint(board, [x, y], props);
          if (point) {
            this.handleCreatePoint(point);
          }
        });
      }
    };

    const shouldInterceptPointCreation = (elt: JXG.GeometryElement) => {
      return isPolygon(elt)
          || isVisiblePoint(elt)
          || isVisibleEdge(elt)
          || isVisibleMovableLine(elt)
          || isAxisLabel(elt)
          || isComment(elt)
          || isMovableLineLabel(elt);
    };

    // synchronize initial selection
    const content = this.getContent();
    content.findObjects(board, (elt: JXG.GeometryElement) => isPoint(elt))
      .forEach(pt => {
        if (content.isSelected(pt.id)) {
          setElementColor(board, pt.id, true);
        }
      });

    // synchronize selection changes
    this.disposers.push(observe(content.metadata.selection, (change: any) => {
      const { board: _board } = this.state;
      if (_board) {
        // this may be a shared selection change; get all points associated with it
        const objs = getPointsByCaseId(_board, change.name);
        objs.forEach(obj => setElementColor(_board, obj.id, change.newValue.value));
      }
    }));

    if (this.props.onSetBoard) {
      this.props.onSetBoard(board);
    }

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  };

  private handleCreateAxis = (axis: JXG.Line) => {
    const handlePointerDown = (evt: any) => {
      const { readOnly, scale } = this.props;
      const { board } = this.state;
      // Axis labels get the event preferentially even though we think of other potentially
      // overlapping objects (like movable line labels) as being on top. Therefore, we only
      // open the axis settings dialog if we consider the axis label to be the preferred
      // clickable object at the position of the event.
      if (board && !readOnly && (axis.label === getClickableObjectUnderMouse(board, evt, false, scale))) {
        this.handleOpenAxisSettings();
      }
    };

    axis.label && axis.label.on("down", handlePointerDown);
  };

  private handleCreatePoint = (point: JXG.Point) => {

    const handlePointerDown = (evt: any) => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const { board } = this.state;
      if (!board) return;
      const id = point.id;
      const coords = copyCoords(point.coords);
      const tableId = point.getAttribute("linkedTableId");
      const columnId = point.getAttribute("linkedColId");
      const isPointDraggable = !this.props.readOnly && !point.getAttribute("fixed");
      if (isFreePoint(point) && this.isDoubleClick(this.lastPointDown, { evt, coords })) {
        if (board) {
          this.applyChange(() => {
            const polygon = geometryContent.createPolygonFromFreePoints(board, tableId, columnId);
            if (polygon) {
              this.handleCreatePolygon(polygon);
              this.props.onContentChange();
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
            geometryContent.deselectElement(board, id);
          }

          if (isMovableLineControlPoint(point)) {
            // When a control point is clicked, deselect the rest of the line so the line slope can be changed
            const line = find(point.descendants, isMovableLine);
            if (line) {
              geometryContent.deselectElement(undefined, line.id);
              each(line.ancestors, (parentPoint, parentId) => {
                if (parentId !== point.id) {
                  geometryContent.deselectElement(undefined, parentId);
                }
              });
            }
          }
        }
        // click on unselected element
        else {
          // deselect other elements unless appropriate modifier key is down
          if (!hasSelectionModifier(evt)) {
            geometryContent.deselectAll(board);
          }
          geometryContent.selectElement(board, id);
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
  };

  private handleCreateLine = (line: JXG.Line) => {

    function getVertices() {
      return filter(line.ancestors, isPoint);
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
        vertices.forEach(vertex => content.selectElement(board, vertex.id));

        content.selectElement(board, line.id);
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
      this.isVertexDrag = false;
    };

    line.on("down", handlePointerDown);
    line.on("drag", handleDrag);
    line.on("up", handlePointerUp);
  };

  private handleCreatePolygon = (polygon: JXG.Polygon) => {

    const isInVertex = (evt: any) => {
      const { scale } = this.props;
      const { board } = this.state;
      if (!board) return false;
      const coords = getEventCoords(board, evt, scale);
      let inVertex = false;
      each(polygon.ancestors, point => {
        if (isPoint(point) && point.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
          inVertex = true;
        }
      });
      return inVertex;
    };

    const areAllVerticesSelected = () => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      let allSelected = true;
      each(polygon.ancestors, point => {
        if (isPoint(point) && !geometryContent.isSelected(point.id)) {
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
        geometryContent.selectElement(board, polygon.id);
        each(polygon.ancestors, point => {
          if (board && isPoint(point) && !inVertex) {
            geometryContent.selectElement(board, point.id);
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
      this.isVertexDrag = false;
    };

    const edges = getPolygonEdges(polygon);
    edges.forEach(edge => this.handleCreateLine(edge));

    polygon.on("down", handlePointerDown);
    polygon.on("drag", handleDrag);
    polygon.on("up", handlePointerUp);
  };

  private handleCreateVertexAngle = (angle: JXG.Angle) => {
    updateVertexAngle(angle);
  };

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

          content.selectElement(board, text.id);
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
      const { readOnly } = this.props;
      const { board } = this.state;
      if (isMovableLineLabel(text) && board) {
        // Extended clicks/drags don't open the movable line dialog
        const clickTimeThreshold = 500;
        if (evt.timeStamp - this.lastBoardDown.evt.timeStamp < clickTimeThreshold) {
          const parentLine = values(text.ancestors)[0];
          if (isLine(parentLine) && !readOnly) {
            this.setState({selectedLine: parentLine});
          }
        }
      }

      const id = text.id;
      const dragEntry = this.dragPts[id];
      if (!dragEntry) { return; }

      if (!this.props.readOnly) {
        dragEntry.final = copyCoords(text.coords);
        this.endDragText(evt, text, dragEntry);
      }

      delete this.dragPts[id];
    };

    text.on("down", handlePointerDown);
    text.on("drag", handleDrag);
    text.on("up", handlePointerUp);
  };
}
