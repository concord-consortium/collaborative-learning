import * as Immutable from "immutable";
import * as React from "react";
import { observer, inject } from "mobx-react";
import { Operation, Value } from "slate";
import { Editor, Plugin } from "slate-react";
import { isHotkey } from "is-hotkey";

import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { autorun, IReactionDisposer, values } from "mobx";
import { TextStyleBarComponent } from "./text-style-bar";

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

    |  Slate Name |  Markdown | HTML tag |   Hot-Key   |
    |-------------|-----------|----------|-------------|
    | bold        | **xyzzy** | <strong> | CMD-b       |
    | italic      | _xyzzy_   | <em>     | CMD-i       |
    | code        | `xyzzy`   | <code>   |             |
    | inserted    | ++xyzzy++ | <mark>   |             |
    | deleted     | ~~xyzzy~~ | <del>    |             |
    | underlined  | __xyzzy__ | <u>      | CMD-u       |
    | superscript |           | <sup>    | CMD-shift-, |
    | subscript   |           | <sub>    | CMD-,       |

  Blocks:

    | Slate Name      | Markdown      | HTML tag     |
    |-----------------|---------------|--------------|
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

enum ESlateType {
  block,
  mark
}

interface IOnKeyDownHandlerDef {
  slateType: ESlateType;
  key: string;
  type: string;
}

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
  selectedButtons?: string[];
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;
  private prevMarks: string[] = [];
  private wrapper = React.createRef<HTMLDivElement>();
  private editor = React.createRef<Editor>();

  private plugins: Plugin[] = [
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark, key: "mod+b", type: "bold" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark, key: "mod+i", type: "italic" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark, key: "mod+u", type: "underlined" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark, key: "mod+shift+,", type: "superscript" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.mark, key: "mod+,", type: "subscript" }),

    this.makeOnKeyDownHandler({ slateType: ESlateType.mark || ESlateType.block, key: "mod+`", type: "code" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "alt+shift+b", type: "bulleted" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "alt+shift+n", type: "numbered" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "mod+alt+0", type: "deleted" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "mod+alt+1", type: "heading1" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "mod+alt+2", type: "heading2" }),
    this.makeOnKeyDownHandler({ slateType: ESlateType.block, key: "mod+alt+3", type: "heading3" }),
  ];

  public onChange = (change: SlateChange) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;
    const { selection } = change.value;

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
        const buttonList: string[] = [];
        if (selection.marks) {
          selection.marks.forEach( mark => {
            if (mark) {
              switch (mark.type) {
              case "underlined":
                buttonList.push("underline");
                break;
              default:
                buttonList.push(mark.type);
                break;
              }
            }
          });
        }
        const sortedMarks = buttonList.sort();
        content.setSlate(change.value);
        this.setState({ value: change.value });
        if (selection.marks && this.prevMarks !== sortedMarks) {
          this.prevMarks = sortedMarks;
          this.setState({ selectedButtons: sortedMarks });
        }
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
    const { ui, unit: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const classes = `text-tool text-tool-editor ${editableClass}`;

    const enableStyleBar = ! readOnly && ui.isSelectedTile(model);

    if (!this.state.value) { return null; }

    const onClick = (buttonName: string, editor: Editor, event: React.MouseEvent) => {
      // tslint:disable-next-line
      console.log(`onClick handler for style button: ${buttonName}`);
      event.preventDefault();
      switch (buttonName) {
        case "bold":
        case "italic":
        case "code":
        case "subscript":    // TODO: subs & supers need extra toggle logic see key handler
        case "superscript":
        case "undo":
          this.handleMarkEvent(buttonName, event, editor);
          break;
        case "underline":
          this.handleMarkEvent("underlined", event, editor);
          break;
        case "strikethrough":
          this.handleMarkEvent("deleted", event, editor);
          break;
        case "list-ul":
          this.handleBlockEvent("bulleted-list", event, editor);
          break;
        case "list-ol":
          this.handleBlockEvent("ordered-list", event, editor);
          break;
        }
    };

    return (
      // Ideally, this would just be 'text-tool' for consistency with other tools,
      // but 'text-tool` is used for the internal editor (cf. 'classes' above),
      // which is used for cypress tests and other purposes.
      <div className="text-tool-wrapper"
          ref={this.wrapper}
          onMouseDown={this.handleMouseDownInWrapper}>
        <TextStyleBarComponent
          selectedButtonNames={this.state.selectedButtons ? this.state.selectedButtons : []}
          clickHandler={onClick}
          editor={this.editor}
        />
        <Editor
          key={model.id}
          className={classes}
          ref={this.editor}
          placeholder={placeholderText}
          readOnly={readOnly}
          value={this.state.value}
          onChange={this.onChange}
          renderMark={this.renderMark}
          renderBlock={this.renderBlock}
          plugins={this.plugins}
          // ref={ editor => this.editor = editor! }
        />
      </div>
    );
  }

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model } = this.props;
    if (e.target === this.wrapper.current) {
      this.editor.current && this.editor.current.focus();
      ui.setSelectedTile(model);
      e.preventDefault();
    }
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

      // Note: Tables, as implemented in the current de-serializer, do not
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

  private handleMarkEvent(type: string, event: any, editor: any, next?: () => any) {
    const ed = editor.current ? editor.current : editor;
    switch (type) {
      case "undo":
        // Not really a mark, nor a block. We'll just stuff it here, for now.
        ed.undo();
        break;
      case "superscript":
      case "subscript":
        // Prevent the nesting of superscripts and subscripts.
        const hasType = ed.value.marks.some((m: any) => ["superscript", "subscript"].includes(m.type));
        !hasType ? ed.toggleMark(type) : ed.removeMark("superscript").removeMark("subscript");
        break;
      default:
        // Everything else (e.g. bold, underline, italic, typewriter)
        ed.toggleMark(type);
        break;
    }
  }

  private handleBlockEvent(type: string, event: any, editor: any, next?: () => any) {
    const DEFAULT_BLOCK_TYPE = "paragraph";
    const ed = editor.current ? editor.current : editor;
    const { value: { blocks, document } } = ed;
    const containsListItems = blocks.some((block: any) => block.type === "list-item");
    const isListOfThisType = blocks.some((block: any) => {
      return !!document.getClosest(block.key, (parent: any) => parent.type === type);
    });
    switch (type) {
      case "bulleted-list":
      case "ordered-list":
        // For a new list first set to a list-item then wrap with the appropriate type of block after
        if (!containsListItems) {
          ed.setBlocks("list-item")
            .wrapBlock(type);
        }
        else {
          isListOfThisType
            // Removes the list type
            ? ed.setBlocks(DEFAULT_BLOCK_TYPE)
                .unwrapBlock("bulleted-list")
                .unwrapBlock("ordered-list")
            // Clearing after switching to a new list type (or are that list type already)
            : ed.unwrapBlock(type === "bulleted-list" ? "ordered-list" : "bulleted-list")
                .unwrapBlock(type);
        }
        break;
      case "heading1":
      case "heading2":
      case "heading3":
      case "heading4":
      case "heading5":
      case "heading6":
      default:
        const isAlreadySet = blocks.some((block: any) => block.type === type);
        ed.setBlocks(isAlreadySet ? DEFAULT_BLOCK_TYPE : type);
        if (containsListItems) {
          // In this case, we are trying to change a block away from
          // being a list. To do this, we either set the type we are
          // after, or clear it, if it's already set to that type. Then
          // we remove any part of the selection that might be a wrapper
          // of either type of list.
          ed.unwrapBlock("bulleted-list")
            .unwrapBlock("ordered-list");
        }
        break;
    }
  }

  private makeOnKeyDownHandler(hotKeyDef: IOnKeyDownHandlerDef): Plugin {
    // Returns a Slate plug-in for an onKeyDown handler.
    const { key, type, slateType } = hotKeyDef;
    const onMarkEvent = (typeOfMark: string, event: any, editor: any, next: () => any) => {
      this.handleMarkEvent(typeOfMark, event, editor, next);
    };
    const onBlockEvent = (typeOfMark: string, event: any, editor: any, next: () => any) => {
      this.handleBlockEvent(typeOfMark, event, editor, next);
    };
    switch (slateType) {
      case ESlateType.mark:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            if (!isHotkey(key, event)) {
              next();
            }
            else {
              onMarkEvent(type, event, editor, next);
              event.preventDefault();
            }
          }
        });
      case ESlateType.block:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            if (! isHotkey(key, event)) {
              next();
            }
            else {
              onBlockEvent(type, event, editor, next);
              event.preventDefault();
            }
          }
        });
      default:
        return ({
          onKeyDown(event: any, editor: any, next: () => any) {
            // tslint:disable-next-line
            console.log(`Internal error: unknown Slate editor type "${slateType}"`);
          }
        });
    }
  }
}
