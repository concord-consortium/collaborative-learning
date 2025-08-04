import React from "react";
import { castArray, each, find, isEqual, keys as _keys, throttle, values } from "lodash";
import { IObjectDidChange, observable, observe, reaction, runInAction } from "mobx";
import { inject, observer } from "mobx-react";
import { getSnapshot, onSnapshot } from "mobx-state-tree";
import objectHash from "object-hash";
import { SizeMeProps } from "react-sizeme";
import classNames from "classnames";

import { pointBoundingBoxSize, pointButtonRadius, segmentButtonWidth, zoomFactor } from "./geometry-constants";
import { BaseComponent } from "../../base";
import { DocumentContentModelType } from "../../../models/document/document-content";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import {
  GeometryContentModelType, IAxesParams, isGeometryContentReady, updateVisualProps
} from "../../../models/tiles/geometry/geometry-content";
import { convertModelObjectsToChanges } from "../../../models/tiles/geometry/geometry-migrate";
import {
  cloneGeometryObject, GeometryObjectModelType, isPointModel, pointIdsFromSegmentId, PointModelType, PolygonModelType
} from "../../../models/tiles/geometry/geometry-model";
import { copyCoords, getEventCoords, getAllObjectsUnderMouse, getClickableObjectUnderMouse,
          isDragTargetOrAncestor,
          getPolygon,
          logGeometryEvent,
          getPoint,
          getBoardObject,
          findBoardObject,
          getBoardObjectsExtents,
          formatAsBoundingBox} from "../../../models/tiles/geometry/geometry-utils";
import { RotatePolygonIcon } from "./rotate-polygon-icon";
import { getPointsByCaseId } from "../../../models/tiles/geometry/jxg-board";
import {
  ELabelOption, JXGCoordPair
} from "../../../models/tiles/geometry/jxg-changes";
import { applyChange } from "../../../models/tiles/geometry/jxg-dispatcher";
import { kSnapUnit, setPropertiesForLabelOption } from "../../../models/tiles/geometry/jxg-point";
import {
  getAssociatedPolygon, getPointsForVertexAngle, getPolygonEdges
} from "../../../models/tiles/geometry/jxg-polygon";
import {
  isAxis, isCircle, isComment, isImage, isLine, isLinkedPoint, isMovableLine,
  isMovableLineControlPoint, isMovableLineLabel, isPoint, isPolygon, isRealVisiblePoint, isVertexAngle,
  isVisibleEdge, isVisibleMovableLine, kGeometryDefaultPixelsPerUnit
} from "../../../models/tiles/geometry/jxg-types";
import {
  getVertexAngle, updateVertexAngle, updateVertexAnglesFromObjects
} from "../../../models/tiles/geometry/jxg-vertex-angle";
import { createLinkedPoint, getAllLinkedPoints } from "../../../models/tiles/geometry/jxg-table-link";
import { extractDragTileType, kDragTileContent, kDragTileId, dragTileSrcDocId } from "../tile-component";
import { gImageMap, ImageMapEntry } from "../../../models/image-map";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { getParentWithTypeName } from "../../../utilities/mst-utils";
import { notEmpty, safeJsonParse, uniqueId } from "../../../utilities/js-utils";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { EditableTileTitle } from "../editable-tile-title";
import LabelSegmentDialog from "./label-segment-dialog";
import MovableLineDialog from "./movable-line-dialog";
import { PLACEHOLDER_IMAGE_PATH } from "../../../utilities/image-constants";
import ErrorAlert from "../../utilities/error-alert";
import { halfPi, isFiniteNumber, normalizeAngle, Point } from "../../../utilities/math-utils";
import SingleStringDialog from "../../utilities/single-string-dialog";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";
import { TileTitleArea } from "../tile-title-area";
import { GeometryTileContext } from "./geometry-tile-context";
import LabelPointDialog from "./label-point-dialog";
import LabelPolygonDialog from "./label-polygon-dialog";
import { ITileNavigatorContext } from "../hooks/use-tile-navigator-context";

export interface IGeometryContentProps extends IGeometryProps {
  onSetBoard?: (board: JXG.Board) => void;
  onSetActionHandlers?: (handlers: IActionHandlers) => void;
  onContentChange?: () => void;
}
export interface IProps extends IGeometryContentProps, SizeMeProps {
  measureText: (text: string) => number;
  showAllContent?: boolean;
  tileNavigatorContext: ITileNavigatorContext;
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
  imageEntry?: ImageMapEntry;
  disableRotate: boolean;
  redoStack: string[][];
  selectedComment?: JXG.Text;
  selectedLine?: JXG.Line;
  showPointLabelDialog?: boolean;
  showSegmentLabelDialog?: boolean;
  showPolygonLabelDialog?: boolean;
  showInvalidTableDataAlert?: boolean;
  showColorPalette?: boolean;
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

interface IPasteContent {
  pasteId: string;
  isSameTile: boolean;
  objects: GeometryObjectModelType[];
}

let sInstanceId = 0;

@inject("stores")
@observer
export class GeometryContentComponent extends BaseComponent<IProps, IState> {
  static contextType = GeometryTileContext;
  declare context: React.ContextType<typeof GeometryTileContext>;
  private updateObservable = observable({updateCount: 0});

