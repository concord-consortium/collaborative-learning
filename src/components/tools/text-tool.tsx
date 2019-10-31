import * as Immutable from "immutable";
import * as React from "react";
import { observer, inject } from "mobx-react";
import { Operation, Value, Range } from "slate";
import { Editor, Plugin } from "slate-react";
import { isHotkey } from "is-hotkey";

import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { autorun, IReactionDisposer } from "mobx";
import { TextStyleBarComponent } from "./text-style-bar";
import { renderSlateMark, renderSlateBlock } from "./slate-renderers";

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

    |  Slate Name |  Markdown | HTML tag |   Hot-Key   |  Tool-Bar*  |
    |-------------|-----------|----------|-------------|-------------|
    | bold        | **xyzzy** | <strong> | CMD-b       | bold        |
    | italic      | _xyzzy_   | <em>     | CMD-i       | italic      |
    | code        | `xyzzy`   | <code>   |             | code        |
    | inserted    | ++xyzzy++ | <mark>   |             |             |
    | deleted     | ~~xyzzy~~ | <del>    |             |             |
    | underlined  | __xyzzy__ | <u>      | CMD-u       | underline   |
    | superscript |           | <sup>    | CMD-shift-, | subscript   |
    | subscript   |           | <sub>    | CMD-,       | superscript |

  Blocks:

    |   Slate Name    |   Markdown    |   HTML tag   | Tool-Bar* |
    |-----------------|---------------|--------------|-----------|
    | paragraph       |               | <p>          |           |
    | horizontal-rule | ---           | <hr>         |           |
    | heading1        | #             | <h1>         |           |
    | heading2        | ##            | <h2>         |           |
    | heading3        | ###           | <h3>         |           |
    | heading4        | ####          | <h4>         |           |
    | heading5        | #####         | <h5>         |           |
    | heading6        | ######        | <h6>         |           |
    | bulleted-list   | `* ` prefix   | <ul>         | list-ul   |
    | todo-list       | `- [ ] `      | <ul>         |           | broken
    | ordered-list    | `1. ` prefix  | <ol>         | list-ol   |
    | table           | \| & - syntax | <table>      |           | needs <tbody>
    | table-row       |               | <tr>         |           | needs <tbody>
    | table-head      |               | <th>         |           | needs <tbody>
    | table-cell      |               | <td>         |           | needs <tbody>
    | block-quote     | `> ` prefix   | <blockquote> |           |
    | image           | `![]` syntax  | <img>        |           | broken
    | link            | `[]()` syntax | <a>          |           | broken

  * The name in the Tool Bar column matches the Font Awesome icon name used in
  the TextToolBarComponent. This name is used to both render the button and to
  identify the button's action.

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
  key: string;
  type: string;
  isMark: boolean;  // False means this is a block.
}

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
  selectedButtons?: string[];
}

interface ISlateButtonMapEntry {
  slate: string;
  type: ESlateType;
  button: string | null;
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;
  private wrapper = React.createRef<HTMLDivElement>();
  private editor = React.createRef<Editor>();

  private plugins: Plugin[] = [
    this.makeOnKeyDownHandler({ key: "mod+b", type: "bold", isMark: true }),
    this.makeOnKeyDownHandler({ key: "mod+i", type: "italic", isMark: true }),
    this.makeOnKeyDownHandler({ key: "mod+u", type: "underlined", isMark: true }),
    this.makeOnKeyDownHandler({ key: "mod+shift+,", type: "superscript", isMark: true }),
    this.makeOnKeyDownHandler({ key: "mod+,", type: "subscript", isMark: true }),
  ];

  // This mapping table is required since the exact names of the slate block
  // and mark types don't exactly match the names of the Font Awesome button
  // names. See the private functions fromSlateToButton() and fromButtonToSlate()
  // function members of this class for how this table is used.
  private slateAndButtonNameMap: ISlateButtonMapEntry[] = [
    { slate: "bold", type: ESlateType.mark, button: "bold" },
    { slate: "italic", type: ESlateType.mark, button: "italic" },
    { slate: "code", type: ESlateType.mark, button: "code" },
    { slate: "inserted", type: ESlateType.mark, button: null },
    { slate: "deleted", type: ESlateType.mark, button: null },
    { slate: "underlined", type: ESlateType.mark, button: "underline" },
    { slate: "superscript", type: ESlateType.mark, button: "superscript" },
    { slate: "subscript", type: ESlateType.mark, button: "subscript" },
    { slate: "bulleted-list", type: ESlateType.block, button: "list-ul" },
    { slate: "ordered-list", type: ESlateType.block, button: "list-ol" },
  ];

  public onChange = (change: SlateChange) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;
    const listOfMarks = change.value.activeMarks;

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
        const buttonList: string[] = ["undo"];  // Always select "undo"
        if (listOfMarks) {
          listOfMarks.forEach(mark => {
            if (mark) {
              const buttonMap = this.fromSlateToButton(mark.type);
              if (buttonMap && buttonMap.button) {
                buttonList.push(buttonMap.button);
              }
            }
          });
        }

