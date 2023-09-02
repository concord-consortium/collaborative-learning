import { castArray, each, filter, find, keys as _keys, throttle, values } from "lodash";
import { observe, reaction } from "mobx";
import { inject, observer } from "mobx-react";
import { getSnapshot, onSnapshot } from "mobx-state-tree";
import objectHash from "object-hash";
import React from "react";
import { SizeMeProps } from "react-sizeme";

import {
  geometryAnnotationXOffset, geometryAnnotationYOffset, pointBoundingBoxSize, pointButtonRadius,
  segmentButtonWidth
} from "./geometry-constants";
import { BaseComponent } from "../../base";
import { DocumentContentModelType } from "../../../models/document/document-content";
import { getTableLinkColors } from "../../../models/tiles/table-links";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import {
  GeometryContentModelType, IAxesParams, isGeometryContentReady, setElementColor
} from "../../../models/tiles/geometry/geometry-content";
import { convertModelObjectsToChanges } from "../../../models/tiles/geometry/geometry-migrate";
import {
  cloneGeometryObject, GeometryObjectModelType, isPointModel, pointIdsFromSegmentId, PolygonModelType
} from "../../../models/tiles/geometry/geometry-model";
import { copyCoords, getEventCoords, getAllObjectsUnderMouse, getClickableObjectUnderMouse,
          isDragTargetOrAncestor } from "../../../models/tiles/geometry/geometry-utils";
