import * as React from "react";
import { observer } from "mobx-react";
import { Change, Value } from "slate";
import { Editor } from "slate-react";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";

import "./text-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  prevContent?: TextContentModelType;
  value?: Value;
}
​
@observer
export default class TextToolComponent extends React.Component<IProps, IState> {

  public static getDerivedStateFromProps = (props: IProps, state: IState) => {
    const { model: { content } } = props;
    if (content === state.prevContent) { return null; }
    const textContent = content as TextContentModelType;
    const newState: IState = { prevContent: textContent };
    const value = textContent.convertSlate(state.value);
    if (value !== state.value) {
      newState.value = value;
    }
    return newState;
  }

  public state: IState = {};

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
    if (!this.state.value) { return null; }
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
