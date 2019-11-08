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
import { hasSelectionModifier } from "../../utilities/event-utils";

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

  There are slate blocks and marks that are not mapped to any user actions in
  the editor; however, they handed by this tool (when readonly) as a way to
  render styled text in the curriculum. In other words, just because there's
  no way for a user to create a particular style in the editor, this tool may
  still need to render it. See the heading1 - heading6 slate blocks for
  example.

  Marks:

    |  Slate Name |  Markdown | HTML tag |   Hot-Key   |  Tool-Bar*  |
    |-------------|-----------|----------|-------------|-------------|
    | bold        | **xyzzy** | <strong> | CMD-b       | bold        |
    | italic      | _xyzzy_   | <em>     | CMD-i       | italic      |
    | code        | `xyzzy`   | <code>   |             | code        |
    | inserted    | ++xyzzy++ | <mark>   |             |             |
    | deleted     | ~~xyzzy~~ | <del>    |             |             |
    | underlined  | __xyzzy__ | <u>      | CMD-u       | underline   |
    | superscript |           | <sup>    | CMD-shift-, | superscript |
    | subscript   |           | <sub>    | CMD-,       | subscript   |

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

enum SlateNodeType {
  block = "block",
  mark = "mark"
}

interface ISlateMapEntry {
  slateType: string;          // Slate's block & mark names, like "bulleted-list"
  nodeType: SlateNodeType;    // Either block or mark
  buttonIconName?: string;    // If missing, there is no tool-bar support
  hotKey?: string;            // If missing, not a keyboard function.
}

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  value?: Value;
  selectedButtons?: string[];
}

