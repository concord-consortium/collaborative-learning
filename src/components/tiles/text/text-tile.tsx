import React, { useMemo } from "react";
import { IReactionDisposer, reaction } from "mobx";
import { observer, inject } from "mobx-react";
import {
 isMarkActive, Editor, CustomEditor, Editable, EditorValue, SlateEditor, ReactEditor, withReact, withHistory, createEditor, Slate, EFormat, isBlockActive
} from "@concord-consortium/slate-editor";
import "@concord-consortium/slate-editor/dist/index.css";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";
import { BaseComponent } from "../../base";
import { debouncedSelectTile } from "../../../models/stores/ui";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { TextToolbarComponent } from "./text-toolbar";
import { ITileApi, TileResizeEntry } from "../tile-api";
import { ITileProps } from "../tile-component";
import { getTextPluginInstances, getTextPluginIds } from "../../../models/tiles/text/text-plugin-info";
import { LogEventName } from "../../../lib/logger-types";
import { withClueVariables } from "../../../plugins/shared-variables/slate/variables-plugin";

import "./text-tile.sass";

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

  * The name in the Tool Bar column is used to both render the button and to
  identify the button's action.

*/

interface IState {
  value?: EditorValue;
  selectedButtons?: string[];
  editing?: boolean;
}

@inject("stores")
@observer
export default class TextToolComponent extends BaseComponent<ITileProps, IState> {
  public state: IState = {};
  private disposers: IReactionDisposer[];
  private prevText: any;
  private textTileDiv: HTMLElement | null;
  private editor: CustomEditor | undefined;
  private tileContentRect: DOMRectReadOnly;
  private toolbarTileApi: ITileApi | undefined;
  private plugins: any[] | undefined; // FIXME
  private textOnFocus: string | string [] | undefined;

  // map from slate type string to button icon name
  private slateToButtonType: Partial<Record<EFormat, string>> =  {
    [EFormat.bold]: "bold",
    [EFormat.italic]: "italic",
    [EFormat.underlined]: "underline",
    [EFormat.superscript]: "superscript",
    [EFormat.subscript]: "subscript",
    [EFormat.bulletedList]: "list-ul",
    [EFormat.numberedList]: "list-ol",
    //include the plugin ids here
    ...getTextPluginIds().reduce((idMap, id) => ({...idMap, [id]: id}), {})
  }

