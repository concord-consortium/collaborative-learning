import * as React from "react";
import memoize from "memoize-one";
import { Editor } from "slate-react";
import Plain from "slate-plain-serializer";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { Value } from "slate";

import "./text-tool.sass";
​
interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value: Value;
}

export default class TextToolComponent extends React.Component<IProps, IState> {
  // Set the initial value when the app is first constructed.
  public state = {
    value: Plain.deserialize("")
  };

  // use memoization to only deserialize when contents change
  // cf. https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html#what-about-memoization
  private deserializeTextContent = memoize(
    (content: TextContentModelType) => {
      const text = Array.isArray(content.text)
                    ? content.text.join("\n")
                    : content.text;
      // if (content.format === "markdown") {
      //   return markdownSerializer.deserialize(text);
      // }
      return Plain.deserialize(text);
    },
    // custom equality function
    (a: any, b: any) => a.toJSON() === b.toJSON()
  );
​
  // On change, update the app's React state with the new editor value.
  public onChange = ({ value }: any) => {
    // this.setState({ value });
  }

  // Render the editor.
  public render() {
    const { model } = this.props;
    const value = model.content.type === "Text"
                    ? this.deserializeTextContent(model.content)
                    : Plain.deserialize("");
    // Slate's readOnly disables selection; contenteditable's read-only supports selection
    // cf. https://github.com/ianstormtaylor/slate/issues/1909#issue-332955676
    const classes = `text-tool${this.props.readOnly ? " read-only" : ""}`;
    return (
      <Editor
        className={classes}
        readOnly={false}
        value={value}
        onChange={this.onChange}
      />
    );
  }
}
