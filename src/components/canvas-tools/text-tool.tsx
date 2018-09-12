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

  private editor: Editor | null;

  // use memoization to only deserialize when contents change
  // cf. https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html#what-about-memoization
  private deserializeTextContent = memoize(
    (content: TextContentModelType) => {
      const text = content.joinText;
      switch (content.format) {
        case "slate":
          return content.getSlate();
        case "markdown":
          // handle markdown import here; for now we treat as text
        default:
          return Plain.deserialize(text);
      }
    },
    // custom equality function
    (a: any, b: any) => a.toJSON() === b.toJSON()
  );

  public componentWillMount() {
    const { model } = this.props;
    if (model.content.type === "Text") {
      this.setState({ value: this.deserializeTextContent(model.content) });
    }
  }

  public componentWillUnmount() {
    if (this.editor) {
      this.editor.blur();
    }
  }
​
  // On change, update the app's React state with the new editor value.
  public onChange = ({ value }: any) => {
    if (!this.props.readOnly) {
      this.setState({ value });
    }
  }

  public onBlur = () => {
    const { model } = this.props;
    if (!this.props.readOnly && (model.content.type === "Text")) {
      model.content.setSlate(this.state.value);
    }
  }

  // Render the editor.
  public render() {
    const { model } = this.props;
    // Slate's readOnly disables selection; contenteditable's read-only supports selection
    // cf. https://github.com/ianstormtaylor/slate/issues/1909#issue-332955676
    const editableClass = this.props.readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    const value = this.props.readOnly
                    ? this.deserializeTextContent(model.content as any)
                    : this.state.value;
    return (
      <Editor
        ref={(el) => { this.editor = el; }}
        key={model.id}
        className={classes}
        readOnly={false}
        value={value}
        onChange={this.onChange}
        onBlur={this.onBlur}
      />
    );
  }
}