        const { document, selection } = change.value;
        const currentRange = Range.create(
          {
            anchor: selection.anchor,
            focus: selection.focus
          }
        );
        const nodes = document.getDescendantsAtRange(currentRange);
        ["ordered-list", "bulleted-list"].forEach((slateType) => {
          if (nodes.some((node: any) => node.type === slateType)) {
            const buttonMap = this.fromSlateToButton(slateType);
            if (buttonMap && buttonMap.button) {
              buttonList.push(buttonMap.button);
            }
          }
        });

        content.setSlate(change.value);
        this.setState(
          {
            value: change.value,
            selectedButtons: buttonList.sort()
          }
        );
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

    const renderStyleBar = !readOnly;
    const enableStyleBar = !readOnly && ui.isSelectedTile(model);

    if (!this.state.value) { return null; }

    const onClick = (buttonName: string, editor: Editor, event: React.MouseEvent) => {
      if (buttonName === "undo") {
        editor.undo();
        event.preventDefault();
      } else {
        const buttonDef = this.fromButtonToSlate(buttonName);
        if (buttonDef && buttonDef.button) {
          if (buttonDef.type === ESlateType.mark) {
            this.handleMarkEvent(buttonDef.button, event, editor);
          } else {  // Here, if button.Def.type === ESlateType.block
            this.handleBlockEvent(buttonDef.button, event, editor);
          }
        }
        event.preventDefault();
      }
      // If we had nothing to process, **do** not prevent the default mouse event.
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
          enabled={enableStyleBar}
          visible={renderStyleBar}
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
        />
      </div>
    );
  }

  private fromSlateToButton(slateName: string): ISlateButtonMapEntry | undefined {
    return (this.slateAndButtonNameMap.find((mapEntry: ISlateButtonMapEntry ) => mapEntry.slate === slateName));
  }

  private fromButtonToSlate(buttonName: string): ISlateButtonMapEntry | undefined {
    return (this.slateAndButtonNameMap.find(mapEntry => mapEntry.button === buttonName));
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

  private renderMark = (props: any, editor: any, next: () => any) => {
    const { children, mark, attributes } = props;
    const renderedMark = renderSlateMark(mark.type, attributes, children);
    return (renderedMark ? renderedMark : next());
  }

  private renderBlock = (props: any, editor: any, next: () => any) => {
    const { children, attributes, node: { type } } = props;
    const renderedBlock = renderSlateBlock(type, attributes, children);
    return (renderedBlock ? renderedBlock : next());
  }

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

  private handleMarkEvent(type: string, event: any, editor: any, next?: () => any) {
    const ed = editor.current ? editor.current : editor;
    const slateType = this.fromButtonToSlate(type)!.slate;
    switch (slateType) {
      case "undo":
        ed.undo();  // Not really a mark, nor a block.
        break;
      case "superscript":
      case "subscript":
        // Prevent the nesting of superscripts and subscripts.
        const hasType = ed.value.marks.some((m: any) => ["superscript", "subscript"].includes(m.slateType));
        !hasType ? ed.toggleMark(slateType) : ed.removeMark("superscript").removeMark("subscript");
        break;
      default:
        // Everything else (e.g. bold, underline, italic, typewriter, ...)
        ed.toggleMark(slateType);
        break;
    }
  }

  private handleBlockEvent(type: string, event: any, editor: any, next?: () => any) {
    const DEFAULT_BLOCK_TYPE = "";
    const ed = editor.current ? editor.current : editor;
    const { value: { blocks, document } } = ed;
    const containsListItems = blocks.some((block: any) => block.type === "list-item");
    const isListOfThisType = blocks.some((block: any) => {
      return !!document.getClosest(block.key, (parent: any) => parent.type === type);
    });
    const slateType = this.fromButtonToSlate(type)!.slate;
    switch (slateType) {
      case "undo":
        ed.undo();  // Not really a mark, nor a block.
        break;
      case "bulleted-list":
      case "ordered-list":
        if (!containsListItems) {
          // For a brand new list, first set the selection to be a list-item.
          // Then wrap the new list-items with the appropriate type of block.
          ed.setBlocks("list-item")
            .wrapBlock(slateType);
        } else if (isListOfThisType) {
          // If we are setting a list to it's existing type, we treat this as
          // a toggle-off. To do this, we unwrap the selection and remove all
          // list-items.
          ed.setBlocks("")  // Removes blocks typed w/ "list-item"
            .unwrapBlock("bulleted-list")
            .unwrapBlock("ordered-list");
        } else {
          // If we have bottomed out here, then we are switching a list between
          // bulleted <-> numbered.
          ed.unwrapBlock(slateType === "bulleted-list" ? "ordered-list" : "bulleted-list")
            .wrapBlock(slateType);
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
    const { key, type, isMark } = hotKeyDef;
    const onSlateEvent = (mark: boolean, slateType: string, event: any, editor: any, next: () => any) => {
      if (mark) {
        this.handleMarkEvent(slateType, event, editor, next);
      } else {
        this.handleBlockEvent(slateType, event, editor, next);
      }
      event.preventDefault();
    };
    return ({
      onKeyDown(event: any, editor: any, next: () => any) {
        if (isHotkey(key, event)) {
          onSlateEvent(isMark, type, event, editor, next);
        } else {
          next();
        }
      }
    });
  }

}
