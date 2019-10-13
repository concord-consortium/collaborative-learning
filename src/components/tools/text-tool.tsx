import * as Immutable from "immutable";
import * as React from "react";
import { observer, inject } from "mobx-react";
import { Operation, Value } from "slate";
import { Editor } from "slate-react";

import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { autorun, IReactionDisposer } from "mobx";

import "./text-tool.sass";

interface SlateChange {
  operations: Immutable.List<Operation>;
  value: Value;
}

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
}
​
function BulletItem(props: any) {
  return (
    <ul {...props.attributes}>{props.children}</ul>
  );
}

function NumberedItem(props: any) {
  return (
    <ol {...props.attributes}>{props.children}</ol>
  );
}

function Typewriter(props: any) {
  const { children, attributes } = props;
  return (
    <code {...attributes}>{children}</code>
  );
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;

  public onChange = (change: SlateChange) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;

    // determine last focus state from list of operations
    let isFocused: boolean | undefined;
    change.operations.forEach(op => {
      if (op && op.type === "set_selection") {
        isFocused = op.properties.isFocused;
      }
    });

    if (isFocused != null) {
      // polarity is reversed from what one might expect
      if (!isFocused) {
        // only select - if we deselect, it breaks delete because Slate
        // somehow detects the selection change before the click on the
        // delete button is processed by the workspace. For now, we just
        // disable focus change on deselection.
        ui.setSelectedTile(model);
      }
    }

    if (content.type === "Text") {
      if (!readOnly) {
        content.setSlate(change.value);
        this.setState({ value: change.value });
      }
    }
  }

  public componentDidMount() {
    const initialTextContent = this.props.model.content as TextContentModelType;
    this.prevText = initialTextContent.text;
    const initialValue = initialTextContent.asSlate();
    this.setState({
      value: initialValue
    });

    this.disposers = [];
    if (this.props.readOnly) {
      this.disposers.push(autorun(() => {
        const textContent = this.props.model.content as TextContentModelType;
        if (this.prevText !== textContent.text) {
          this.setState({ value: textContent.asSlate() });
          this.prevText = textContent.text;
        }
      }));
    }
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
  }

  public render() {
    const { model, readOnly } = this.props;
    const { unit: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;

    if (!this.state.value) { return null; }
    return (
      <div>
        <Editor
          key={model.id}
          className={classes}
          placeholder={placeholderText}
          readOnly={readOnly}
          value={this.state.value}
          onChange={this.onChange}
          renderMark={this.renderMark}
          renderBlock={this.renderBlock}
        />
      </div>
    );
  }

  private renderMark = (props: any, editor: any, next: () => any ) => {
    const { children, mark, attributes } = props;
    switch (mark.type) {
      case "bold": return (<strong{...{ attributes }}>{children}</strong>);
      case "italic": return (<em{...{ attributes }}>{children}</em>);
      case "underline": return (<u{...{ attributes }}>{children}</u>);
      case "typewriter": return (<Typewriter {...props} />);
      case "superscript": return (<sup{...{ attributes }}>{children}</sup>);
      case "subscript": return (<sub{...{ attributes }}>{children}</sub>);
      default: return next();
    }
  }

  private renderBlock = (props: any, editor: any, next: () => any ) => {
    const { children, attributes, node: {type} } = props;
    switch (type) {
      case "bulleted": return (<BulletItem {...props} />);
      case "numbered": return (<NumberedItem {...props} />);
      case "list-item": return (<li {...{attributes}}>{children}</li>);
      case "header-1": return (<h1 {...{attributes}}>{children}</h1>);
      case "header-2": return (<h2 {...{attributes}}>{children}</h2>);
      case "header-3": return (<h3 {...{attributes}}>{children}</h3>);
      default: return next();
    }
  }

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

}