  public state: IState = {
          size: { width: null, height: null },
          disableRotate: false,
          redoStack: [],
        };

  private instanceId = ++sInstanceId;
  private elementId: string;
  private domElement: HTMLDivElement | null;
  private _isMounted: boolean;

  private disposers: any[];

  private lastBoardDown: JXGPtrEvent;
  private lastPointDown?: JXGPtrEvent;
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
                    bgImage.url = image.displayUrl || PLACEHOLDER_IMAGE_PATH;
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
        handleLabelDialog: this.handleLabelDialog,
        handleCreateMovableLine: this.handleCreateMovableLine,
        handleCreateComment: this.handleCreateComment,
        handleUploadImageFile: this.handleUploadBackgroundImage,
        handleZoomIn: this.handleZoomIn,
        handleZoomOut: this.handleZoomOut,
        handleFitAll: this.handleScaleToFit,
        handleSetShowColorPalette: this.handleSetShowColorPalette,
        handleColorChange: this.handleColorChange
      };
      onSetActionHandlers(handlers);
    }
  }

  private getPointScreenCoords(pointId: string) {
    if (!this.state.board) return;
    const pt = getPoint(this.state.board, pointId);
    if (!pt) return;
    if (isLinkedPoint(pt)) {
      return this.getLinkedPointScreenCoords(pointId);
    } else {
      return this.getLocalPointScreenCoords(pointId);
    }
  }

  private getLocalPointScreenCoords(pointId: string) {
    // Access the model to ensure that model changes trigger a rerender
    const p = this.getContent().getObject(pointId) as PointModelType;
    if (!p || p.x == null || p.y == null) return;

    if (!this.state.board) return;
    const element = getPoint(this.state.board, pointId);
    if (!element) return;
    const [a, b] = element.bounds();
    const coords = new JXG.Coords(JXG.COORDS_BY_USER, [a, b], this.state.board);
    const point: Point = [coords.scrCoords[1], coords.scrCoords[2]];
    return point;
  }

  private getLinkedPointScreenCoords(linkedPointId: string) {
    if (!this.state.board) return;

    // Access the model to ensure that model changes trigger a rerender
    const element = getBoardObject(this.state.board, linkedPointId);
    if (!element) return;
    const dataSet = this.getContent().getLinkedDataset(element.getAttribute("linkedTableId"))?.dataSet;
    const caseIndex = dataSet?.caseIndexFromID(element.getAttribute("linkedRowId"));
    const yValue = caseIndex!==undefined
      && dataSet?.attrFromID(element.getAttribute("linkedColId")).numValue(caseIndex);
    if (!isFiniteNumber(yValue)) return;

    const [a, b] = element.bounds();
    const coords = new JXG.Coords(JXG.COORDS_BY_USER, [a, b], this.state.board);
    const point: Point = [coords.scrCoords[1], coords.scrCoords[2]];
    return point;
  }

  public componentDidMount() {
    this._isMounted = true;
    this.disposers = [];

    if (this.props.readOnly) {
      // Points mode may be the default, but it shouldn't be for read-only tiles.
      this.context.setMode("select");
    }

    this.initializeContent();

    if (!this.props.showAllContent) {
      this.props.onRegisterTileApi({

        isLinked: () => {
          return this.getContent().isLinked;
        },
        getLinkedTiles: () => {
          return this.getContent().linkedTableIds;
        },
        exportContentAsTileJson: (options?: ITileExportOptions) => {
          return this.getContent().exportJson(options);
        },
        getObjectBoundingBox: (objectId: string, objectType?: string) => {
          // This gets updated when the JSX board needs to be rebuilt
          // eslint-disable-next-line unused-imports/no-unused-vars -- need to observe
          const {updateCount} = this.updateObservable;

          if (objectType === "point" || objectType === "linkedPoint") {
            const coords = objectType === "point"
              ? this.getLocalPointScreenCoords(objectId)
              : this.getLinkedPointScreenCoords(objectId);
            if (!coords) return undefined;
            const [x, y] = coords;
            const boundingBox = {
              height: pointBoundingBoxSize,
              left: x - pointBoundingBoxSize / 2,
              top: y - pointBoundingBoxSize / 2,
              width: pointBoundingBoxSize
            };
            return boundingBox;
          } else if (objectType === "polygon") {
            const content = this.getContent();
            const polygon = content.getObject(objectId) as PolygonModelType;
            if (!polygon) return;
            let [bottom, left, right, top] = [Number.MIN_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_VALUE];
            polygon.points.forEach(pointId => {
              const coords = this.getPointScreenCoords(pointId);
              if (!coords) return undefined;
              const [x, y] = coords;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
              if (y < top) top = y;
            });
            const boundingBox = {
              height: bottom - top,
              left,
              top,
              width: right - left
            };
            return boundingBox;
          } else if (objectType === "segment") {
            const [ point1Id, point2Id ] = pointIdsFromSegmentId(objectId);
            const coords1 = this.getPointScreenCoords(point1Id);
            const coords2 = this.getPointScreenCoords(point2Id);
            if (!coords1 || !coords2) return undefined;
            const [x1, y1] = coords1;
            const [x2, y2] = coords2;
            const bottom = Math.max(y1, y2);
            const left = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            const top = Math.min(y1, y2);
            const boundingBox = {
              height: bottom - top,
              left,
              top,
              width: right - left
            };
            return boundingBox;
          }
        },
        getObjectButtonSVG: ({ classes, handleClick, objectId, objectType }) => {
          if (objectType === "point" || objectType === "linkedPoint") {
            // Find the center point
            const coords = objectType === "point"
              ? this.getLocalPointScreenCoords(objectId)
              : this.getLinkedPointScreenCoords(objectId);
            if (!coords) return;

            // Return a circle at the center point
            const [x, y] = coords;
            return (
              <circle
                className={classes}
                cx={x}
                cy={y}
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
            const [x1, y1] = coords1;
            const [x2, y2] = coords2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const segmentAngle = normalizeAngle(Math.atan2(-dy, dx));
            const firstAngle = normalizeAngle(segmentAngle + halfPi);
            const secondAngle = normalizeAngle(segmentAngle - halfPi);

            // Determine the points and path of the rectangle containing the segment
            const coords: Point[] = [
              [x1 + Math.cos(firstAngle) * segmentButtonWidth, y1 - Math.sin(firstAngle) * segmentButtonWidth],
              [x2 + Math.cos(firstAngle) * segmentButtonWidth, y2 - Math.sin(firstAngle) * segmentButtonWidth],
              [x2 + Math.cos(secondAngle) * segmentButtonWidth, y2 - Math.sin(secondAngle) * segmentButtonWidth],
              [x1 + Math.cos(secondAngle) * segmentButtonWidth, y1 - Math.sin(secondAngle) * segmentButtonWidth],
            ];
            return this.getButtonPath(coords, handleClick, classes);
          } else if (objectType === "polygon") {
            // Determine the path of the polygon based on its points
            const content = this.getContent();
            const polygon = content.getObject(objectId) as PolygonModelType;
            if (!polygon) return;
            return this.getButtonPath(
              polygon.points.map(pointId => this.getPointScreenCoords(pointId)), handleClick, classes
            );
          }
        }
      });
    }
    // respond to linked table/shared model changes
    this.disposers.push(reaction(
      () => this.getContent().updateSharedModels,
      () => this.syncLinkedGeometry()
    ));

    this.disposers.push(onSnapshot(this.getContent(), () => {
      if (!this.suspendSnapshotResponse) {
        if (this.state.board) {
          this.destroyBoard();
          this.setState({ board: undefined });
          this.initializeBoard();
        }
      }
    }));

    // synchronize selection changes
    this.disposers.push(observe(this.getContent().metadata.selection, (change: IObjectDidChange<boolean>) => {
      const { board: _board } = this.state;
      if (_board) {
        // this may be a shared selection change; get all points associated with it
        const objs = getPointsByCaseId(_board, change.name.toString());
        const edges: JXG.Line[] = [];
        objs.forEach(obj => {
          if (change.type !== 'remove') {
            updateVisualProps(_board, obj.id, change.newValue.value);
            // Also find segments that are attached to the changed points
            Object.values(obj.childElements).forEach(child => {
              if(isVisibleEdge(child) && !edges.includes(child)) {
                edges.push(child);
              }
            });
          }
        });
        edges.forEach(edge => {
          // Edge is selected if both end points are.
          const selected = this.getContent().isSelected(edge.point1.id) && this.getContent().isSelected(edge.point2.id);
          updateVisualProps(_board, edge.id, selected);
        });
      }
    }));

  }

  private getButtonPath(
    coords: (Point | undefined)[], handleClick: (e: React.MouseEvent) => void, classes?: string
  ) {
    let path = "";
    coords.forEach((coord, index) => {
      if (!coord) return;

      const [x, y] = coord;
      const letter = index === 0 ? "M" : "L";
      path = `${path}${letter} ${x} ${y} `;
    });
    path = `${path}Z`;

    return (
      <path
        className={classes}
        d={path}
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

      const coordinates = this.state.board.getBoundingBox();
      if (coordinates) {
        if (this.props.tileNavigatorContext) {
          this.props.tileNavigatorContext.reportVisibleBoundingBox(formatAsBoundingBox(coordinates));
        }
      }
    }
    runInAction(() => this.updateObservable.updateCount++);
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

  private handlePointerMove = (evt: any) => {
    if (this.props.readOnly || this.context.mode === "select") return;
    // Move phantom point to location of mouse pointer
    const { board, content } = this.context;
    if (!board || !content) return;
    const usrCoords = getEventCoords(board, evt, this.props.scale).usrCoords;
    if (usrCoords.length >= 2) {
      const position: JXGCoordPair = [usrCoords[1], usrCoords[2]];
      this.applyChange(() => {
        if (content.phantomPoint) {
          content.setPhantomPointPosition(board, position);
        } else {
          content.addPhantomPoint(board, position, true);
        }
      });
      const phantom = content.phantomPoint && getPoint(board, content.phantomPoint?.id);
      phantom && updateVertexAnglesFromObjects([phantom]);
    }
  };

  private handlePointerLeave = () => {
    if (!this.context.board || this.props.readOnly || this.context.mode === "select") return;
    const { board, content } = this.context;
    if (board && content) {
      content.clearPhantomPoint(board);
      // Removing the phantom point from the polygon re-creates it, so we have to add the handlers again.
      if (content.activePolygonId) {
        const poly = getPolygon(board, content.activePolygonId);
        poly && this.handleCreatePolygon(poly);
      }
    }
  };

  public render() {
    const classes = classNames("geometry-content",
      this.props.readOnly ? "read-only" : "editable",
      this.props.showAllContent ? "show-all" : "show-tile",
      { "is-linked": this.getContent().isLinked }
    );
    return (
      <>
        {this.renderCommentEditor()}
        {this.renderLineEditor()}
        {this.renderPolygonLabelDialog()}
        {this.renderSegmentLabelDialog()}
        {this.renderPointLabelDialog()}
        <div id={this.elementId} key="jsxgraph"
            className={classes}
            ref={elt => this.domElement = elt}
            onMouseMove={this.handlePointerMove}
            onMouseLeave={this.handlePointerLeave}
            onDragOver={this.handleDragOver}
            onDragLeave={this.handleDragLeave}
            onDrop={this.handleDrop} />,
        {this.renderRotateHandle()}
        {this.renderTitleArea()}
        {this.renderInvalidTableDataAlert()}
      </>);
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

  private renderPointLabelDialog() {
    const content = this.getContent();
    const { board, showPointLabelDialog } = this.state;
    if (board && showPointLabelDialog) {
      const point = content.getOneSelectedPoint(board);
      if (!point) return;
      const handleClose = () => this.setState({ showPointLabelDialog: false });
      const handleAccept = (p: JXG.Point, labelOption: ELabelOption, name: string, angleLabel: boolean) => {
        this.handleSetPointLabelOptions(p, labelOption, name, angleLabel);
      };
      return (
        <LabelPointDialog
          board={board}
          point={point}
          onAccept={handleAccept}
          onClose={handleClose}
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
      const handleAccept = (poly: JXG.Polygon, pts: [JXG.Point, JXG.Point], labelOption: ELabelOption, name: string) =>
                            {
                              this.handleLabelSegment(poly, pts, labelOption, name);
                              handleClose();
                            };
      return (
        <LabelSegmentDialog
          board={board}
          polygon={polygon}
          points={points as [JXG.Point, JXG.Point]}
          onAccept={handleAccept}
          onClose={handleClose}
        />
      );
    }
  }

  private renderPolygonLabelDialog() {
    const content = this.getContent();
    const { board, showPolygonLabelDialog } = this.state;
    if (board && showPolygonLabelDialog) {
      const polygon = content.getOneSelectedPolygon(board);
      if (!polygon) return;
      const handleClose = () => this.setState({ showPolygonLabelDialog: false });
      const handleAccept = (poly: JXG.Polygon, labelOption: ELabelOption, name: string) => {
        this.handleLabelPolygon(poly, labelOption, name);
        handleClose();
      };
      return (
        <LabelPolygonDialog
          board={board}
          polygon={polygon}
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
    this.setState({ isEditingTitle: false });
  };

  private renderTitleArea() {
    if (this.props.showAllContent) return null;
    return (
      <TileTitleArea>
        {this.renderTitle()}
      </TileTitleArea>
    );
  }

  private renderTitle() {
    const { measureText } = this.props;
    return (
      <EditableTileTitle key="geometry-title"
                              measureText={measureText}
                              onBeginEdit={this.handleBeginEditTitle} onEndEdit={this.handleTitleChange} />
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
        const board = this.getContent()
          .initializeBoard(this.elementId, this.props.showAllContent, this.handleCreateElements,
            (b: JXG.Board) => this.syncLinkedGeometry(b));
        if (board) {
          this.handleCreateBoard(board);
          const { url, filename } = this.getContent().bgImage || {};
          if (url) {
            this.updateImageUrl(url, filename);
          }
          this.setState({ board });
          const coordinates = board.getBoundingBox();
          if (coordinates) {
            if (this.props.tileNavigatorContext) {
              this.props.tileNavigatorContext.reportVisibleBoundingBox(formatAsBoundingBox(coordinates));
            }
          }
          resolve(board);
        }
      });
    });
  }

  private destroyBoard() {
    const { board } = this.state;
    try {
      board && JXG.JSXGraph.freeBoard(board);
    } catch (e) {
      console.warn("Can't free the JSX Board", {cause: e});
    }
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
      const axes = content.rescaleBoard(board, params, true);
      if (axes) {
        axes.forEach(this.handleCreateAxis);
      }
    });
  }

  syncLinkedGeometry(_board?: JXG.Board) {
    const board = _board || this.state.board;
    if (!board) return;
    const content = this.getContent();

    // Make sure each linked dataset's attributes have colors assigned.
    this.applyChange(() => {
      content.linkedDataSets.forEach(link => {
        link.dataSet.attributes.forEach(attr => {
          content.assignColorSchemeForAttributeId(attr.id);
        });
      });
    });

    this.updateSharedPoints(board);
  }

  /**
   * Update/add/remove linked points to matched what is in shared data sets.
   *
   * @param board
   */
  updateSharedPoints(board: JXG.Board) {
    this.applyChange(() => {
      let pointsChanged = false;
      const content = this.getContent();
      const data = content.getLinkedPointsData();
      const remainingIds = getAllLinkedPoints(board);
      for (const points of data.values()) {
        // Loop through points, adding new ones and updating any that need to be moved.
        for (let i=0; i<points.coords.length; i++) {
          const id = points.properties[i].id;
          const existingIndex = remainingIds.indexOf(id);
          if (existingIndex < 0) {
            // Doesn't exist, create the point
            const labelProperties = content.getPointLabelProps(id);
            const allProps = {
              ...points.properties[i],
              name: labelProperties.name,
              clientLabelOption: labelProperties.labelOption
            };
            const tileIds = allProps.linkedTableId ? { tileIds: [allProps.linkedTableId] } : undefined;
            const pt = createLinkedPoint(board, points.coords[i], allProps, tileIds);
            this.handleCreatePoint(pt);
            pointsChanged = true;
          } else {
            const existing = getPoint(board, id);
            if (!isEqual(existing?.coords.usrCoords.slice(1), points.coords[i])) {
              applyChange(board, {
                operation: "update",
                target: "linkedPoint",
                targetID: id,
                properties: { position: points.coords[i] }
              });
              pointsChanged = true;
            }
            // Remove updated point from remaining list
            remainingIds.splice(existingIndex, 1);
          }
        }
      }

      // Now deal with any deleted points
      if (remainingIds.length > 0){
        applyChange(board, { operation: "delete", target: "linkedPoint", targetID: remainingIds });
        pointsChanged = true;
      }

      if (pointsChanged) {
        this.scaleToFit();
      }
    });
  }

  private handleZoomIn = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;
    content.zoomBoard(board, zoomFactor);
    logGeometryEvent(content, "update", "board", undefined, { userAction: "zoom in" });
  };

  private handleZoomOut = () => {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return;
    content.zoomBoard(board, 1/zoomFactor);
    logGeometryEvent(content, "update", "board", undefined, { userAction: "zoom out" });
  };

  private handleScaleToFit = () => {
    const content = this.getContent();
    logGeometryEvent(content, "update", "board", undefined, { userAction: "fit all" });
    this.scaleToFit();
  };

  private scaleToFit = () => {
    const { board } = this.state;
    if (!board || this.props.readOnly) return;
    const extents = getBoardObjectsExtents(board);
    this.rescaleBoardAndAxes(extents);
  };

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

  private handleLabelDialog = (selectedPoint: JXG.Point|undefined, selectedSegment: JXG.Line|undefined,
    selectedPolygon: JXG.Polygon|undefined) => {
    // If there are just two points in a polygon, we want to label the segment not the polygon.
    if (selectedSegment) {
      this.setState({ showSegmentLabelDialog: true });
    } else if (selectedPolygon) {
      this.setState({ showPolygonLabelDialog: true });
    } else {
      this.setState({ showPointLabelDialog: true });
    }
  };

  private handleSetPointLabelOptions =
      (point: JXG.Point, labelOption: ELabelOption, name: string, angleLabel: boolean) => {
    point._set("clientLabelOption", labelOption);
    point._set("clientName", name);
    setPropertiesForLabelOption(point);
    this.applyChange(() => {
      this.getContent().setPointLabelProps(point.id, name, labelOption);
      const vertexAngle = getVertexAngle(point);
      if (vertexAngle && !angleLabel) {
        this.handleUnlabelVertexAngle(vertexAngle);
      }
      if (!vertexAngle && angleLabel) {
        this.handleLabelVertexAngle(point);
      }
    });
    logGeometryEvent(this.getContent(), "update", "point", point.id, { text: name, labelOption });
  };

  private handleLabelVertexAngle = (point: JXG.Point) => {
    const { board } = this.state;
    const anglePts = getPointsForVertexAngle(point);
    if (board && anglePts) {
      const anglePtIds = anglePts.map(pt => pt.id);
      this.applyChange(() => {
        const angle = this.getContent().addVertexAngle(board, anglePtIds);
        if (angle) {
          this.handleCreateVertexAngle(angle);
        }
      });
    }
  };

  private handleUnlabelVertexAngle = (vertexAngle: JXG.Angle) => {
    const { board } = this.state;
    if (!board || !vertexAngle) return;
    this.applyChange(() => {
      this.getContent().removeObjects(board, vertexAngle.id);
    });
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
            (polygon: JXG.Polygon, points: [JXG.Point, JXG.Point], labelOption: ELabelOption, name: string) => {
    this.applyChange(() => {
      this.getContent().updatePolygonSegmentLabel(this.state.board, polygon, points, labelOption, name);
    });
  };

  private handleLabelPolygon = (polygon: JXG.Polygon, labelOption: ELabelOption, name: string) => {
    this.applyChange(() => {
      this.getContent().updatePolygonLabel(this.state.board, polygon, labelOption, name);
    });
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
                .slice(0, vertexCount),
              undefined,
              "rotate");
      });
    }
  };

  private handleSetShowColorPalette = (showColorPalette: boolean) => {
    const content = this.getContent();
    this.applyChange(() => content.setShowColorPalette(showColorPalette));
  };

  private handleColorChange = (color: number) => {
    const { board } = this.state;
    const content = this.getContent();
    if (!board) return;

    this.applyChange(() => {
      content.setSelectedColor(color);
    });

    const selectedObjects = content.selectedObjects(board);
    if (selectedObjects.length > 0) {
      this.applyChange(() => {
        content.updateSelectedObjectsColor(board, color);
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
      this.pasteObjects({ pasteId: hash, isSameTile: true, objects: copiedObjects }, "duplicate");
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

  private handleNewImage = (image: ImageMapEntry) => {
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
    this.pasteObjects({ pasteId, isSameTile, objects }, "paste");
  };

  // paste specified object content
  private pasteObjects = (pasteContent: IPasteContent, userAction: string) => {
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

        // Log both the old and new IDs
        const targetIds = [ ...Object.keys(idMap), ...Object.values(idMap)];
        logGeometryEvent(content, "paste", "object", targetIds, { userAction });
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

  private setBackgroundImage(image: ImageMapEntry) {
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
      else if (isCircle(elt)) {
        this.handleCreateCircle(elt);
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

  /**
   * Adjust display parameters depending on whether user is currently dragging a point.
   * @param value {boolean}
   */
  private setDragging(value: boolean) {
    this.state.board?.infobox.setAttribute({ opacity: value ? 1 : .75 });
  }

  private moveSelectedPoints(dx: number, dy: number) {
    this.beginDragSelectedPoints();
    if (this.endDragSelectedPoints(undefined, undefined, [0, dx, dy], "keyboard")) {
      const { board } = this.state;
      const content = this.getContent();
      if (board) {
        Object.keys(this.dragPts || {})
              .forEach(id => {
                const elt = getBoardObject(board, id);
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
    this.setDragging(true);
    if (board && !hasSelectionModifier(evt || {})) {
      content.metadata.selection.forEach((isSelected, id) => {
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

    const affectedObjects = _keys(this.dragPts).map(id => getBoardObject(board, id)).filter(notEmpty);
    updateVertexAnglesFromObjects(affectedObjects);
  }

  private endDragSelectedPoints(evt: any, dragTarget: JXG.GeometryElement | undefined,
      usrDiff: number[], userAction: string) {
    const { board } = this.state;
    const content = this.getContent();
    if (!board || !content) return false;
    this.setDragging(false);

    let didDragPoints = false;
    each(this.dragPts, (entry, id) => {
      const obj = getBoardObject(board, id);
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

      this.applyChange(() => content.updateObjects(board, ids, props, undefined, userAction));
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
      }

      // Consider whether we should create a point or not.
      if (readOnly || this.context.mode === "select" || hasSelectionModifier(evt)) {
        return;
      }

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

      // Certain objects can block point creation
      if (findBoardObject(board, elt => {
          const shouldIntercept = (this.context.mode === "polygon")
            ? shouldInterceptVertexCreation(elt)
            : shouldInterceptPointCreation(elt);
          return (shouldIntercept && elt.hasPoint(coords.scrCoords[1], coords.scrCoords[2]));
          })) {
        return;
      }

      // other clicks on board background create new points, perhaps starting a polygon or circle.
      this.applyChange(() => {
        const { point, polygon, circle } = geometryContent.realizePhantomPoint(board, [x, y], this.context.mode);
        if (point) {
          this.handleCreatePoint(point);
        }
        if (polygon) {
          this.handleCreatePolygon(polygon);
        }
        if (circle) {
          this.handleCreateCircle(circle);
        }
      });
    };

    // Don't create new points on top of an existing point, line, etc.
    const shouldInterceptPointCreation = (elt: JXG.GeometryElement) => {
      return isRealVisiblePoint(elt)
          || isVisibleEdge(elt)
          || isVisibleMovableLine(elt)
          || isComment(elt)
          || isMovableLineLabel(elt);
    };

    // When creating a polygon, don't put points on top of points or labels.
    // But, you can put a point on a line or inside another polygon.
    const shouldInterceptVertexCreation = (elt: JXG.GeometryElement) => {
      return isRealVisiblePoint(elt)
          || isComment(elt)
          || isMovableLineLabel(elt);
    };

    // synchronize initial selection
    const content = this.getContent();
    content.findObjects(board, (elt: JXG.GeometryElement) => isPoint(elt))
      .forEach(pt => {
        if (content.isSelected(pt.id)) {
          updateVisualProps(board, pt.id, true);
        }
      });

    if (this.props.onSetBoard) {
      this.props.onSetBoard(board);
    }

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  };

  private handleCreateAxis = (axis: JXG.Line) => {
    // nothing needed, but keep this method for consistency
  };

  private handleCreatePoint = (point: JXG.Point) => {

    const handlePointerDown = (evt: Event) => {
      const { board, mode } = this.context;
      const geometryContent = this.props.model.content as GeometryContentModelType;
      if (!board) return;
      const id = point.id;
      const coords = copyCoords(point.coords);
      const isPointDraggable = !this.props.readOnly && !point.getAttribute("fixed");

      if (mode === "circle") {
        // Either start a circle, or close the active circle using the clicked point
        this.applyChange(() => {
          let circle;
          if (geometryContent.activeCircleId) {
            circle = geometryContent.closeActiveCircle(board, point);
          } else {
            circle = geometryContent.createCircleIncludingPoint(board, point.id);
          }
          if (circle) {
            this.handleCreateCircle(circle);
          }
      });
      }

      // Polygon mode interactions with existing points
      if (mode === "polygon") {
        this.applyChange(() => {
          if (geometryContent.phantomPoint && geometryContent.activePolygonId) {
            const poly = getPolygon(board, geometryContent.activePolygonId);
            const vertex = poly && poly.vertices.find(p => p.id === id);
            if (vertex) {
              // user clicked on a vertex that is in the current polygon - close the polygon.
              const polygon = geometryContent.closeActivePolygon(board, vertex);
              if (polygon) {
                this.handleCreatePolygon(polygon);
              }
            } else {
              // use clicked a vertex that is not part of the current polygon - adopt it.
              geometryContent.addPointToActivePolygon(board, point.id);
            }
          } else {
            // No active polygon. Activate one for the point clicked.
            const polys = Object.values(point.childElements).filter(child => isPolygon(child));
            if (polys.length > 0 && isPolygon(polys[0])) {
              // The point clicked is in one or more polygons.
              // Activate the first polygon returned.
              const poly = polys[0];
              const polygon = geometryContent.makePolygonActive(board, poly.id, point.id);
              if (polygon) {
                this.handleCreatePolygon(polygon);
              }
            } else {
              // Point clicked is not part of a polygon.  Create one.
              const polygon = geometryContent.createPolygonIncludingPoint(board, point.id);
              if (polygon) {
                this.handleCreatePolygon(polygon);
              }
            }
          }
        });
        return;
      }

      this.dragPts = isPointDraggable ? { [id]: { initial: coords } } : {};
      this.lastPointDown = { evt, coords };

      // click on selected element - deselect if appropriate modifier key is down
      if (geometryContent.isSelected(id)) {
        if (evt instanceof MouseEvent && hasSelectionModifier(evt)) {
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
        if (evt instanceof MouseEvent && !hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        geometryContent.selectElement(board, id);
      }

      if (isPointDraggable) {
        this.beginDragSelectedPoints(evt, point);
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
        this.endDragSelectedPoints(evt, point, usrDiff, "drag point");
      }

      delete this.dragPts[id];
    };

    point.on("down", handlePointerDown);
    point.on("drag", handleDrag);
    point.on("up", handlePointerUp);
  };

  private handleCreateLine = (line: JXG.Line) => {

    function getVertices() {
      return [line.point1, line.point2];
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
      if (isInVertex(evt)) return;

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
          this.endDragSelectedPoints(evt, line, usrDiff, "drag segment");
        }
      }
      this.isVertexDrag = false;
    };

    line.on("down", handlePointerDown);
    line.on("drag", handleDrag);
    line.on("up", handlePointerUp);
  };

  private handleCreateCircle = (circle: JXG.Circle) => {

    const isInVertex = (evt: any) => {
      const { scale } = this.props;
      const { board } = this.state;
      if (!board) return false;
      const coords = getEventCoords(board, evt, scale);
      let inVertex = false;
      each(circle.ancestors, point => {
        if (isPoint(point) && point.hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
          inVertex = true;
        }
      });
      return inVertex;
    };

    const areAllVerticesSelected = () => {
      const geometryContent = this.props.model.content as GeometryContentModelType;
      let allSelected = true;
      each(circle.ancestors, point => {
        if (isPoint(point) && !geometryContent.isSelected(point.id)) {
          allSelected = false;
        }
      });
      return allSelected;
    };

    const handlePointerDown = (evt: any) => {
      const { readOnly, scale } = this.props;
      const { board } = this.state;
      if (!board || (circle !== getClickableObjectUnderMouse(board, evt, !readOnly, scale))) return;
      const geometryContent = this.props.model.content as GeometryContentModelType;
      const inVertex = isInVertex(evt);
      const allVerticesSelected = areAllVerticesSelected();
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (!hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        const ids = Object.values(circle.ancestors).filter(obj => isPoint(obj)).map(obj => obj.id);
        ids.push(circle.id);
        geometryContent.selectObjects(board, ids);
      }

      if (!readOnly) {
        // point handles vertex drags
        this.isVertexDrag = isInVertex(evt);
        if (!this.isVertexDrag) {
          this.beginDragSelectedPoints(evt, circle);
        }
      }
    };

    const handleDrag = (evt: any) => {
      if (this.props.readOnly || this.isVertexDrag) return;

      const vertex = circle.center;
      const dragEntry = this.dragPts[vertex.id];
      if (dragEntry && dragEntry.initial) {
        const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                    dragEntry.initial.usrCoords) as number[];
        this.dragSelectedPoints(evt, circle, usrDiff);
      }
      this.setState({ disableRotate: true });
    };

    const handlePointerUp = (evt: any) => {
      this.setState({ disableRotate: false });

      if (!this.props.readOnly && !this.isVertexDrag) {
        const vertex = circle.center;
        const dragEntry = this.dragPts[vertex.id];
        if (dragEntry && dragEntry.initial) {
          const usrDiff = JXG.Math.Statistics.subtract(vertex.coords.usrCoords,
                                                      dragEntry.initial.usrCoords) as number[];
          this.endDragSelectedPoints(evt, circle, usrDiff, "drag circle");
        }
      }
      this.isVertexDrag = false;
    };

    circle.on("down", handlePointerDown);
    circle.on("drag", handleDrag);
    circle.on("up", handlePointerUp);
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
      if (!inVertex && !allVerticesSelected) {
        // deselect other elements unless appropriate modifier key is down
        if (!hasSelectionModifier(evt)) {
          geometryContent.deselectAll(board);
        }
        const ids = Object.values(polygon.ancestors).filter(obj => isPoint(obj)).map(obj => obj.id);
        ids.push(polygon.id);
        geometryContent.selectObjects(board, ids);
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
          this.endDragSelectedPoints(evt, polygon, usrDiff, "drag polygon");
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
