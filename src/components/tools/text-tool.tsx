import React from "react";
import { autorun, IReactionDisposer, reaction } from "mobx";
import { observer, inject } from "mobx-react";
import {
  Editor, EditorRange, EditorValue, EFormat, handleToggleSuperSubscript, SlateEditor
} from "@concord-consortium/slate-editor";

import { BaseComponent } from "../base";
import { debouncedSelectTile } from "../../models/stores/ui";
import { TextContentModelType } from "../../models/tools/text/text-content";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { TextToolbarComponent } from "./text-toolbar";
import { IToolApi, TileResizeEntry } from "./tool-api";
import { IToolTileProps } from "./tool-tile";

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

interface IState {
  value?: EditorValue;
  selectedButtons?: string[];
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<IToolTileProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;
  private textToolDiv: HTMLElement | null;
  private editor: Editor | undefined;
  private tileContentRect: DOMRectReadOnly;
  private toolbarToolApi: IToolApi | undefined;

  // map from slate type string to button icon name
  private slateMap: Record<string, string> = {
    // This table is needed to translate between Slate's block and mark types
    // and the parameters required for event handling. (Sometimes the name
    // differences are a little subtle.)
    "bold": "bold",
    "italic": "italic",
    "underlined": "underline",
    "superscript": "superscript",
    "subscript": "subscript",
    "bulleted-list": "list-ul",
    "ordered-list": "list-ol"
  };

  public componentDidMount() {
    const initialTextContent = this.getContent();
    this.prevText = initialTextContent.text;
    const initialValue = initialTextContent.asSlate();
    this.setState({
      value: initialValue
    });

    this.disposers = [];
    this.disposers.push(autorun(() => {
      const textContent = this.getContent();
      if (this.prevText !== textContent.text) {
        this.setState({ value: textContent.asSlate() });
        this.prevText = textContent.text;
      }
    }));

    // blur editor when tile is deselected
    this.disposers.push(reaction(
      () => {
        const { model: { id } } = this.props;
        const { ui: { selectedTileIds } } = this.stores;
        return selectedTileIds.includes(id);
      },
      isTileSelected => {
        const { value } = this.state;
        const isFocused = !!value?.selection.isFocused;
        if (isFocused && !isTileSelected) {
          this.editor?.blur();
        }
      }
    ));

    this.props.onRegisterToolApi({
      exportContentAsTileJson: () => {
        return this.getContent().exportJson();
      },
      handleDocumentScroll: (x: number, y: number) => {
        this.toolbarToolApi?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        const { x, y, width, height, top, left, bottom, right } = entry.contentRect;
        this.tileContentRect = { x, y, width, height, top, left, bottom, right, toJSON: () => "" };
        this.toolbarToolApi?.handleTileResize?.(entry);
      }
    });
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
  }

  public render() {
    const { documentContent, toolTile, readOnly, scale } = this.props;
    const { value: editorValue, selectedButtons } = this.state;
    const { appConfig: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const classes = `text-tool text-tool-editor ${editableClass}`;

    if (!editorValue) return null;

    const handleToolBarButtonClick = (buttonIconName: string, editor: Editor, event: React.MouseEvent) => {
      if (buttonIconName === "undo") {
        editor.undo();
        event.preventDefault();
      }
      else {
        switch (buttonIconName) {
          case "bold":
            editor.command("toggleMark", EFormat.bold);
            break;
          case "italic":
            editor.command("toggleMark", EFormat.italic);
            break;
          case "underline":
            editor.command("toggleMark", EFormat.underlined);
            break;
          case "subscript":
            handleToggleSuperSubscript(EFormat.subscript, editor);
            break;
          case "superscript":
            handleToggleSuperSubscript(EFormat.superscript, editor);
            break;
          case "list-ol":
            editor.command("toggleBlock", EFormat.numberedList);
            break;
          case "list-ul":
            editor.command("toggleBlock", EFormat.bulletedList);
            break;
        }
        event.preventDefault();
      }
    };

    return (
      // Ideally, this would just be 'text-tool' for consistency with other tools,
      // but 'text-tool` is used for the internal editor (cf. 'classes' above),
      // which is used for cypress tests and other purposes.
      <div className={`text-tool-wrapper ${readOnly ? "" : "editable"}`}
        data-testid="text-tool-wrapper"
        ref={elt => this.textToolDiv = elt}
        onMouseDown={this.handleMouseDownInWrapper}>
        <TextToolbarComponent
          documentContent={documentContent}
          toolTile={toolTile}
          scale={scale}
          selectedButtons={selectedButtons || []}
          onButtonClick={handleToolBarButtonClick}
          editor={this.editor}
          onIsEnabled={this.handleIsEnabled}
          onRegisterToolApi={this.handleRegisterToolApi}
          onUnregisterToolApi={this.handleUnregisterToolApi}
        />
        <SlateEditor
          className={classes}
          onEditorRef={editorRef => this.editor = editorRef}
          value={editorValue}
          placeholder={placeholderText}
          readOnly={readOnly}
          onValueChange={this.handleChange} />
      </div>
    );
  }

  private handleRegisterToolApi = (toolApi: IToolApi) => {
    this.toolbarToolApi = toolApi;

    // call resize handler immediately with current size
    const { toolTile } = this.props;
    toolTile && this.tileContentRect &&
      this.toolbarToolApi?.handleTileResize?.({ target: toolTile, contentRect: this.tileContentRect });
  };

  private handleUnregisterToolApi = () => {
    this.toolbarToolApi = undefined;
  };

  private handleIsEnabled = () => {
    // text toolbar is based on editor focus rather than tile selection
    return !!this.state.value?.selection.isFocused;
  };

  private handleChange = (value: EditorValue) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;

    if (value.selection.isFocused) {
      debouncedSelectTile(ui, model);
    }

    if (content.type === "Text" && !readOnly) {
      content.setSlate(value);
      this.setState({
        value,
        selectedButtons: this.getSelectedIcons(value).sort()
      });
    }
  };

  private getSelectedIcons(value: EditorValue): string[] {
    const listOfMarks = value.activeMarks;

    const buttonList: string[] = ["undo"];  // Always show "undo" as selected.

    listOfMarks?.forEach(mark => {
      if (mark?.type) {
        const buttonIconName = this.slateMap[mark.type];
        buttonIconName && buttonList.push(buttonIconName);
      }
    });

    const { document, selection } = value;
    const currentRange = EditorRange.create(
      {
        anchor: selection.anchor,
        focus: selection.focus
      }
    );
    const nodes = document.getDescendantsAtRange(currentRange);
    ["ordered-list", "bulleted-list"].forEach((slateType) => {
      if (nodes.some((node: any) => node.type === slateType)) {
        const buttonIconName = this.slateMap[slateType];
        buttonIconName && buttonList.push(buttonIconName);
      }
    });
    return buttonList;
  }

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model, readOnly } = this.props;
    const isExtendingSelection = hasSelectionModifier(e);
    const isWrapperClick = e.target === this.textToolDiv;
    if (readOnly || isWrapperClick || isExtendingSelection) {
      isWrapperClick && this.editor?.focus();
      ui.setSelectedTile(model, { append: isExtendingSelection });
      e.preventDefault();
    }
  };

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

}