  public componentDidMount() {
    const initialTextContent = this.getContent();
    this.prevText = initialTextContent.text;
    const initialValue = initialTextContent.asSlate();
    this.setState({
      value: initialValue
    });
    this.plugins = getTextPluginInstances(this.props.model.content as TextContentModelType);
    // FIXME: Loop over all the plugins instead of just the one
    const options: any = {};
    options["onInitEditor"] = this.plugins[0]?.onInitEditor;
    this.editor = withHistory(withReact(createEditor(options)));

    this.disposers = [];
    this.disposers.push(reaction(
      () => {
        const readOnly = this.props.readOnly;
        const editing = this.state.editing;
        const text = this.getContent().text;
        return { readOnly, editing, text };
      },
      ({ readOnly, editing, text }) => {
        if (readOnly || !editing) {
          if (this.prevText !== text) {
            const textContent = this.getContent();
            this.setState({ value: textContent.asSlate() });
            this.prevText = text;
          }
        }
      }
    ));
    // blur editor when tile is deselected
    this.disposers.push(reaction(
      () => {
        const { model: { id } } = this.props;
        const { ui: { selectedTileIds } } = this.stores;
        return selectedTileIds.includes(id);
      },
      isTileSelected => {
        const { value } = this.state;
        //const isFocused = !!value?.selection.isFocused;
        const isFocused = this.editor && ReactEditor.isFocused(this.editor);
        if (isFocused && !isTileSelected) {
          this.editor && ReactEditor.blur(this.editor);
        }
      }
    ));

    this.props.onRegisterTileApi({
      exportContentAsTileJson: () => {
        return this.getContent().exportJson();
      },
      handleDocumentScroll: (x: number, y: number) => {
        this.toolbarTileApi?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        const { x, y, width, height, top, left, bottom, right } = entry.contentRect;
        this.tileContentRect = { x, y, width, height, top, left, bottom, right, toJSON: () => "" };
        this.toolbarTileApi?.handleTileResize?.(entry);
      }
    });

  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());
  }

  public render() {
    const { documentContent, tileElt, readOnly, scale } = this.props;
    const { value: editorValue, selectedButtons } = this.state;
    const { appConfig: { placeholderText } } = this.stores;
    const editableClass = readOnly ? "read-only" : "editable";
    // Ideally this would just be 'text-tool-editor', but 'text-tool' has been
    // used here for a while now and cypress tests depend on it. Should transition
    // to using 'text-tool-editor' for these purposes moving forward.
    const classes = `text-tool text-tool-editor ${editableClass}`;
    if (!editorValue) return null;

    return (
      // Ideally, this would just be 'text-tool' for consistency with other tools,
      // but 'text-tool` is used for the internal editor (cf. 'classes' above),
      // which is used for cypress tests and other purposes.
      // FIXME: replace this provider with one at the tile level so we get it for free.
      // and then replace the drawing one with that as well
      <TextContentModelContext.Provider value={this.getContent()} >
      <div className={`text-tool-wrapper ${readOnly ? "" : "editable"}`}
        data-testid="text-tool-wrapper"
        ref={elt => this.textTileDiv = elt}
        onMouseDown={this.handleMouseDownInWrapper}>
         <Slate
            editor={this.editor as ReactEditor}
            value={editorValue}
            onChange={this.handleChange}>
        <SlateEditor
          value={editorValue}
          placeholder={placeholderText}
          readOnly={readOnly}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          className={`ccrte-editor slate-editor ${classes || ""}`}
        >
       
        </SlateEditor>
        <TextToolbarComponent
          documentContent={documentContent}
          tileElt={tileElt}
          scale={scale}
          selectedButtons={selectedButtons || []}
          editor={this.editor}
          onIsEnabled={this.handleIsEnabled}
          onRegisterTileApi={this.handleRegisterToolApi}
          onUnregisterTileApi={this.handleUnregisterToolApi}
        />
        </Slate>
      </div>
      </TextContentModelContext.Provider>

    );
  }

  private handleRegisterToolApi = (tileApi: ITileApi) => {
    this.toolbarTileApi = tileApi;

    // call resize handler immediately with current size
    const { tileElt } = this.props;
    tileElt && this.tileContentRect &&
      this.toolbarTileApi?.handleTileResize?.({ target: tileElt, contentRect: this.tileContentRect });
  };

  private handleUnregisterToolApi = () => {
    this.toolbarTileApi = undefined;
  };

  private handleIsEnabled = () => {
    // text toolbar is based on editor focus rather than tile selection
    return ReactEditor.isFocused(this.editor as ReactEditor);
  };

  private handleChange = (value: EditorValue) => {
    const { readOnly, model } = this.props;
    const content = this.getContent();
    const { ui } = this.stores;

    if (this.editor && ReactEditor.isFocused(this.editor)) {
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
    const buttonList: string[] = ["undo"];  // Always show "undo" as selected.
    for (const key in this.slateToButtonType) {
      if (isMarkActive(this.editor as CustomEditor, key as EFormat) ||
        isBlockActive(this.editor as CustomEditor, key as EFormat)) {
        const buttonType = this.slateToButtonType[key as EFormat];
        if (buttonType) {
          buttonList.push(buttonType);
        }
      }
    }
    return buttonList;
  }

  private handleMouseDownInWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    const { model, readOnly } = this.props;
    const isExtendingSelection = hasSelectionModifier(e);
    const isWrapperClick = e.target === this.textTileDiv;
    if (readOnly || isWrapperClick || isExtendingSelection) {
      isWrapperClick && this.editor && ReactEditor.focus(this.editor);
      ui.setSelectedTile(model, { append: isExtendingSelection });
      e.preventDefault();
    }
  };

  private getContent() {
    return this.props.model.content as TextContentModelType;
  }

  private handleBlur = () => {
    this.setState({ editing: false });
    // If the text has changed since the editor was focused, log the new text.
    if (this.getContent().text !== this.textOnFocus) {
      const change = {args:[{text: this.getContent().text}]};
      logTileChangeEvent(LogEventName.TEXT_TOOL_CHANGE, { operation: 'update', change, tileId: this.props.model.id });
    }
  };

  private handleFocus = () => {
    this.textOnFocus = this.getContent().text;
    this.setState({ editing: true });
  };
}


