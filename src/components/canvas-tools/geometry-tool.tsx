import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { GeometryContentModelType, kGeometryDefaultPixelsPerUnit } from "../../models/tools/geometry/geometry-content";
import { isPoint, isFreePoint, isVisiblePoint } from "../../models/tools/geometry/jxg-point";
import { isPolygon } from "../../models/tools/geometry/jxg-polygon";
import { JXGCoordPair, JXGProperties } from "../../models/tools/geometry/jxg-changes";
import { assign, cloneDeep, each, isEqual, some } from "lodash";
import { SizeMe } from "react-sizeme";

import "./geometry-tool.sass";
import { extractDragTileType, kDragTileContent } from "./tool-tile";
import { getImageDimensions } from "../../utilities/image-utils";

interface SizeMeProps {
  size?: {
    width: number | null;
    height: number | null;
  };
}

interface IProps extends SizeMeProps {
  context: string;
  scale?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState extends SizeMeProps {
  elementId?: string;
  board?: JXG.Board;
  content?: GeometryContentModelType;
  syncedChanges?: number;
}

interface JXGPtrEvent {
  evt: any;
  coords: JXG.Coords;
}

// For snap to grid
const kSnapUnit = 0.2;

// cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
function getEventCoords(board: JXG.Board, evt: any, scale?: number, index?: number) {
  const cPos = board.getCoordsTopLeftCorner();
  const absPos = JXG.getPosition(evt, index);
  const dx = (absPos[0] - cPos[0]) / (scale || 1);
  const dy = (absPos[1] - cPos[1]) / (scale || 1);

  return new JXG.Coords(JXG.COORDS_BY_SCREEN, [dx, dy], board);
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

    const nextState: IState = {};

    const { readOnly, size } = nextProps;
    if (size && size.width && size.height && (!prevState.size ||
        ((size.width !== prevState.size.width) || (size.height !== prevState.size.height)))) {
      (content as GeometryContentModelType).resizeBoard(prevState.board, size.width, size.height, scale);
      nextState.size = size;
    }

    if (content !== prevState.content) {
      const geometryContent = content as GeometryContentModelType;
      if (geometryContent.changes.length !== prevState.syncedChanges) {
        for (let i = prevState.syncedChanges || 0; i < geometryContent.changes.length; ++i) {
          try {
            const change = JSON.parse(geometryContent.changes[i]);
            const result = geometryContent.syncChange(prevState.board, change);
            if (readOnly && (result instanceof JXG.GeometryElement)) {
              const obj = result as JXG.GeometryElement;
              obj.setAttribute({ fixed: true });
            }
          }
          catch (e) {
            // ignore exceptions
          }
        }
        nextState.syncedChanges = geometryContent.changes.length;
      }
      nextState.content = geometryContent;
    }
    return nextState;
  }

  public state: IState = {};

  private lastBoardDown: JXGPtrEvent;
  private lastPointDown?: JXGPtrEvent;
  private dragPts: { [id: string]: { initial: JXG.Coords, final?: JXG.Coords }} = {};

  public componentDidMount() {
    this.initializeContent();
  }

  public componentDidUpdate() {
    // if we didn't initialize before now, try again
    if (!this.state.board) {
      this.initializeContent();
    }
  }

  public componentWillUnmount() {
    const { model: { content } } = this.props;
    if ((content.type === "Geometry") && this.state.board) {
      content.destroyBoard(this.state.board);
    }
  }

  public render() {
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `geometry-tool ${editableClass}`;
    return (
      <div id={this.state.elementId} className={classes}
          onDragOver={this.handleDragOver} onDrop={this.handleDrop} />
    );
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

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const toolType = extractDragTileType(e.dataTransfer);
    const kImgDragMargin = 25;
    if (toolType === "image") {
      const eltBounds = e.currentTarget.getBoundingClientRect();
      if ((e.clientX > eltBounds.left + kImgDragMargin) &&
          (e.clientX < eltBounds.right - kImgDragMargin) &&
          (e.clientY > eltBounds.top + kImgDragMargin) &&
          (e.clientY < eltBounds.bottom - kImgDragMargin)) {
        return true;
      }
    }
    return false;
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.isAcceptableImageDrag(e)) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
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
        getImageDimensions(dimensions => {
          const width = dimensions.width / kGeometryDefaultPixelsPerUnit;
          const height = dimensions.height / kGeometryDefaultPixelsPerUnit;
          geometryContent.addImage(board, urlOrProxy, [0, 0], [width, height]);
        }, undefined, urlOrProxy);
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
    this.setState({ syncedChanges: (this.state.syncedChanges || 0) + 1 }, change);
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