import { RotatePolygonIcon } from "./rotate-polygon-icon";
import { getPointsByCaseId } from "../../../models/tiles/geometry/jxg-board";
import {
  ESegmentLabelOption, ILinkProperties, JXGCoordPair
} from "../../../models/tiles/geometry/jxg-changes";
import { applyChange, applyChanges } from "../../../models/tiles/geometry/jxg-dispatcher";
import { kSnapUnit } from "../../../models/tiles/geometry/jxg-point";
import {
  getAssociatedPolygon, getPointsForVertexAngle, getPolygonEdges
} from "../../../models/tiles/geometry/jxg-polygon";
import {
  isAxis, isAxisLabel, isBoard, isComment, isFreePoint, isImage, isLine, isMovableLine,
  isMovableLineControlPoint, isMovableLineLabel, isPoint, isPolygon, isVertexAngle,
  isVisibleEdge, isVisibleMovableLine, isVisiblePoint, kGeometryDefaultPixelsPerUnit
} from "../../../models/tiles/geometry/jxg-types";
import {
  getVertexAngle, updateVertexAngle, updateVertexAnglesFromObjects
} from "../../../models/tiles/geometry/jxg-vertex-angle";
import { getAllLinkedPoints, injectGetTableLinkColorsFunction } from "../../../models/tiles/geometry/jxg-table-link";
import { extractDragTileType, kDragTileContent, kDragTileId, dragTileSrcDocId } from "../tile-component";
import { ImageMapEntryType, gImageMap } from "../../../models/image-map";
import { linkedPointId } from "../../../models/tiles/table-link-types";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { getParentWithTypeName } from "../../../utilities/mst-utils";
import { safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import AxisSettingsDialog from "./axis-settings-dialog";
import { EditableTileTitle } from "../editable-tile-title";
import LabelSegmentDialog from "./label-segment-dialog";
import MovableLineDialog from "./movable-line-dialog";
import placeholderImage from "../../../assets/image_placeholder.png";
import { LinkTableButton } from "./link-table-button";
import ErrorAlert from "../../utilities/error-alert";
import { halfPi, normalizeAngle } from "../../../utilities/math-utils";
import SingleStringDialog from "../../utilities/single-string-dialog";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";

import "./geometry-tile.sass";

export interface IGeometryContentProps extends IGeometryProps {
  onSetBoard: (board: JXG.Board) => void;
  onSetActionHandlers: (handlers: IActionHandlers) => void;
  onContentChange: () => void;
  onLinkTileButtonClick?: () => void;
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

  private updateImage = (url: string, filename?: string) => {
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
          };

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
        handleToggleVertexAngle: this.handleToggleVertexAngle,
        handleCreateLineLabel: this.handleCreateLineLabel,
        handleCreateMovableLine: this.handleCreateMovableLine,
        handleCreateComment: this.handleCreateComment,
        handleUploadImageFile: this.handleUploadBackgroundImage
      };
      onSetActionHandlers(handlers);
    }
  }

  private getPointScreenCoords(pointId: string) {
    if (!this.state.board) return undefined;
    const element = this.state.board?.objects[pointId];
    if (!element) return undefined;
    const bounds = element.bounds();
    const coords = new JXG.Coords(JXG.COORDS_BY_USER, bounds.slice(0, 2), this.state.board);
    return { x: coords.scrCoords[1], y: coords.scrCoords[2] };
  }

  public componentDidMount() {
    this._isMounted = true;
    this.disposers = [];

    this.initializeContent();

    this.props.onRegisterTileApi({
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
      getLinkedTiles: () => {
        return this.getContent().linkedTableIds;
      },
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      },
      getTitle: () => {
        return this.props.model.title;
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === "point") {
          const coords = this.getPointScreenCoords(objectId);
          if (!coords) return undefined;
          const boundingBox = {
            height: pointBoundingBoxSize,
            left: coords.x - pointBoundingBoxSize / 2 + geometryAnnotationXOffset,
            top: coords.y - pointBoundingBoxSize / 2 + geometryAnnotationYOffset,
            width: pointBoundingBoxSize
          };
          return boundingBox;
        } else if (objectType === "polygon") {
          const content = this.getContent();
          const polygon = content.getObject(objectId) as PolygonModelType;
          let [bottom, left, right, top] = [Number.MIN_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_VALUE];
          polygon.points.forEach(pointId => {
            const coords = this.getPointScreenCoords(pointId);
            if (!coords) return undefined;
            if (coords.y > bottom) bottom = coords.y;
            if (coords.x < left) left = coords.x;
            if (coords.x > right) right = coords.x;
            if (coords.y < top) top = coords.y;
          });
          const boundingBox = {
            height: bottom - top,
            left: left + geometryAnnotationXOffset,
            top: top + geometryAnnotationYOffset,
            width: right - left
          };
          return boundingBox;          
        } else if (objectType === "segment") {
          const [ point1Id, point2Id ] = pointIdsFromSegmentId(objectId);
          const coords1 = this.getPointScreenCoords(point1Id);
          const coords2 = this.getPointScreenCoords(point2Id);
          if (!coords1 || !coords2) return undefined;
          const bottom = Math.max(coords1.y, coords2.y);
          const left = Math.min(coords1.x, coords2.x);
          const right = Math.max(coords1.x, coords2.x);
          const top = Math.min(coords1.y, coords2.y);
          const boundingBox = {
            height: bottom - top,
            left: left + geometryAnnotationXOffset,
            top: top + geometryAnnotationYOffset,
            width: right - left
          };
          return boundingBox;
        }
      },
      getObjectButtonSVG: ({ classes, handleClick, objectId, objectType, translateTilePointToScreenPoint }) => {
        if (objectType === "point") {
          // Find the center point
          const coords = this.getPointScreenCoords(objectId);
          if (!coords) return;
          const point = translateTilePointToScreenPoint?.([coords.x, coords.y]);
          if (!point) return;

          // Return a circle at the center point
          const [x, y] = point;
          return (
            <circle
              className={classes}
              cx={x + geometryAnnotationXOffset}
              cy={y + geometryAnnotationYOffset}
              fill="transparent"
              onClick={handleClick}
              r={pointButtonRadius}
            />
          );
        } else if (objectType === "segment") {
          // Find the end points of the segment
          const [ point1Id, point2Id ] = pointIdsFromSegmentId(objectId);
          const coords1 = this.getPointScreenCoords(point1Id);
          const coords2 = this.getPointScreenCoords(point2Id);
          if (!coords1 || !coords2) return;

          // Find the angles perpendicular to the segment
          const dx = coords2.x - coords1.x;
          const dy = coords2.y - coords1.y;
          const segmentAngle = normalizeAngle(Math.atan2(-dy, dx));
          const firstAngle = normalizeAngle(segmentAngle + halfPi);
          const secondAngle = normalizeAngle(segmentAngle - halfPi);

          // Determine the points and path of the rectangle containing the segment
          const coords = [
            {x: coords1.x + Math.cos(firstAngle) * segmentButtonWidth,
              y: coords1.y - Math.sin(firstAngle) * segmentButtonWidth},
            {x: coords2.x + Math.cos(firstAngle) * segmentButtonWidth,
              y: coords2.y - Math.sin(firstAngle) * segmentButtonWidth},
            {x: coords2.x + Math.cos(secondAngle) * segmentButtonWidth,
              y: coords2.y - Math.sin(secondAngle) * segmentButtonWidth},
            {x: coords1.x + Math.cos(secondAngle) * segmentButtonWidth,
              y: coords1.y - Math.sin(secondAngle) * segmentButtonWidth},
          ];
          return this.getButtonPath(coords, handleClick, classes, translateTilePointToScreenPoint);
        } else if (objectType === "polygon") {
          // Determine the path of the polygon based on its points
          const content = this.getContent();
          const polygon = content.getObject(objectId) as PolygonModelType;
          return this.getButtonPath(
            polygon.points.map(pointId => this.getPointScreenCoords(pointId)),
            handleClick, classes, translateTilePointToScreenPoint
          );
        }
      }
    });

    // respond to linked table/shared model changes
    this.disposers.push(reaction(
      () => this.getContent().updateSharedModels,
      () => this.syncLinkedGeometry()
    ));

    this.disposers.push(onSnapshot(this.getContent(), () => {
      if (!this.suspendSnapshotResponse) {
        this.destroyBoard();
        this.setState({ board: undefined });
        this.initializeBoard();
      }
    }));
  }

  private getButtonPath(
    coords: ({ x: number, y: number } | undefined)[], handleClick: () => void, classes?: string,
    translatePoint?: ((point: [x: number, y: number]) => [x: number, y: number] | undefined)
  ) {
    if (!translatePoint) return undefined;
    let path = "";
    coords.forEach((coord, index) => {
      if (!coord) return;
      const point = translatePoint?.([coord.x, coord.y]);
      if (!point) return;

      const [x, y] = point;
      const letter = index === 0 ? "M" : "L";
      path = `${path}${letter} ${x + geometryAnnotationXOffset} ${y + geometryAnnotationYOffset} `;
    });
    path = `${path}Z`;

    return (
      <path
        className={classes}
        d={path}
        fill="transparent"
        onClick={handleClick}
      />
    );
  }

  public componentDidUpdate(prevProps: IProps) {
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

    // Handle resize
    if (this.state.board) {
      const { model: { content }, scale, size } = this.props;
      const geometryContent = content as GeometryContentModelType;
      if (size && size.width && size.height && (!prevProps.size ||
          ((size.width !== prevProps.size.width) || (size.height !== prevProps.size.height)))) {
        geometryContent.resizeBoard(this.state.board, size.width, size.height, scale);
      }

      // Handle new scale
      if (scale && (scale !== prevProps.scale)) {
        // let JSXGraph know about the scale change
        geometryContent.updateScale(this.state.board, scale);
      }
    }
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());

    if (this.state.board) {
      // delay so any asynchronous JSXGraph actions have time to complete
      setTimeout(() => this.destroyBoard());
    }

    this.props.onUnregisterTileApi();

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
    title && this.props.model.setTitle(title);
    this.setState({ isEditingTitle: false });
  };

  private renderTitleArea() {
    return (
      <div className="title-area-wrapper" key="title-area">
        <div className="title-area">
          {this.renderTitle()}
          {this.renderTileLinkButton()}
        </div>
      </div>
    );
  }

  private renderTitle() {
    const getTitle = () => this.props.model.title || "";
    const { measureText, readOnly, size, scale } = this.props;
    return (
      <EditableTileTitle key="geometry-title" size={size} scale={scale} getTitle={getTitle}
                              readOnly={readOnly} measureText={measureText}
                              onBeginEdit={this.handleBeginEditTitle} onEndEdit={this.handleTitleChange} />
    );
  }

  private renderTileLinkButton() {
    const { isLinkButtonEnabled, onLinkTileButtonClick } = this.props;
    return (!this.state.isEditingTitle && !this.props.readOnly &&
      <LinkTableButton key="link-button" isEnabled={isLinkButtonEnabled} onClick={onLinkTileButtonClick}/>
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
          this.syncLinkedGeometry(board);
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
    this.updateImage(url, filename);
  }

  private rescaleBoardAndAxes(params: IAxesParams) {
    const { board } = this.state;
    if (!board) return;

    this.applyChange(() => {
      const content = this.getContent();
      const axes = content.rescaleBoard(board, params);
      if (axes) {
        axes.forEach(this.handleCreateAxis);
      }
    });
  }

  private getBoardPointsExtents(board: JXG.Board){
    let xMax = 1;
    let yMax = 1;
    let xMin = -1;
    let yMin = -1;

    board.objectsList.forEach((obj: any) => {
      if (obj.elType === "point"){
        const pointX = obj.coords.usrCoords[1];
        const pointY = obj.coords.usrCoords[2];
        if (pointX < xMin) xMin = pointX - 1;
        if (pointX > xMax) xMax = pointX + 1;
        if (pointY < yMin) yMin = pointY - 1;
        if (pointY > yMax) yMax = pointY + 1;
      }
    });
    return { xMax, yMax, xMin, yMin };
  }

  syncLinkedGeometry(_board?: JXG.Board) {
    const board = _board || this.state.board;
    if (!board) return;

    this.recreateSharedPoints(board);

    // identify objects that exist in the model but not in JSXGraph
    const modelObjectsToConvert: GeometryObjectModelType[] = [];
    this.getContent().objects.forEach(obj => {
      if (!board.objects[obj.id]) {
        modelObjectsToConvert.push(obj);
      }
    });

    if (modelObjectsToConvert.length > 0) {
      const changesToApply = convertModelObjectsToChanges(modelObjectsToConvert);
      applyChanges(board, changesToApply);
    }

    const extents = this.getBoardPointsExtents(board);
    this.rescaleBoardAndAxes(extents);
  }

  // remove/recreate all linked points
  // Shared points are deleted, and in the process, so are the polygons that depend on them
  // This is built into JSXGraph's Board#removeObject function, which descends through and deletes all children:
  // https://github.com/jsxgraph/jsxgraph/blob/60a2504ed66b8c6fea30ef67a801e86877fb2e9f/src/base/board.js#L4775
  // Ids persist in their recreation because they are ultimately derived from canonical values
  // NOTE: A more tailored response would match up the existing points with the data set and only
  // change the affected points, which would eliminate some visual flashing that occurs when
  // unchanged points are re-created and would allow derived polygons to be preserved rather than created anew.
  recreateSharedPoints(board: JXG.Board){
    const ids = getAllLinkedPoints(board);
    if (ids.length > 0){
      applyChange(board, { operation: "delete", target: "linkedPoint", targetID: ids });
    }
    this.getContent().linkedDataSets.forEach(link => {
      const links: ILinkProperties = { tileIds: [link.providerId] };
      const parents: JXGCoordPair[] = [];
      const properties: Array<{ id: string }> = [];
      for (let ci = 0; ci < link.dataSet.cases.length; ++ci) {
        const x = link.dataSet.attributes[0]?.numValue(ci);
        for (let ai = 1; ai < link.dataSet.attributes.length; ++ai) {
          const attr = link.dataSet.attributes[ai];
          const id = linkedPointId(link.dataSet.cases[ci].__id__, attr.id);
          const y = attr.numValue(ci);
          if (isFinite(x) && isFinite(y)) {
            parents.push([x, y]);
            properties.push({ id });
          }
        }
      }
      const pts = applyChange(board, { operation: "create", target: "linkedPoint", parents, properties, links });
      castArray(pts || []).forEach(pt => !isBoard(pt) && this.handleCreateElements(pt));
    });
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

  // duplicate selected objects without affecting clipboard
  private handleDuplicate = () => {
    const copiedObjects = (this.copySelectedObjects() || []) as GeometryObjectModelType[];
    if (copiedObjects?.length) {
      // hash the copied objects to create a pasteId tied to the content
      const excludeKeys = (key: string) => ["id", "anchors", "points"].includes(key);
      const hash = objectHash(copiedObjects.map(obj => getSnapshot(obj)), { excludeKeys });
      this.pasteObjects({ pasteId: hash, isSameTile: true, objects: copiedObjects });
    }
  };

  private copySelectedObjects() {
    const content = this.getContent();
    const { board } = this.state;
    if (board && content.hasSelection()) {
      return content.copySelection(board);
    }
  }

  // copy to clipboard
  private handleCopy = () => {
    const objects = this.copySelectedObjects();
    if (objects) {
      const content = this.getContent();
      const { clipboard } = this.stores;
      const clipObjects = objects.map(obj => getSnapshot(obj));
      clipboard.clear();
      clipboard.addTileContent(content.metadata.id, content.type, clipObjects, this.stores);

      // While the above code adds the content to the CLUE clipboard store, it doesn't copy it to
      // the system clipboard. That's perfectly fine for typical CLUE usage, but for authoring we
      // also add the content to the system clipboard. We do so to better keep track of what the
      // author intends to paste in. For example, an author may have copied an image URL from the
      // CMS that they want to paste into the geometry tile for a background image. We use a custom
      // MIME type for easier identification of geometry tile content in the handlePaste function.
      if (navigator.clipboard.write) {
        const type = "web text/clue-geometry-tile-content";
        const blob = new Blob([JSON.stringify(content)], { type });
        const data = [new ClipboardItem({ [type]: blob })];
        navigator.clipboard.write(data);
      }

      return true;
    }
  };

  // cut to clipboard
  private handleCut = () => {
    this.handleCopy();
    return this.handleDelete();
  };

  private handleNewImage = (image: ImageMapEntryType) => {
    if (this._isMounted) {
      const content = this.getContent();
      this.setState({ isLoading: false, imageEntry: image });
      if (image.contentUrl && (image.contentUrl !== content.bgImage?.url)) {
        this.setBackgroundImage(image);
      }
    }
  };

  // paste from clipboard
  private handlePaste = async () => {
    // For authoring, we support the pasting of an image URL to set the background image of
    // the geometry tile. So before pasting in the CLUE clipboard contents, we check if the
    // system clipboard contains a text/plain value matching the expected pattern for an
    // image URL in the CMS. If so, we paste that image URL into the geometry tile. See
    // comment about system clipboard in the handleCopy function for more details.
    const osClipboardContents = await getClipboardContent();
    if (osClipboardContents?.text) {
      const url = osClipboardContents.text.match(/curriculum\/([^/]+\/images\/.*)/);
      if (url) {
        pasteClipboardImage(osClipboardContents, ({ image }) => this.handleNewImage(image));
      } else {
        console.error("ERROR: invalid image URL pasted into geometry tile");
      }
      return;
    }

    const content = this.getContent();
    const { clipboard } = this.stores;
    const objects = clipboard.getTileContent(content.type);
    const pasteId = clipboard.getTileContentId(content.type) || objectHash(objects);
    const isSameTile = clipboard.isSourceTile(content.type, content.metadata.id);
    this.pasteObjects({ pasteId, isSameTile, objects });
  };

  // paste specified object content
  private pasteObjects = (pasteContent: IPasteContent) => {
    const content = this.getContent();
    const { readOnly } = this.props;
    const { board } = this.state;
    if (!readOnly && board) {
      const { pasteId, isSameTile, objects } = pasteContent;
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
    const { readOnly } = this.props;
    const canAcceptTableDrops = this.isDragTileInSameDocument(e);
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
      this.handleTileLinkRequest(dragTileId);
    }
  }

  private handleTileLinkRequest = (tableId: string) => {
    this.getContent().addLinkedTile(tableId);
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
    }
    finally {
      --this.suspendSnapshotResponse;
    }
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
      const { readOnly, scale } = this.props;
      const { board } = this.state;
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
      const { readOnly, scale } = this.props;
      const { board } = this.state;
      if (!board || (polygon !== getClickableObjectUnderMouse(board, evt, !readOnly, scale))) return;
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const inVertex = isInVertex(evt);
      const allVerticesSelected = areAllVerticesSelected();
      let selectPolygon = false;
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (board && !hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        selectPolygon = true;
        this.lastSelectDown = evt;
      }
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
