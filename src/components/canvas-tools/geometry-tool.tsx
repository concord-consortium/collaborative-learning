import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { GeometryContentModelType } from "../../models/tools/geometry/geometry-content";
import { isBoard } from "../../models/tools/geometry/jxg-board";
import { isPoint, isFreePoint, isVisiblePoint } from "../../models/tools/geometry/jxg-point";
import { JXGCoordPair } from "../../models/tools/geometry/jxg-changes";
import { assign, cloneDeep, isEqual } from "lodash";
import { SizeMe } from "react-sizeme";

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
    const { context, model: { id, content } } = nextProps;
    if (!prevState.elementId) {
      // elide uuid for readability/debugging
      const debugId = `${id.slice(0, 4)}_${id.slice(id.length - 4)}`;
      const viewId = (content as GeometryContentModelType).nextViewId;
      return { content, elementId: `${context}-${debugId}-${viewId}` };
    }

    if (!prevState.board) { return null; }

    const nextState: IState = {};

    const { readOnly, size } = nextProps;
    if (size && (size.width != null) && (size.height != null) && prevState.size &&
        ((size.width !== prevState.size.width) || (size.height !== prevState.size.height))) {
      (content as GeometryContentModelType).resizeBoard(prevState.board, size.width, size.height);
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

  public componentWillUnmount() {
    const { model: { content } } = this.props;
    if ((content.type === "Geometry") && this.state.board) {
      content.destroyBoard(this.state.board);
    }
  }

  public render() {
    const { model, readOnly } = this.props;
    const { layout } = model;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `geometry-tool ${editableClass}`;
    const style = layout && layout.height
                    ? { height: layout.height }
                    : {};
    return (
      <div id={this.state.elementId} className={classes} style={style} />
    );
  }

  private initializeContent() {
    const { model: { content }, readOnly } = this.props;
    if ((content.type !== "Geometry") || !this.state.elementId) { return; }

    let board: JXG.Board | undefined;
    const elements = content.initializeBoard(this.state.elementId, readOnly);
    elements.forEach(elt => {
      if (isBoard(elt)) {
        board = elt as JXG.Board;
        this.installBoardEventHandlers(board);
      }
      else if (isPoint(elt)) {
        this.installPointEventHandlers(elt as JXG.Point);
      }
    });
    const newState = assign({ syncedChanges: content.changes.length },
                            board ? { board } : null);
    this.setState(newState);
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

  private installBoardEventHandlers(board: JXG.Board) {

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
          const pt = content.addPoint(board, [x, y], props) as JXG.Point;
          this.installPointEventHandlers(pt);
        });
      }
    };

    board.on("down", handlePointerDown);
    board.on("up", handlePointerUp);
  }

  private installPointEventHandlers(point: JXG.Point) {

    const handlePointerDown = (evt: any) => {
      const id = point.id;
      const coords = cloneDeep(point.coords);
      if (isFreePoint(point) && this.isDoubleClick(this.lastPointDown, { evt, coords })) {
        const { model: { content } } = this.props;
        const { board } = this.state;
        if (board && (content.type === "Geometry")) {
          this.applyChange(() => content.connectFreePoints(board));
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
}

export default class GeometryToolComponent extends React.Component<IProps, {}> {

  public static getDragImageNode(dragTargetNode: HTMLElement) {
    // dragTargetNode is the tool-tile div
    // firstChild is SizeMe div
    const child = dragTargetNode.firstChild;
    // firstChild's firstChild is the actual SVG, which works as a drag image
    return child && child.firstChild;
  }

  public render() {
    return (
      <SizeMe>
        {() => <GeometryToolComponentImpl {...this.props} />}
      </SizeMe>
    );
  }
}