  private handleCreateBoard = (board: JXG.Board) => {

    const handlePointerDown = (evt: any) => {
      const { model, readOnly, scale } = this.props;
      const { ui } = this.stores;

      // first click selects the tile; subsequent clicks create points
      if (!ui.isSelectedTile(model)) {
        ui.setSelectedTile(model);
        return;
      }

      if (readOnly) { return; }

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
      if (readOnly || !this.lastBoardDown) { return; }

      // cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
      const index = evt[JXG.touchProperty] ? 0 : undefined;
      const coords = getEventCoords(board, evt, scale, index);
      const [ , x, y] = this.lastBoardDown.coords.usrCoords;
      if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) {
        return;
      }

      const clickTimeThreshold = 500;
      if (evt.timeStamp - this.lastBoardDown.evt.timeStamp > clickTimeThreshold) {
        return;
      }

      const clickSqrDistanceThreshold = 9;
      if (!this.isSqrDistanceWithinThreshold(clickSqrDistanceThreshold, this.lastBoardDown.coords, coords)) {
        return;
      }

      let el;
      for (el in board.objects) {
        if (isVisiblePoint(board.objects[el]) &&
            board.objects[el].hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
          return;
        }
      }

      const { model: { content } } = this.props;
      if (content.type === "Geometry") {
        const props = { snapToGrid: true, snapSizeX: kSnapUnit, snapSizeY: kSnapUnit };
        this.applyChange(() => {
          const point = content.addPoint(board, [x, y], props) as JXG.Point;
          this.handleCreatePoint(point);
        });
      }
    };

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  }

  private handleCreatePoint = (point: JXG.Point) => {

    const handlePointerDown = (evt: any) => {
      const id = point.id;
      const coords = cloneDeep(point.coords);
      if (isFreePoint(point) && this.isDoubleClick(this.lastPointDown, { evt, coords })) {
        const { model: { content } } = this.props;
        const { board } = this.state;
        if (board && (content.type === "Geometry")) {
          this.applyChange(() => {
            const polygon = content.createPolygonFromFreePoints(board) as JXG.Polygon;
            this.handleCreatePolygon(polygon);
          });
          this.lastPointDown = undefined;
        }
      }
      else {
        this.dragPts[id] = { initial: coords };
        this.lastPointDown = { evt, coords };
      }
    };

    const handleDrag = (evt: any) => {
      const id = point.id;
      let dragEntry = this.dragPts[id];
      if (!dragEntry) {
        dragEntry = this.dragPts[id] = { initial: cloneDeep(point.coords) };
      }
      dragEntry.final = cloneDeep(point.coords);
    };

    const handlePointerUp = (evt: any) => {
      const id = point.id;
      const dragEntry = this.dragPts[id];
      if (!dragEntry) { return; }

      dragEntry.final = cloneDeep(point.coords);

      if (!isEqual(dragEntry.initial.usrCoords, dragEntry.final.usrCoords)) {
        const { content } = this.props.model;
        const { board } = this.state;
        if ((content.type === "Geometry") && board) {
          const coords = dragEntry.final.usrCoords.slice(1) as JXGCoordPair;
          const props = { position: coords };
          this.applyChange(() => content.updateObjects(board, id, props));
        }
      }
    };

    point.on("down", handlePointerDown);
    point.on("drag", handleDrag);
    point.on("up", handlePointerUp);
  }

  private handleCreatePolygon = (polygon: JXG.Polygon) => {

    const handlePointerDown = (evt: any) => {
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        this.dragPts[pt.id] = { initial: cloneDeep(pt.coords) };
      });
    };

    const handleDrag = (evt: any) => {
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        if (!this.dragPts[pt.id]) {
          this.dragPts[pt.id] = { initial: cloneDeep(pt.coords) };
        }
        this.dragPts[pt.id].final = cloneDeep(pt.coords);
      });
    };

    const didPolygonMove = () => {
      return some(polygon.ancestors, point => {
        const dragEntry = this.dragPts[point.id];
        return dragEntry.final
                ? !isEqual(dragEntry.initial.usrCoords, dragEntry.final.usrCoords)
                : false;
      });
    };

    const handlePointerUp = (evt: any) => {
      each(polygon.ancestors, point => {
        const pt = point as JXG.Point;
        const dragEntry = this.dragPts[pt.id];
        if (!dragEntry) {
          this.dragPts[pt.id] = { initial: cloneDeep(pt.coords) };
        }
        dragEntry.final = cloneDeep(pt.coords);
      });

      if (!didPolygonMove()) return;

      const { content } = this.props.model;
      const { board } = this.state;
      if ((content.type === "Geometry") && board) {
        const idArray: string[] = [];
        const propsArray: JXGProperties[] = [];
        each(polygon.ancestors, point => {
          const dragEntry = this.dragPts[point.id];
          const coords = dragEntry.final!.usrCoords.slice(1) as JXGCoordPair;
          idArray.push(point.id);
          propsArray.push({ position: coords });
        });
        this.applyChange(() => content.updateObjects(board, idArray, propsArray));
      }
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
