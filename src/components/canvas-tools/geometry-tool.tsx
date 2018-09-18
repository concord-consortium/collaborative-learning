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
​
@observer
export default class GeometryToolComponent extends React.Component<IProps, IState> {

  public componentDidMount() {
    const { model } = this.props;
    const { id, content } = model;
    if (content.type === "Geometry") {
      const board = content.initialize(id);
      this.setState({ board });
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
}
