import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { GeometryContentModelType } from "../../models/tools/geometry/geometry-content";
import * as sizeMe from "react-sizeme";

import "./geometry-tool.sass";

interface SizeMeProps {
  size?: {
    width: number | null;
    height: number | null;
  };
}

interface IProps extends SizeMeProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState extends SizeMeProps {
  elementId?: string;
  board?: JXG.Board;
  content?: GeometryContentModelType;
  syncChanges?: number;
}

// cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
function getEventCoords(board: JXG.Board, evt: any, index?: number) {
  const cPos = board.getCoordsTopLeftCorner();
  const absPos = JXG.getPosition(evt, index);
  const dx = absPos[0] - cPos[0];
  const dy = absPos[1] - cPos[1];

  return new JXG.Coords(JXG.COORDS_BY_SCREEN, [dx, dy], board);
}
​
@inject("stores")
@observer
class GeometryToolComponent extends BaseComponent<IProps, IState> {

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

    const { size } = nextProps;
    if (size && (size.width != null) && (size.height != null) && prevState.size &&
        ((size.width !== prevState.size.width) || (size.height !== prevState.size.height))) {
      (content as GeometryContentModelType).resizeBoard(prevState.board, size.width, size.height);
      nextState.size = size;
    }

    if (content !== prevState.content) {
      const geometryContent = content as GeometryContentModelType;
      if (geometryContent.changes.length !== prevState.syncChanges) {
        for (let i = prevState.syncChanges || 0; i < geometryContent.changes.length; ++i) {
          try {
            const change = JSON.parse(geometryContent.changes[i]);
            geometryContent.syncChange(prevState.board, change);
          }
          catch (e) {
            // ignore exceptions
          }
        }
      }
      nextState.content = geometryContent;
    }
    return nextState;
  }

  public state: IState = {};

  private lastPtrDownEvent: any;
  private lastPtrDownCoords: JXG.Coords | undefined;

  public componentDidMount() {
    const { model: { content }, size } = this.props;
    if ((content.type === "Geometry") && this.state.elementId) {
      const board = content.initializeBoard(this.state.elementId);
      const syncChanges = content.changes.length;
      this.setState({ board, size, syncChanges });

      if (board) {
        board.on("down", this.pointerDownHandler);
        board.on("up", this.pointerUpHandler);
      }
    }
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

  private applyChange(change: () => void) {
    this.setState({ syncChanges: (this.state.syncChanges || 0) + 1 }, change);
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

  private pointerDownHandler = (evt: any) => {
    const { board } = this.state;
    const { model } = this.props;
    const { ui } = this.stores;
    if (!board) { return; }

    // first click selects the tile; subsequent clicks create points
    if (!ui.isSelectedTile(model)) {
      ui.setSelectedTile(model);
      return;
    }

    const index = evt[JXG.touchProperty] ? 0 : undefined;
    const coords = getEventCoords(board, evt, index);
    const x = coords.usrCoords[1];
    const y = coords.usrCoords[2];
    if ((x != null) && isFinite(x) && (y != null) || isFinite(y)) {
      this.lastPtrDownEvent = evt;
      this.lastPtrDownCoords = coords;
    }
  }

  // cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
  private pointerUpHandler = (evt: any) => {
    const { board } = this.state;
    if (!board || !this.lastPtrDownEvent || !this.lastPtrDownCoords) { return; }

    const index = evt[JXG.touchProperty] ? 0 : undefined;
    const coords = getEventCoords(board, evt, index);
    let [ , x, y] = this.lastPtrDownCoords.usrCoords;
    if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) {
      return;
    }

    const clickTimeThreshold = 500;
    if (evt.timeStamp - this.lastPtrDownEvent.timeStamp > clickTimeThreshold) {
      return;
    }

    const clickSqrDistanceThreshold = 9;
    if (!this.isSqrDistanceWithinThreshold(clickSqrDistanceThreshold, this.lastPtrDownCoords, coords)) {
      return;
    }

    let el;
    for (el in board.objects) {
      if (JXG.isPoint(board.objects[el]) &&
          board.objects[el].hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
        return;
      }
    }

    const { model: { content } } = this.props;
    if (content.type === "Geometry") {
      x = JXG._round10(x, -1);
      y = JXG._round10(y, -1);
      this.applyChange(() => content.addPoint(board, [x, y]));
    }
  }
}

export default sizeMe()(GeometryToolComponent);
