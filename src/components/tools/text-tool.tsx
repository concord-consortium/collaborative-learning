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

/*
  The Slate internal data model uses, among other things, "marks" and "blocks"
  to implement structured text. Marks are generally used for character styles
  and blocks are generally used to implement complex structures that are similar
  to the CSS-concept of "display: block", as opposed to, "display: inline".

  The following tables show the names used to distinguish the mark & block
  types within the slate model. These names have been selected to peacefully
  co-exist with the names generated when HTML and Markdown formatted text are
  converted to a slate model for presentation and editing in the text-tool.

  Marks:

    |  Slate Name |  Markdown | HTML tag |  Hot-Key  |
    |-------------|-----------|----------|-----------|
    | bold        | **xyzzy** | <strong> | CMD-b     |
    | italic      | _xyzzy_   | <em>     | CMD-i     |
    | code        | `xyzzy`   | <code>   |           |
    | inserted    | ++xyzzy++ | <mark>   |           |
    | deleted     | ~~xyzzy~~ | <del>    |           |
    | underlined  | __xyzzy__ | <u>      | CMD-u     |
    | superscript |           | <sup>    |           |
    | subscript   |           | <sub>    |           |

  Blocks:

    | Slate Name      | Markdown      | HTML tag     |
    |-----------------|---------------|----------|
    | paragraph       |               | <p>          |
    | horizontal-rule | ---           | <hr>         |
    | heading1        | #             | <h1>         |
    | heading2        | ##            | <h2>         |
    | heading3        | ###           | <h3>         |
    | heading4        | ####          | <h4>         |
    | heading5        | #####         | <h5>         |
    | heading6        | ######        | <h6>         |
    | bulleted-list   | `* ` prefix   | <ul>         |
    | todo-list       | `- [ ] `      | <ul>         | broken
    | ordered-list    | `1. ` prefix  | <ol>         |
    | code            | ```           | <code>       | blocks, unlike marks
    | table           | \| & - syntax | <table>      | needs <tbody>
    | table-row       |               | <tr>         | needs <tbody>
    | table-head      |               | <th>         | needs <tbody>
    | table-cell      |               | <td>         | needs <tbody>
    | block-quote     | `> ` prefix   | <blockquote> |
    | image           | `![]` syntax  | <img>        | broken
    | link            | `[]()` syntax | <a>          | broken
*/

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
      case "bold":
        return (<strong {...attributes}>{children}</strong>);
      case "code":
        return (<code {...attributes}>{children}</code>);
      case "italic":
        return (<em{ ...attributes}>{children}</em>);
      case "underlined":
        return (<u {...attributes}>{children}</u>);
      case "deleted":
        return (<del {...attributes}>{children}</del>);
      case "inserted":
        return (<mark {...attributes}>{children}</mark>);
      case "superscript":
        return (<sup {...attributes}>{children}</sup>);
      case "subscript":
        return (<sub {...attributes}>{children}</sub>);
      default:
        return next();
    }
  }

  private renderBlock = (props: any, editor: any, next: () => any ) => {
    const { children, attributes, node: {type} } = props;
    switch (type) {
      case "paragraph":
        return (<p {...attributes}>{children}</p>);
      case "heading1":
        return (<h1 {...{attributes}}>{children}</h1>);
      case "heading2":
        return (<h2 {...{attributes}}>{children}</h2>);
      case "heading3":
        return (<h3 {...{attributes}}>{children}</h3>);
      case "heading4":
        return (<h4 {...{attributes}}>{children}</h4>);
      case "heading5":
        return (<h5 {...{attributes}}>{children}</h5>);
      case "heading6":
        return (<h6 {...{attributes}}>{children}</h6>);
      case "code":
        return (<code {...attributes}>{children}</code>);
      case "ordered-list":
        return (<ol {...attributes}>{children}</ol>);
      case "bulleted-list":
      case "todo-list":
        return (<ul {...attributes}>{children}</ul>);
      case "list-item":
        return (<li {...{attributes}}>{children}</li>);
      case "horizontal-rule":
        return (<hr />);

      // Note: Tables, as are implemented in the current de-serializer, do not
      // nest a <tbody> element within the <table>. A new rule could easily
      // be added that would handle this case and bring the DOM in alignment
      // with the slate model.
      //
      // TODO: Add rule for <tbody>.

      case "table":
        return (<table {...attributes}>{children}</table>);
      case "table-row":
        return (<tr {...attributes}>{children}</tr>);
      case "table-head":
        return (<th {...attributes}>{children}</th>);
      case "table-cell":
        return (<td {...attributes}>{children}</td>);
      case "block-quote":
        return (<blockquote {...attributes}>{children}</blockquote>);
      case "image":  // TODO: This is broken.
        return (<img src={props.src} title={props.title} />);
      case "link":   // TODO: This is broken.
        return (<a href={props.href} {...attributes}>{children}</a>);
      default:
        return next();
    }
  }

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

}