// create a global keylistener so that we know if the selection modifier keys are in use
// when we get a change event
let selectionModiferKeyDown = false;
const globalOnKeyDown = (e: KeyboardEvent) => {
  selectionModiferKeyDown = selectionModiferKeyDown || hasSelectionModifier(e);
};
const globalOnKeyUp = (e: KeyboardEvent) => selectionModiferKeyDown = false;
window.addEventListener("keydown", globalOnKeyDown);
window.addEventListener("keyup", globalOnKeyUp);

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;
  private wrapper = React.createRef<HTMLDivElement>();
  private editor = React.createRef<Editor>();

  private slateMap: ISlateMapEntry[] = [
    // This table is needed to translate between Slate's block and mark types
    // and the parameters required for event handling. (Sometimes the name
    // differences are a little subtle.)
    {
      slateType: "bold",
      nodeType: SlateNodeType.mark,
      buttonIconName: "bold",
      hotKey: "mod+b"
    },
    {
      slateType: "italic",
      nodeType: SlateNodeType.mark,
      buttonIconName: "italic",
      hotKey: "mod+i"
    },
    {
      slateType: "code",
      nodeType: SlateNodeType.mark,
      buttonIconName: "code",
      hotKey: undefined
    },
    {
      slateType: "inserted",
      nodeType: SlateNodeType.mark,
      buttonIconName: undefined,
      hotKey: undefined
    },
    {
      slateType: "deleted",
      nodeType: SlateNodeType.mark,
      buttonIconName: undefined,
      hotKey: undefined
    },
    {
      slateType: "underlined",
      nodeType: SlateNodeType.mark,
      buttonIconName: "underline",
      hotKey: "mod+u"
    },
    {
      slateType: "superscript",
      nodeType: SlateNodeType.mark,
      buttonIconName: "superscript",
      hotKey: "mod+shift+,"
    },
    {
      slateType: "subscript",
      nodeType: SlateNodeType.mark,
      buttonIconName: "subscript",
      hotKey: "mod+,",
    },
    {
      slateType: "bulleted-list",
      nodeType: SlateNodeType.block,
      buttonIconName: "list-ul",
      hotKey: undefined
    },
    {
      slateType: "ordered-list",
      nodeType: SlateNodeType.block,
      buttonIconName: "list-ol",
      hotKey: undefined
    },
  ];

  // This set of plugins (as required by the Slate Editor component) provide
  // the mapping of a hot-key to the required handler.
  private slatePlugins: Plugin[] =
    this.slateMap.filter(entry => !!entry.hotKey)
      .map(entry => this.makeKeyDownHandler(entry));

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
        ui.setSelectedTile(model, {append: selectionModiferKeyDown});
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
    const { ui, unit: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const classes = `text-tool text-tool-editor ${editableClass}`;

    const renderStyleBar = !readOnly;
    const enableStyleBar = !readOnly && ui.isSelectedTile(model);

    if (!this.state.value) { return null; }

    const handleToolBarButtonClick = (
        buttonIconName: string,
        editor: any,
        event: React.MouseEvent) => {
      if (buttonIconName === "undo") {
        editor.current && editor.current.undo();
        event.preventDefault();
      } else {
        const slateDef = this.lookupButtonIcon(buttonIconName);
        if (slateDef && slateDef.slateType && slateDef.nodeType) {
          if (slateDef.nodeType === SlateNodeType.mark) {
            this.handleMarkEvent(slateDef.slateType, event, editor);
          } else {  // slateDef.nodeType === SlateNodeType.block
            this.handleBlockEvent(slateDef.slateType, event, editor);
          }
          event.preventDefault();
        }
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
          clickHandler={handleToolBarButtonClick}
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
          onChange={this.handleChange}
          renderMark={this.renderMark}
          renderBlock={this.renderBlock}
          plugins={this.slatePlugins}
        />
      </div>
    );
  }

  private handleChange = (change: SlateChange) => {
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

    if (content.type === "Text" && !readOnly) {
      content.setSlate(change.value);
      this.setState(
        {
          value: change.value,
          selectedButtons: this.getSelectedIcons(change).sort()
        }
      );
    }
  }

  private getSelectedIcons(change: SlateChange): string[] {
    const listOfMarks = change.value.activeMarks;

    const buttonList: string[] = ["undo"];  // Always show "undo" as selected.

    if (listOfMarks) {
      listOfMarks.forEach(mark => {
        if (mark && mark.type) {
          const button = this.lookupSlateType(mark.type);
          if (button && button.buttonIconName) {
            buttonList.push(button.buttonIconName);
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
        const button = this.lookupSlateType(slateType);
        if (button && button.buttonIconName) {
          buttonList.push(button.buttonIconName);
        }
      }
    });
    return buttonList;

  }

  private lookupButtonIcon(buttonIconName: string): ISlateMapEntry | undefined {
    // Should probably check that there is only one entry. If there is more
    // than one, it's a coding error.
    return this.slateMap.find(mapEntry => mapEntry.buttonIconName === buttonIconName);
  }

  private lookupSlateType(slateType: string): ISlateMapEntry | undefined {
    // See comment in lookupButtonIcon() -- same applies here.
    return this.slateMap.find(mapEntry => mapEntry.slateType === slateType);
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

  private resolveEditorRef(editor: any): any {
    // In some cases, the event handlers, handleMarkEvent() and handleBlockEvent()
    // called from other methods in this component's class, and other times, they
    // are called by Slate through the plugin interface. In the first case, the
    // editor is a React forward reference. In the latter, it is passed as the
    // editor instance, itself.
    return editor.current ? editor.current : editor;
  }

  private handleMarkEvent(slateType: string, event: any, editor: any, next?: () => any) {
    const ed = this.resolveEditorRef(editor);
    switch (slateType) {
      case "superscript":
      case "subscript":
        // Special case handling: Prevent the nesting of superscripts and subscripts.
        const hasType = ed.value.marks.some((m: any) => {
          return (m.type === "subscript" || m.type === "superscript");
        });
        if (hasType) {
          ed.removeMark("superscript").removeMark("subscript");
        } else {
          ed.toggleMark(slateType);
        }
        break;
      default:
        // Everything else (e.g. bold, underline, italic, ...)
        ed.toggleMark(slateType);
        break;
    }
  }

  private handleBlockEvent(slateType: string, event: any, editor: any, next?: () => any) {
    const DEFAULT_BLOCK_TYPE = "";
    const ed = this.resolveEditorRef(editor);
    const { value: { blocks, document } } = ed;
    const containsListItems = blocks.some((block: any) => block.type === "list-item");
    const isListOfThisType = blocks.some((block: any) => {
      return !!document.getClosest(block.key, (parent: any) => parent.type === slateType);
    });
    switch (slateType) {
      case "bulleted-list":
      case "ordered-list":
        if (! containsListItems) {
          // For a brand new list, first set the selection to be a list-item.
          // Then wrap the new list-items with the appropriate type of block.
          ed.setBlocks("list-item")
            .wrapBlock(slateType);
        } else if (isListOfThisType) {
          // If we are setting a list to its current type, we treat this as
          // a toggle-off. To do this, we unwrap the selection and remove all
          // list-items.
          ed.setBlocks(DEFAULT_BLOCK_TYPE)  // Removes blocks typed w/ "list-item"
            .unwrapBlock("bulleted-list")
            .unwrapBlock("ordered-list");
        } else {
          // If we have ended up here, then we are switching a list between slate
          // types, i.e., bulleted <-> numbered.
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
        const isAlreadySet = blocks.some((block: any) => block.type === slateType);
        ed.setBlocks(isAlreadySet ? DEFAULT_BLOCK_TYPE : slateType);
        if (containsListItems) {
          // In this case, we are trying to change a block away from
          // being a list. To do this, we either set the slateType we are
          // after, or clear it, if it's already set to that slateType. Then
          // we remove any part of the selection that might be a wrapper
          // of either type of list.
          ed.unwrapBlock("bulleted-list")
            .unwrapBlock("ordered-list");
        }
        break;
    }
  }

  private makeKeyDownHandler(hotKeyDef: ISlateMapEntry): Plugin {
    // Returns a Slate plug-in for an onKeyDown handler required
    // by the plug-in.
    const { hotKey, slateType, nodeType } = hotKeyDef;
    const onSlateEvent = (
      nType: SlateNodeType,
      sType: string,
      event: any,
      editor: any,
      next: () => any) => {
      if (nType === SlateNodeType.mark) {
        this.handleMarkEvent(sType, event, editor, next);
      } else {
        this.handleBlockEvent(sType, event, editor, next);
      }
      event.preventDefault();
    };
    // Note: The following two return paths both return methods that match slate's
    // onKeyDown() method signature.
    if (! hotKey) {
      return ({
        onKeyDown(event: any, editor: any, next: () => any) {
          next();
        }
      });
    } else {
      return ({
        onKeyDown(event: any, editor: any, next: () => any) {
          if (isHotkey(hotKey, event)) {
            onSlateEvent(nodeType, slateType, event, editor, next);
          } else {
            next();
          }
        }
      });
    }
  }

}
