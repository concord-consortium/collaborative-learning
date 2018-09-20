import * as React from "react";
import { observer } from "mobx-react";
import { Change, Value } from "slate";
import { Editor } from "slate-react";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";

import "./text-tool.sass";

interface IState {
  value: Value;
}
​
interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

@observer
export default class TextToolComponent extends React.Component<IProps, IState> {

  public componentWillMount() {
    const { model: { content } } = this.props;
    if (content.type === "Text") {
      this.setState({ value: content.convertSlate() });
    }
  }

  public onChange = (change: Change) => {
    const { readOnly, model: { content } } = this.props;
    if (content.type === "Text") {
      if (!readOnly) {
        content.setSlate(change.value);
      }
      this.setState({ value: change.value });
    }
  }

  public render() {
    const { model, readOnly } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    return (
      <Editor
        key={model.id}
        className={classes}
        readOnly={readOnly}
        value={this.state.value}
        onChange={this.onChange}
      />
    );
  }
}
