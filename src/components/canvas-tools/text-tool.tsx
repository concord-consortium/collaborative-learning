import * as React from "react";
import { observer } from "mobx-react";
import { Change } from "slate";
import { Editor } from "slate-react";
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

  public onChange = (change: Change) => {
    const { readOnly, model: { content } } = this.props;
    if (content.type === "Text") {
      if (readOnly) {
        content.setSlateReadOnly(change.value);
      }
      else {
        content.setSlate(change.value);
      }
    }
  }

  public render() {
    const { model } = this.props;
    const { content } = model;
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    // Slate's readOnly mode interacts poorly with MST/React.
    // We prevent readOnly from making model changes in onChange().
    // Unfortunately, copy from readOnly doesn't work for unknown reasons.
    const readOnly = false;
    const value = (content as TextContentModelType).convertSlate();
    // triggers re-render on changes, even if resulting stringified JSON is the same
    const changes = content.type === "Text" ? content.changes : 0;
    return (
      <Editor
        key={model.id}
        className={classes}
        readOnly={readOnly}
        value={value}
        onChange={this.onChange}
        data-changes={changes}
      />
    );
  }
}
