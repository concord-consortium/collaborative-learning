import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";

import "./text-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  board?: JXG.Board;
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
export default class GeometryToolComponent extends BaseComponent<IProps, IState> {

  private elementId: string;
  private lastPtrDownEvent: any;
  private lastPtrDownCoords: JXG.Coords | undefined;

  public componentWillMount() {
    const { context, model: { id } } = this.props;
    this.elementId = `${context}-${id}`;
  }

  public componentDidMount() {
    const { model: { content } } = this.props;
    const elt = document.getElementById(this.elementId);
    if (content.type === "Geometry") {
      const board = content.initialize(this.elementId);
      this.setState({ board });

      if (board) {
        board.on("down", this.pointerDownHandler);
        board.on("up", this.pointerUpHandler);
      }
    }
  }

  public componentWillUnmount() {
    const { model: { content } } = this.props;
    if ((content.type === "Geometry") && this.state.board) {
      content.destroy(this.state.board);
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
      <div id={this.elementId} className={classes} style={style} />
    );
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

    ui.setSelectedTile(model);

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
      content.addPoint(board, [x, y]);
    }
  }
}
