import * as React from "react";
import { observer } from "mobx-react";
import { Editor } from "slate-react";
import Plain from "slate-plain-serializer";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";

import "./text-tool.sass";
​
interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

@observer
export default class TextToolComponent extends React.Component<IProps, {}> {

  // On change, update the app's React state with the new editor value.
  public onChange = ({ value }: any) => {
    const { readOnly, model: { content } } = this.props;
    if (!readOnly && (content.type === "Text")) {
      content.setSlate(value);
    }
  }

  // Render the editor.
  public render() {
    const { model } = this.props;
    const { content } = model;
    // Slate's readOnly disables selection; contenteditable's read-only supports selection
    // cf. https://github.com/ianstormtaylor/slate/issues/1909#issue-332955676
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    const value = (content as TextContentModelType).convertSlate();
    return (
      <Editor
        key={model.id}
        className={classes}
        readOnly={false}
        value={value}
        onChange={this.onChange}
      />
    );
  }
}
