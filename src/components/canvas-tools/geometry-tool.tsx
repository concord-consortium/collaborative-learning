import * as React from "react";
import { observer } from "mobx-react";
import { ToolTileModelType } from "../../models/tools/tool-tile";

import "./text-tool.sass";

interface IProps {
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
@observer
export default class GeometryToolComponent extends React.Component<IProps, IState> {

  public componentDidMount() {
    const { model } = this.props;
    const { id, content } = model;
    if (content.type === "Geometry") {
      const board = content.initialize(id);
      this.setState({ board });

      if (board) {
        board.on("down", this.downHandler);
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
    const { id, layout } = model;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `geometry-tool ${editableClass}`;
    const style = layout && layout.height
                    ? { height: layout.height }
                    : {};
    return (
      <div id={id} className={classes} style={style} />
    );
  }

  // cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
  private downHandler = (evt: any) => {
    const { board } = this.state;
    if (!board) { return; }
    const index = evt[JXG.touchProperty] ? 0 : undefined;
    const coords = getEventCoords(board, evt, index);
    let el;

    for (el in board.objects) {
      if (JXG.isPoint(board.objects[el]) &&
          board.objects[el].hasPoint(coords.scrCoords[1], coords.scrCoords[2])) {
        return;
      }
    }

    const { model: { content } } = this.props;
    if (content.type === "Geometry") {
      const x = JXG._round10(coords.usrCoords[1], -1);
      const y = JXG._round10(coords.usrCoords[2], -1);
      content.addPoint(board, [x, y]);
    }
  }
}
